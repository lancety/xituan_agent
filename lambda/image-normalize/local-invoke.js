'use strict';

/**
 * Local IMAGE_NORMALIZE runner.
 *
 * Modes:
 *   1) fixture — Sharp only (no S3 / no Backend). Verifies resize + key naming.
 *   2) envelope — full handler against real S3 + HMAC PATCH to callbackBaseUrl
 *      (usually API_PUBLIC_ORIGIN / --callbackBaseUrl → your dev Backend).
 *
 * Env for envelope mode:
 *   JOB_CALLBACK_SECRET  — must match Backend current secret
 *   MEDIA_BUCKET / S3_BUCKET — default bucket if payload omits bucket
 *   AWS_REGION (+ credentials for S3)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  handler,
  normalizePayload,
  deriveOutputKeys,
  buildCanonical,
  buildVariant,
} = require('./handler');

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx < 0 || idx + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[idx + 1];
}

function printHelp() {
  console.log(`Usage:
  node local-invoke.js --fixture [optional.jpg|png] [--outDir ./.local/out]
  node local-invoke.js --envelope ./.local/envelope.json

Envelope mode requires JOB_CALLBACK_SECRET + MEDIA_BUCKET (or payload.bucket) + AWS credentials.
Callback hits envelope.callbackBaseUrl (dev Backend), not a hardcoded host.
`);
}

async function runFixture() {
  const fixtureArg = argValue('--fixture');
  const outDir = path.resolve(argValue('--outDir') || path.join(__dirname, '.local', 'out'));
  fs.mkdirSync(outDir, { recursive: true });

  let inputBuf;
  let sourceKey;
  if (fixtureArg && fixtureArg !== 'true' && !fixtureArg.startsWith('--')) {
    const abs = path.resolve(fixtureArg);
    inputBuf = fs.readFileSync(abs);
    sourceKey = `local-fixture/${path.basename(abs)}`;
  } else {
    // Synthetic 3200x1800 JPEG so maxEdge + variants are exercised.
    inputBuf = await sharp({
      create: {
        width: 3200,
        height: 1800,
        channels: 3,
        background: { r: 40, g: 120, b: 200 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    sourceKey = 'local-fixture/smoke.jpg';
    fs.writeFileSync(path.join(outDir, 'smoke-source.jpg'), inputBuf);
  }

  const payload = normalizePayload({
    sourceKey,
    format: 'webp',
    variants: [64, 128, 256],
    maxEdge: 2048,
  });
  const { canonicalKey, variantKeys } = deriveOutputKeys(
    payload.sourceKey,
    payload.format,
    payload.variants
  );

  const canonicalBuf = await buildCanonical(
    inputBuf,
    payload.maxEdge,
    payload.format,
    payload.quality
  );
  const canonicalMeta = await sharp(canonicalBuf).metadata();
  const canonicalName = path.basename(canonicalKey);
  fs.writeFileSync(path.join(outDir, canonicalName), canonicalBuf);

  const written = { canonicalKey, variants: {} };
  for (const edge of payload.variants) {
    const key = variantKeys[String(edge)];
    const buf = await buildVariant(inputBuf, edge, payload.format, payload.quality);
    const meta = await sharp(buf).metadata();
    fs.writeFileSync(path.join(outDir, path.basename(key)), buf);
    written.variants[String(edge)] = {
      key,
      width: meta.width,
      height: meta.height,
    };
    if (meta.width !== edge || meta.height !== edge) {
      throw new Error(`Variant ${edge} expected ${edge}x${edge}, got ${meta.width}x${meta.height}`);
    }
  }

  const longEdge = Math.max(canonicalMeta.width || 0, canonicalMeta.height || 0);
  if (longEdge > payload.maxEdge) {
    throw new Error(`Canonical long edge ${longEdge} exceeds maxEdge ${payload.maxEdge}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'fixture',
        outDir,
        sourceKey,
        canonical: {
          key: canonicalKey,
          width: canonicalMeta.width,
          height: canonicalMeta.height,
          bytes: canonicalBuf.length,
        },
        variants: written.variants,
      },
      null,
      2
    )
  );
}

async function runEnvelope() {
  const envelopePath = argValue('--envelope');
  if (!envelopePath) {
    printHelp();
    process.exit(1);
  }
  const abs = path.resolve(envelopePath);
  const envelope = JSON.parse(fs.readFileSync(abs, 'utf8'));

  if (!process.env.JOB_CALLBACK_SECRET?.trim()) {
    console.error('Set JOB_CALLBACK_SECRET to Backend current secret');
    process.exit(1);
  }
  if (!(process.env.MEDIA_BUCKET || process.env.S3_BUCKET || envelope.payload?.bucket)) {
    console.error('Set MEDIA_BUCKET / S3_BUCKET or put bucket on payload');
    process.exit(1);
  }

  console.log(
    `[local-invoke] jobId=${envelope.jobId} callbackBaseUrl=${envelope.callbackBaseUrl}`
  );
  const result = await handler(envelope);
  console.log(JSON.stringify({ ok: true, mode: 'envelope', result }, null, 2));
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }
  if (process.argv.includes('--fixture')) {
    await runFixture();
    return;
  }
  if (process.argv.includes('--envelope')) {
    await runEnvelope();
    return;
  }
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
