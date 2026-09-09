'use strict';

/**
 * EXPENSE_RECEIPT_OCR Lambda (production/staging).
 * SQS delivers the job envelope; this worker HMAC-POSTs Backend
 * POST /api/internal/jobs/:jobId/run-expense-ocr which runs Textract + creates the expense.
 * CMS polls job status (ASYNC_QUEUE). Dev/demo leave JOB_EXPENSE_OCR_SQS_QUEUE_URL empty → Backend inline.
 */

const crypto = require('crypto');

function signCallback(jobId, timestamp, rawBody, secret) {
  const payload = `${jobId}.${timestamp}.${rawBody}`;
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

async function postRunExpenseOcr(callbackBaseUrl, jobId, secret) {
  const base = String(callbackBaseUrl || '').replace(/\/$/, '');
  if (!base) {
    throw new Error('callbackBaseUrl is empty');
  }
  if (!secret) {
    throw new Error('JOB_CALLBACK_SECRET is not configured on Lambda');
  }
  const rawBody = '{}';
  const timestamp = String(Date.now());
  const signature = signCallback(jobId, timestamp, rawBody, secret);
  const url = `${base}/api/internal/jobs/${encodeURIComponent(jobId)}/run-expense-ocr`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Job-Timestamp': timestamp,
      'X-Job-Signature': signature,
    },
    body: rawBody,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`run-expense-ocr HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

function parseEnvelope(record) {
  const body = typeof record.body === 'string' ? record.body : '';
  if (!body) {
    throw new Error('SQS record body is empty');
  }
  const envelope = JSON.parse(body);
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('SQS body is not a job envelope object');
  }
  if (envelope.type && envelope.type !== 'EXPENSE_RECEIPT_OCR') {
    throw new Error(`Unexpected job type: ${envelope.type}`);
  }
  if (!envelope.jobId) {
    throw new Error('envelope.jobId is required');
  }
  return envelope;
}

async function processOne(envelope, secret) {
  await postRunExpenseOcr(envelope.callbackBaseUrl, envelope.jobId, secret);
}

exports.handler = async function handler(event) {
  const secret = (process.env.JOB_CALLBACK_SECRET || '').trim();
  const records = Array.isArray(event?.Records) ? event.Records : null;

  // Direct Invoke (SYNC_INVOKE) may pass the envelope as the event root.
  if (!records) {
    if (event && event.jobId) {
      await processOne(event, secret);
      return { ok: true };
    }
    throw new Error('Unsupported event shape (expected SQS Records or job envelope)');
  }

  const failures = [];
  for (const record of records) {
    try {
      const envelope = parseEnvelope(record);
      await processOne(envelope, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[expense-receipt-ocr] record failed', message);
      if (record.messageId) {
        failures.push({ itemIdentifier: record.messageId });
      } else {
        throw err;
      }
    }
  }

  // Partial batch failure reporting for SQS event source mapping.
  if (failures.length > 0) {
    return { batchItemFailures: failures };
  }
  return { ok: true };
};
