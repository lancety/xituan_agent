'use strict';

/**
 * IMAGE_NORMALIZE Lambda (Phase C2).
 * Envelope: { jobId, type, payload, callbackBaseUrl, ... }
 * Payload: { sourceKey, bucket?, format, variants, maxEdge, quality?, force? }
 */

const crypto = require('crypto');
const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const DEFAULT_VARIANTS = [64, 128, 256];
const DEFAULT_MAX_EDGE = 2048;
const DEFAULT_QUALITY = 80;

function normalizePayload(raw) {
  const sourceKey = typeof raw.sourceKey === 'string' ? raw.sourceKey.trim() : '';
  if (!sourceKey) {
    throw new Error('payload.sourceKey is required');
  }
  const format = raw.format === 'png' ? 'png' : 'webp';
  const variants =
    Array.isArray(raw.variants) && raw.variants.length > 0
      ? raw.variants.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
      : [...DEFAULT_VARIANTS];
  return {
    sourceKey,
    bucket: typeof raw.bucket === 'string' && raw.bucket.trim() ? raw.bucket.trim() : undefined,
    format,
    variants,
    maxEdge: Number(raw.maxEdge) > 0 ? Number(raw.maxEdge) : DEFAULT_MAX_EDGE,
    quality: Number(raw.quality) > 0 ? Number(raw.quality) : DEFAULT_QUALITY,
    force: Boolean(raw.force),
  };
}

function deriveOutputKeys(sourceKey, format, variants) {
  const slash = sourceKey.lastIndexOf('/');
  const dir = slash >= 0 ? sourceKey.slice(0, slash + 1) : '';
  const file = slash >= 0 ? sourceKey.slice(slash + 1) : sourceKey;
  const base = file.replace(/\.[^.]+$/, '') || file;
  const ext = format === 'png' ? 'png' : 'webp';
  const canonicalKey = `${dir}${base}.${ext}`;
  const variantKeys = {};
  for (const edge of variants) {
    variantKeys[String(edge)] = `${dir}${base}_w${edge}.${ext}`;
  }
  return { canonicalKey, variantKeys };
}

async function streamToBuffer(body) {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function objectExists(s3, bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if (err && (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404)) {
      return false;
    }
    throw err;
  }
}

