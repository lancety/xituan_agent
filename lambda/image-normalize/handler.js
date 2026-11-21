'use strict';

/**
 * IMAGE_NORMALIZE Lambda (Phase C2).
 * Envelope: { jobId, type, payload, callbackBaseUrl, ... }
 * Payload: { sourceKey, bucket?, format, variants, maxEdge, quality?, force? }
 */

const crypto = require('crypto');
const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const DEFAULT_VARIANTS = [64, 128, 256, 512];
const DEFAULT_MAX_EDGE = 2048;
const DEFAULT_QUALITY = 80;
const SHARE_ASPECT_JPEG_QUALITY = 80;
const SHARE_ASPECT_SPECS = {
  '1-1': { width: 400, height: 400, suffix: 'w400_1-1' },
  '5-4': { width: 500, height: 400, suffix: 'w500_5-4' },
};

/**
 * Keep in sync with xituan_codebase IMAGE_NORMALIZE_VARIANT_POLICY.
 * Keys = epImageNormalizeBindKind values.
 */
const VARIANT_POLICY = {
  product_images: { variants: [64, 128, 256, 512], format: 'webp' },
  news_images: { variants: [64, 128, 256, 512], format: 'webp' },
  merchant_logo: { variants: [64, 128, 256, 512], format: 'png' },
  merchant_logo_rect: { variants: [64, 128, 256, 512], format: 'png' },
  offer_header_image: { variants: [64, 128, 256, 512], format: 'webp' },
  offer_featured_images: { variants: [64, 128, 256, 512], format: 'webp' },
  preorder_header_image: { variants: [64, 128, 256, 512], format: 'webp' },
  preorder_carousel_images: { variants: [64, 128, 256, 512], format: 'webp' },
  product_preset_preview: { variants: [64, 128, 256, 512], format: 'webp' },
  cart_note_images: { variants: [64, 128, 256, 512], format: 'webp' },
  order_note_images: { variants: [64, 128, 256, 512], format: 'webp' },
  user_avatar: { variants: [64, 128, 256, 512], format: 'webp' },
  expense_receipt: { variants: [256], format: 'webp' },
  print_temp_image: { variants: [64, 128, 256, 512], format: 'png' },
  openim_chat_image: { variants: [64, 128, 256, 512], format: 'webp' },
  barcode: { variants: [256, 512], format: 'png' },
};

function sortedUnique(edges) {
  return [...new Set(edges.map((n) => Math.round(Number(n))).filter((n) => n > 0))].sort(
    (a, b) => a - b
  );
}

function edgesEqual(a, b) {
  const sa = sortedUnique(a);
  const sb = sortedUnique(b);
  if (sa.length !== sb.length) {
    return false;
  }
  return sa.every((v, i) => v === sb[i]);
}

function assertPayloadMatchesPolicy(raw, payload) {
  const bind = raw && typeof raw.bind === 'object' ? raw.bind : null;
  const kind = bind && typeof bind.kind === 'string' ? bind.kind : '';
  if (!kind) {
    return;
  }
  const entry = VARIANT_POLICY[kind];
  if (!entry) {
    throw new Error(`[image-normalize-policy] missing Lambda policy for kind=${kind}`);
  }
  if (!edgesEqual(payload.variants, entry.variants)) {
    throw new Error(
      `[image-normalize-policy] job variants=[${sortedUnique(payload.variants).join(',')}] ` +
        `do not match policy for kind=${kind} expected=[${entry.variants.join(',')}]`
    );
  }
  if (payload.format !== entry.format) {
    throw new Error(
      `[image-normalize-policy] format=${payload.format} does not match policy for kind=${kind} expected=${entry.format}`
    );
  }
}

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
  const payload = {
    sourceKey,
    bucket: typeof raw.bucket === 'string' && raw.bucket.trim() ? raw.bucket.trim() : undefined,
    format,
    variants,
    maxEdge: Number(raw.maxEdge) > 0 ? Number(raw.maxEdge) : DEFAULT_MAX_EDGE,
    quality: Number(raw.quality) > 0 ? Number(raw.quality) : DEFAULT_QUALITY,
    force: Boolean(raw.force),
    variantsOnly: Boolean(raw.variantsOnly),
    shareAspectCrops: Boolean(raw.shareAspectCrops),
  };
  assertPayloadMatchesPolicy(raw, payload);
  return payload;
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

