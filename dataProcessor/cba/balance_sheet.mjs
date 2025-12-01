#!/usr/bin/env node

/**
 * Simple CBA CSV balance helper
 *
 * Goal:
 * - Read a CBA CSV file (date, amount, description, balance)
 * - Classify each transaction as:
 *   - type: "income" | "expense"
 *   - party: "company" | "personal" | "unknown"
 * - Write a new CSV adding the classification columns
 * - Print a small summary of company/personal income & expense
 *
 * This is a heuristic helper to speed up manual review.
 * It is intentionally conservative:
 * - All income is treated as company income (per your description)
 * - Expenses default to "personal" unless we have a strong business signal
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CLI args ---

const inputFileName = process.argv[2];
const outputFileName =
  process.argv[3] || (inputFileName ? `classified_${inputFileName}` : null);

if (!inputFileName) {
  console.error('Usage: node balance_sheet.mjs <inputCsvFile> [outputCsvFile]');
  process.exit(1);
}

const inputPath = path.join(__dirname, inputFileName);

if (!fs.existsSync(inputPath)) {
  console.error(`Error: input file not found: ${inputPath}`);
  process.exit(1);
}

const outputPath = path.join(__dirname, outputFileName);

// --- helpers: CSV parsing & escaping ---

/**
 * Parse a single CSV line with simple quote handling.
 * Expected CBA layout: date, amount, description, balance
 */
function parseCSVLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);

  if (parts.length < 3) {
    return null;
  }

  const rawDate = parts[0]?.trim() ?? '';
  const rawAmount = parts[1]?.trim().replace(/[+"]/g, '') ?? '';
  const rawDescription = parts[2]?.trim().replace(/"/g, '') ?? '';
  const rawBalance = parts[3]
    ? parts[3].trim().replace(/[+"]/g, '')
    : '';

  if (!rawDate || !rawAmount) {
    return null;
  }

  const amount = parseFloat(rawAmount);
  if (Number.isNaN(amount)) {
    return null;
  }

  return {
    date: rawDate,
    amount,
    description: rawDescription,
    balance: rawBalance,
  };
}

/**
 * Escape value for CSV output.
 */
function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// --- heuristics for classification ---

// Vendors that are clearly business related (raw material, suppliers, platforms, etc.)
const BUSINESS_EXPENSE_KEYWORDS = [
  // Known suppliers and food related
  'foodlink',
  'food link',
  'food-link',
  'tong li',
  'asian city',
  'joy mart',
  'joymart',
  'yaochii',
  'lclimited',
  'lc limited',
  // Common business words
  'pty',
  'ltd',
  'pty ltd',
  'company',
  'trading',
  'group',
  'invoice',
  'inv',
  // Software / online services
  'stripe',
  'midjourney',
  'xero',
  'myob',
  'shopify',
  'google cloud',
  'aws',
  'digitalocean',
  // Utilities that are likely business (you may still need to review)
  'energy',
  'origin',
  'agl',
  'electricity',
  'water corp',
  'synergy',
  // Local council / rates / permits (business related for shop)
  'willoughby city counci',
  'willoughby city council',
  // Company / regulatory / known business-only merchants
  'asic',
  'basicingred',
  'whats cooking',
];

// Keywords that are very likely personal only (school, shopping mall, etc.)
const PERSONAL_EXPENSE_KEYWORDS = [
  // School / education / kids
  'school',
  'college',
  'university',
  'uni ',
  'childcare',
  'kinder',
  'kindy',
  'montessori',
  'tuition',
  'music school',
  'swim school',
  'swimming school',
  // Retail & malls
  'kmart',
  'target',
  'myer',
  'david jones',
  'ikea',
  'jb hi-fi',
  'harvey norman',
  'bunnings',
  'officeworks',
  'big w',
  'jd sports',
  'foot locker',
  'uniqlo',
  'h&m',
  // Online / subscriptions mostly personal
  'netflix',
  'spotify',
  'stan ',
  'youtube premium',
  'disney+',
  'disney plus',
  'amazon prime',
  // Healthcare / pharmacy
  'chemist',
  'pharmacy',
  'dentist',
  'optometrist',
  'optical',
  'clinic',
  'gp ',
  // Obvious pure personal
  'restaurant',
  'cafe ',
  'coffee',
  'hair',
  'beauty',
  'spa ',
  'salon',
  // Known personal names (internal transfers)
  ' baron ',
  ' kaylee ',
];

// Large supermarket names: could be either business or personal.
// We keep them as "unknown" so that you can manually decide later.
const SUPERMARKET_KEYWORDS = [
  'woolworths',
  'coles',
  'aldi',
  'iga ',
  'costco',
];

// Possible supplier / mixed business vendors: always mark as unknown for review
const POSSIBLE_SUPPLIER_KEYWORDS = [
  'barcodel australia',
  'foodlink australia pty ltd',
  'taobao yearly summary',
  'equipmentbrand',
  'independent technician',
  'kuringgui council',
  'ku ringgui council',
  'kuring gai council',
  'sydneywater',
  'sydney water',
  'energyaustralia',
  'energy australia',
  'agl',
  'liquorland',
  '河南星宸',
  'success logistics sydney',
  '佳音海运',
  'jiayin',
  'freshcorp fruitmarket',
  'iga',
  'aldi',
  'bws',
  "jj'm butchery mart",
  '7-eleven',
  '7 eleven',
  'asian city',
  'super fresh grocer',
  'bnglee',
  'officeworks',
  'new yen yen supermarket',
  'eg fuelco (australia) limited',
  'eg fuelco',
  'coles local',
  'ww metro',
  'reddy express pyable',
  'coles',
  'tong li supermarket',
  'bunnings warehouse',
  'woolworths',
  'harris farm markets',
];

/**
 * Classify a transaction as company/personal/unknown.
 * This is heuristic and intentionally conservative:
 * - All income is "company"
 * - Expense defaults to "personal"
 *   - unless we match strong business keywords -> "company"
 *   - or supermarket keywords -> "unknown"
 */
function classifyTransaction(tx) {
  const { amount, description } = tx;
  const descLower = (description || '').toLowerCase();

  // Detect refund-like keywords for BOTH positive and negative amounts
  const isRefund =
    descLower.includes('refund') ||
    descLower.includes('refund purchase') ||
    descLower.includes('reversal');

  // Detect "business-like" patterns in description (for income / refunds)
  const isBusinessLikeIncome =
    BUSINESS_EXPENSE_KEYWORDS.some((kw) => descLower.includes(kw)) ||
    descLower.includes('inv') ||
    descLower.includes('invoice') ||
    descLower.includes('pty') ||
    descLower.includes('ltd') ||
    descLower.includes('company') ||
    descLower.includes('trading') ||
    descLower.includes('group');

  // Positive amount (incoming)
  if (amount > 0 && !isRefund) {
    // For CBA business account, all non-refund incoming amounts are
    // treated as company income (matching processTransactions.mjs behaviour)
    return {
      type: 'income',
      party: 'company',
      confidence: 'high',
      reason: 'amount > 0 and not a refund, treated as company income',
    };
  }

  // amount <= 0 OR isRefund => expense or refund
  const absAmount = Math.abs(amount);

  // Possible supplier / mixed vendors -> always unknown, need manual review
  if (
    POSSIBLE_SUPPLIER_KEYWORDS.some((kw) => descLower.includes(kw))
  ) {
    return {
      type: isRefund ? 'refund' : 'expense',
      party: 'unknown',
      confidence: 'medium',
      reason: 'matches possible supplier keyword, requires manual review',
    };
  }

  // Business expense / refund keywords
  if (
    BUSINESS_EXPENSE_KEYWORDS.some((kw) => descLower.includes(kw))
  ) {
    return {
      type: isRefund ? 'refund' : 'expense',
      party: 'company',
      confidence: 'high',
      reason: 'matched business expense keyword',
    };
  }

  // Supermarket: unknown by default
  if (SUPERMARKET_KEYWORDS.some((kw) => descLower.includes(kw))) {
    return {
      type: isRefund ? 'refund' : 'expense',
      party: 'unknown',
      confidence: 'medium',
      reason: 'supermarket transaction, requires manual review',
    };
  }

  // Personal-like keywords
  if (
    PERSONAL_EXPENSE_KEYWORDS.some((kw) => descLower.includes(kw))
  ) {
    return {
      type: isRefund ? 'refund' : 'expense',
      party: 'personal',
      confidence: 'high',
      reason: 'matched personal expense keyword',
    };
  }

  // Large amount that looks like government / ASIC / tax etc. -> likely business
  if (
    absAmount >= 1000 &&
    (descLower.includes('ato') ||
      descLower.includes('tax') ||
      descLower.includes('asic'))
  ) {
    return {
      type: isRefund ? 'refund' : 'expense',
      party: 'company',
      confidence: 'medium',
      reason: 'large amount with government/tax keyword',
    };
  }

  // Default: treat as personal to be conservative for tax purpose
  return {
    type: isRefund ? 'refund' : 'expense',
    party: 'personal',
    confidence: 'low',
    reason: 'no strong keyword matched, default to personal',
  };
}

// --- main processing ---

const rawContent = fs.readFileSync(inputPath, 'utf-8');
const rawLines = rawContent
  .split('\n')
  .map((l) => l.replace(/\r$/, ''))
  .filter((line) => line.trim() !== '');

// Try to detect header: if first line contains non-numeric amount column, treat as header
let startIndex = 0;
let headerLine = null;
if (rawLines.length > 0) {
  const maybeHeader = parseCSVLine(rawLines[0]);
  if (!maybeHeader || Number.isNaN(parseFloat(maybeHeader.amount))) {
    headerLine = rawLines[0];
    startIndex = 1;
  }
}

const transactions = [];
for (let i = startIndex; i < rawLines.length; i++) {
  const parsed = parseCSVLine(rawLines[i]);
  if (!parsed) continue;
  transactions.push(parsed);
}

if (transactions.length === 0) {
  console.error('No valid transactions parsed from CSV.');
  process.exit(1);
}

let companyIncome = 0;
let personalIncome = 0;
let companyExpense = 0;
let personalExpense = 0;
let unknownExpense = 0;

const classifiedRows = [];

transactions.forEach((tx) => {
  const result = classifyTransaction(tx);
  const { type, party } = result;

  if (type === 'income') {
    if (party === 'company') {
      companyIncome += tx.amount;
    } else {
      personalIncome += tx.amount;
    }
  } else if (type === 'expense' || type === 'refund') {
    const value = Math.abs(tx.amount);
    if (party === 'company') {
      companyExpense += value;
    } else if (party === 'personal') {
      personalExpense += value;
    } else {
      unknownExpense += value;
    }
  }

  classifiedRows.push({
    ...tx,
    type,
    party,
    confidence: result.confidence,
    reason: result.reason,
  });
});

// --- write output CSV ---

const headerCols = [
  'Date',
  'Amount',
  'Description',
  'Balance',
  'Type',
  'Party',
  'Confidence',
  'Reason',
];

let out = '';
out += headerCols.map(csvEscape).join(',') + '\n';

classifiedRows.forEach((row) => {
  const cols = [
    row.date,
    row.amount,
    row.description,
    row.balance,
    row.type,
    row.party,
    row.confidence,
    row.reason,
  ];
  out += cols.map(csvEscape).join(',') + '\n';
});

fs.writeFileSync(outputPath, out, 'utf-8');

// --- console summary ---

console.log('='.repeat(80));
console.log('CBA CSV classification summary');
console.log('='.repeat(80));
console.log(`Input file : ${inputPath}`);
console.log(`Output file: ${outputPath}\n`);

console.log('Income summary (amount > 0):');
console.log(`  Company income : $${companyIncome.toFixed(2)}`);
console.log(`  Personal income: $${personalIncome.toFixed(2)}\n`);

console.log('Expense summary (absolute values):');
console.log(`  Company expense : $${companyExpense.toFixed(2)}`);
console.log(`  Personal expense: $${personalExpense.toFixed(2)}`);
console.log(`  Unknown expense : $${unknownExpense.toFixed(2)}\n`);

console.log(
  'Note: "unknown" and low-confidence rows should be reviewed manually before final tax figures.'
);