async function putBuffer(s3, bucket, key, buffer, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

async function buildCanonical(input, maxEdge, format, quality) {
  let pipeline = sharp(input, { failOn: 'none' }).rotate();
  const meta = await pipeline.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w > 0 && h > 0 && Math.max(w, h) > maxEdge) {
    pipeline = pipeline.resize({
      width: w >= h ? maxEdge : undefined,
      height: h > w ? maxEdge : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  if (format === 'png') {
    return pipeline.png().toBuffer();
  }
  return pipeline.webp({ quality }).toBuffer();
}

async function buildVariant(input, edge, format, quality) {
  let pipeline = sharp(input, { failOn: 'none' })
    .rotate()
    .resize(edge, edge, { fit: 'cover', position: 'centre' });
  if (format === 'png') {
    return pipeline.png().toBuffer();
  }
  return pipeline.webp({ quality }).toBuffer();
}

function signCallback(jobId, timestamp, rawBody, secret) {
  const payload = `${jobId}.${timestamp}.${rawBody}`;
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

async function patchJob(callbackBaseUrl, jobId, body, secret) {
  const base = String(callbackBaseUrl || '').replace(/\/$/, '');
  if (!base) {
    throw new Error('callbackBaseUrl is empty');
  }
  if (!secret) {
    throw new Error('JOB_CALLBACK_SECRET is not configured on Lambda');
  }
  const rawBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = signCallback(jobId, timestamp, rawBody, secret);
  const url = `${base}/api/internal/jobs/${encodeURIComponent(jobId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Job-Timestamp': timestamp,
      'X-Job-Signature': signature,
    },
    body: rawBody,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Job callback HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
}

async function processOne(envelope, s3, bucketDefault, secret) {
  const jobId = envelope.jobId;
  const callbackBaseUrl = envelope.callbackBaseUrl;
  if (!jobId) {
    throw new Error('envelope.jobId is required');
  }
  const payload = normalizePayload(envelope.payload || {});
  const bucket = payload.bucket || bucketDefault;
  if (!bucket) {
    throw new Error('No S3 bucket (payload.bucket or MEDIA_BUCKET/S3_BUCKET)');
  }

  const { canonicalKey, variantKeys } = deriveOutputKeys(
    payload.sourceKey,
    payload.format,
    payload.variants
  );
  const contentType = payload.format === 'png' ? 'image/png' : 'image/webp';

  let skipped = false;
  if (!payload.force) {
    const need = [canonicalKey, ...Object.values(variantKeys)];
    const exists = await Promise.all(need.map((k) => objectExists(s3, bucket, k)));
    if (exists.every(Boolean)) {
      skipped = true;
    }
  }

  if (!skipped) {
    const getRes = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: payload.sourceKey })
    );
    const input = await streamToBuffer(getRes.Body);
    if (!input.length) {
      throw new Error(`Empty source object: ${payload.sourceKey}`);
    }

    const canonicalBuf = await buildCanonical(
      input,
      payload.maxEdge,
      payload.format,
      payload.quality
    );
    await putBuffer(s3, bucket, canonicalKey, canonicalBuf, contentType);

    for (const edge of payload.variants) {
      const key = variantKeys[String(edge)];
      const buf = await buildVariant(input, edge, payload.format, payload.quality);
      await putBuffer(s3, bucket, key, buf, contentType);
    }
  }

  await patchJob(
    callbackBaseUrl,
    jobId,
    {
      status: 'SUCCEEDED',
      result: {
        sourceKey: payload.sourceKey,
        canonicalKey,
        variants: variantKeys,
        skipped,
      },
    },
    secret
  );

  return { jobId, canonicalKey, skipped };
}

async function failJob(envelope, secret, errorMessage) {
  if (!envelope?.jobId || !envelope?.callbackBaseUrl) {
    console.error('[image-normalize] cannot callback failure', errorMessage);
    return;
  }
  try {
    await patchJob(
      envelope.callbackBaseUrl,
      envelope.jobId,
      { status: 'FAILED', error: errorMessage },
      secret
    );
  } catch (cbErr) {
    console.error('[image-normalize] failure callback failed', cbErr);
  }
}

function parseRecordBody(record) {
  const body = record.body ?? record;
  if (typeof body === 'string') {
    return JSON.parse(body);
  }
  if (body && typeof body === 'object') {
    return body;
  }
  throw new Error('Invalid SQS/Lambda record body');
}

// Exported for local-invoke fixture smoke (no S3).
exports.normalizePayload = normalizePayload;
exports.deriveOutputKeys = deriveOutputKeys;
exports.buildCanonical = buildCanonical;
exports.buildVariant = buildVariant;
exports.patchJob = patchJob;

exports.handler = async (event) => {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
  const secret = (process.env.JOB_CALLBACK_SECRET || '').trim();
  const bucketDefault = (
    process.env.MEDIA_BUCKET ||
    process.env.S3_BUCKET ||
    ''
  ).trim();
  const s3 = new S3Client({ region });

  const records = Array.isArray(event?.Records) ? event.Records : [event];
  const results = [];

  for (const record of records) {
    let envelope;
    try {
      envelope = parseRecordBody(record);
      if (envelope.type && envelope.type !== 'IMAGE_NORMALIZE') {
        console.warn('[image-normalize] skip non-IMAGE_NORMALIZE type', envelope.type);
        continue;
      }
      const out = await processOne(envelope, s3, bucketDefault, secret);
      results.push(out);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[image-normalize] process failed', message);
      await failJob(envelope, secret, message);
      throw err;
    }
  }

  return { ok: true, results };
};