function deriveShareAspectKeys(sourceKey) {
  const slash = sourceKey.lastIndexOf('/');
  const dir = slash >= 0 ? sourceKey.slice(0, slash + 1) : '';
  const file = slash >= 0 ? sourceKey.slice(slash + 1) : sourceKey;
  const base = file.replace(/\.[^.]+$/, '') || file;
  const baseNoVariant = base
    .replace(/_w(400_1-1|500_5-4)$/i, '')
    .replace(/_w(64|128|256|512)$/i, '');
  return {
    '1-1': `${dir}${baseNoVariant}_${SHARE_ASPECT_SPECS['1-1'].suffix}.jpg`,
    '5-4': `${dir}${baseNoVariant}_${SHARE_ASPECT_SPECS['5-4'].suffix}.jpg`,
  };
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
  // Fit inside edge×edge: proportional scale, no short-edge crop (not cover).
  let pipeline = sharp(input, { failOn: 'none' })
    .rotate()
    .resize(edge, edge, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  if (format === 'png') {
    return pipeline.png().toBuffer();
  }
  return pipeline.webp({ quality }).toBuffer();
}

async function buildShareAspectJpg(input, width, height, quality) {
  return sharp(input, { failOn: 'none' })
    .rotate()
    .resize(width, height, {
      fit: 'cover',
      position: 'centre',
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
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
  const shareAspectCrops = Boolean(payload.shareAspectCrops);
  const shareKeys = shareAspectCrops ? deriveShareAspectKeys(payload.sourceKey) : null;
  const contentType = payload.format === 'png' ? 'image/png' : 'image/webp';

  const variantsOnly = Boolean(payload.variantsOnly);
  /** shareAspectCrops + variantsOnly: only ensure share JPGs; do not rebuild display `_w*`. */
  const shareAspectOnly = shareAspectCrops && variantsOnly;
  const displayNeed = variantsOnly
    ? Object.values(variantKeys)
    : [canonicalKey, ...Object.values(variantKeys)];
  const shareNeed = shareKeys ? [shareKeys['1-1'], shareKeys['5-4']] : [];

  let displayReady = false;
  let shareReady = !shareAspectCrops;
  if (!payload.force) {
    if (!shareAspectOnly) {
      const displayExists = await Promise.all(displayNeed.map((k) => objectExists(s3, bucket, k)));
      displayReady = displayExists.every(Boolean);
    } else {
      displayReady = true;
    }
    if (shareNeed.length > 0) {
      const shareExists = await Promise.all(shareNeed.map((k) => objectExists(s3, bucket, k)));
      shareReady = shareExists.every(Boolean);
    }
  }

  let skipped = !payload.force && (shareAspectOnly ? shareReady : displayReady && shareReady);

  if (!skipped && !shareAspectOnly && (!displayReady || payload.force)) {
    let inputKey = payload.sourceKey;
    if (variantsOnly) {
      const canonicalExists = await objectExists(s3, bucket, canonicalKey);
      if (canonicalExists) {
        inputKey = canonicalKey;
      }
    }

    if (!(await objectExists(s3, bucket, inputKey))) {
      throw new Error(`Source object missing in S3: ${inputKey}`);
    }

    const getRes = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: inputKey })
    );
    const input = await streamToBuffer(getRes.Body);
    if (!input.length) {
      throw new Error(`Empty source object: ${inputKey}`);
    }

    if (!variantsOnly) {
      const canonicalBuf = await buildCanonical(
        input,
        payload.maxEdge,
        payload.format,
        payload.quality
      );
      await putBuffer(s3, bucket, canonicalKey, canonicalBuf, contentType);
    }

    for (const edge of payload.variants) {
      const key = variantKeys[String(edge)];
      const buf = await buildVariant(input, edge, payload.format, payload.quality);
      await putBuffer(s3, bucket, key, buf, contentType);
    }
    displayReady = true;
  }

  if (shareAspectCrops && shareKeys && (!shareReady || payload.force)) {
    const key512 = variantKeys['512'];
    let cropInput = null;
    if (key512 && (await objectExists(s3, bucket, key512))) {
      const get512 = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key512 }));
      cropInput = await streamToBuffer(get512.Body);
    }
    if ((!cropInput || !cropInput.length) && (await objectExists(s3, bucket, canonicalKey))) {
      const getCanon = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: canonicalKey }));
      cropInput = await streamToBuffer(getCanon.Body);
    }
    if ((!cropInput || !cropInput.length) && (await objectExists(s3, bucket, payload.sourceKey))) {
      const getSrc = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: payload.sourceKey })
      );
      cropInput = await streamToBuffer(getSrc.Body);
    }
    if (!cropInput || !cropInput.length) {
      console.warn(
        `[image-normalize] skip share aspect; no _w512/canonical/source in S3: ${payload.sourceKey}`
      );
      skipped = true;
    } else {
      for (const aspect of ['1-1', '5-4']) {
        const spec = SHARE_ASPECT_SPECS[aspect];
        const buf = await buildShareAspectJpg(
          cropInput,
          spec.width,
          spec.height,
          SHARE_ASPECT_JPEG_QUALITY
        );
        await putBuffer(s3, bucket, shareKeys[aspect], buf, 'image/jpeg');
      }
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
exports.deriveShareAspectKeys = deriveShareAspectKeys;
exports.buildCanonical = buildCanonical;
exports.buildVariant = buildVariant;
exports.buildShareAspectJpg = buildShareAspectJpg;
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
