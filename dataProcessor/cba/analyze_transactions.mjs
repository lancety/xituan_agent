import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get filename from command line arguments
const fileName = process.argv[2] || 'CSVData.csv';
const filePath = path.join(__dirname, fileName);

if (!fs.existsSync(filePath)) {
  console.error(`错误: 文件不存在: ${filePath}`);
  process.exit(1);
}

// Read and parse CSV file
const fileContent = fs.readFileSync(filePath, 'utf-8');
const lines = fileContent.split('\n').filter(line => line.trim() !== '');

// Exclude keywords
const excludeKeywords = ['joymart', 'yaochii', 'dragon bay'];

// Business-related keywords (invoice numbers, company names, etc.)
const businessKeywords = [
  'inv', 'invoice', 'pty', 'ltd', 'company', 'trading', 'group',
  'xtc', 'jipo', 'uco', 'uvo', 'refund', 'credit to account'
];

// Parse CSV line
function parseCSVLine(line) {
  const parts = [];
  let currentPart = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      parts.push(currentPart);
      currentPart = '';
    } else {
      currentPart += char;
    }
  }
  parts.push(currentPart);
  
  if (parts.length < 3) return null;
  
  const date = parts[0].trim();
  const amountStr = parts[1].trim().replace(/[+"]/g, '');
  const description = parts[2].trim().replace(/"/g, '');
  const balance = parts[3] ? parts[3].trim().replace(/[+"]/g, '') : '';
  
  const amount = parseFloat(amountStr);
  if (isNaN(amount)) return null;
  
  return { date, amount, description, balance };
}

// Extract payer name from description
function extractPayerName(description) {
  // Remove common prefixes
  let name = description
    .replace(/^Fast Transfer From /i, '')
    .replace(/^Direct Credit \d+ /i, '')
    .replace(/^Transfer from /i, '')
    .replace(/^Refund Purchase /i, '');
  
  // Extract the main name (usually before the first space or special character)
  // For "MING HUANG INV20250529001 Joymart" -> "MING HUANG"
  // For "YAOCHII PTY LTD Yaochii" -> "YAOCHII PTY LTD"
  // For "MISS JIEXING YI Jiexing" -> "MISS JIEXING YI"
  
  // Try to extract company/entity name
  const parts = name.split(/\s+/);
  
  // Check for PTY LTD, LTD, etc.
  const ptyLtdIndex = parts.findIndex(p => p.toUpperCase() === 'PTY' || p.toUpperCase() === 'LTD');
  if (ptyLtdIndex !== -1) {
    return parts.slice(0, ptyLtdIndex + 2).join(' ');
  }
  
  // Check for common patterns like "MISS", "MR", "MRS", "MS", "DR"
  const titleIndex = parts.findIndex(p => 
    ['MISS', 'MR', 'MRS', 'MS', 'DR'].includes(p.toUpperCase())
  );
  
  if (titleIndex !== -1 && parts.length > titleIndex + 2) {
    // Usually format is "TITLE FIRSTNAME LASTNAME" or "TITLE FIRSTNAME LASTNAME nickname"
    // Take first 3-4 parts
    return parts.slice(0, Math.min(titleIndex + 3, parts.length)).join(' ');
  }
  
  // For other cases, take first 2-3 words
  return parts.slice(0, Math.min(3, parts.length)).join(' ');
}

// Normalize payer name (remove variations)
function normalizePayerName(name) {
  // Remove common suffixes and variations
  let normalized = name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove common patterns
  normalized = normalized
    .replace(/\s+(CREDIT TO ACCOUNT|CAKE|CUPCAKE|BAKERY|DESSERT).*$/i, '')
    .replace(/\s+(INV|XTC|JIPO|UCO|UVO)\d+.*$/i, '')
    .replace(/\s+(INV|XTC|JIPO|UCO|UVO).*$/i, '')
    .replace(/\s+\d+F.*$/i, '') // Remove floor numbers like "32F", "8F"
    .replace(/\s+_.*$/i, '') // Remove trailing underscores
    .trim();
  
  return normalized;
}

// Check if description contains business-related keywords
function isBusinessRelated(description) {
  const descLower = description.toLowerCase();
  return businessKeywords.some(keyword => descLower.includes(keyword));
}

// Process all transactions
const transactions = [];
const payerStats = new Map(); // payer name -> { count, totalAmount, transactions, isBusiness }

lines.forEach((line, index) => {
  const transaction = parseCSVLine(line);
  if (!transaction) return;
  
  // Skip refunds
  if (transaction.description.toLowerCase().includes('refund purchase')) {
    return;
  }
  
  // Check if should be excluded
  const descLower = transaction.description.toLowerCase();
  const shouldExclude = excludeKeywords.some(keyword => descLower.includes(keyword));
  if (shouldExclude) return;
  
  const payerName = extractPayerName(transaction.description);
  const normalizedName = normalizePayerName(payerName);
  
  if (!payerStats.has(normalizedName)) {
    payerStats.set(normalizedName, {
      count: 0,
      totalAmount: 0,
      transactions: [],
      isBusiness: isBusinessRelated(transaction.description),
      originalNames: new Set()
    });
  }
  
  const stats = payerStats.get(normalizedName);
  stats.count++;
  stats.totalAmount += transaction.amount;
  stats.transactions.push(transaction);
  stats.originalNames.add(payerName);
  if (isBusinessRelated(transaction.description)) {
    stats.isBusiness = true;
  }
});

// Convert to array and sort by count (descending)
const payerArray = Array.from(payerStats.entries())
  .map(([name, stats]) => ({
    name,
    ...stats,
    originalNames: Array.from(stats.originalNames)
  }))
  .sort((a, b) => b.count - a.count);

// Filter: multiple transactions (>= 2) or business-related
const filteredPayers = payerArray.filter(p => p.count >= 2 || p.isBusiness);

console.log('='.repeat(80));
console.log('转账记录分析结果');
console.log('='.repeat(80));
console.log(`\n总交易数: ${transactions.length}`);
console.log(`排除 joymart/yaochii/dragon bay 后的付款人数: ${payerStats.size}`);
console.log(`固定付款人（多笔转账）或业务相关转入: ${filteredPayers.length}\n`);

// Group by category
const multipleTransactions = filteredPayers.filter(p => p.count >= 2 && !p.isBusiness);
const businessRelated = filteredPayers.filter(p => p.isBusiness);
const both = filteredPayers.filter(p => p.count >= 2 && p.isBusiness);

console.log('分类统计:');
console.log(`  1. 固定付款人多笔转账（>=2笔，非业务）: ${multipleTransactions.length}`);
console.log(`  2. 业务相关转入（含发票号/公司名等）: ${businessRelated.length}`);
console.log(`  3. 两者兼有: ${both.length}\n`);

// Display results
console.log('\n' + '='.repeat(80));
console.log('1. 固定付款人 - 多笔转账（>=2笔）');
console.log('='.repeat(80));
multipleTransactions.forEach((payer, index) => {
  console.log(`\n${index + 1}. ${payer.name}`);
  console.log(`   转账次数: ${payer.count}`);
  console.log(`   总金额: $${payer.totalAmount.toFixed(2)}`);
  console.log(`   平均金额: $${(payer.totalAmount / payer.count).toFixed(2)}`);
  if (payer.originalNames.length > 1) {
    console.log(`   名称变体: ${payer.originalNames.join(', ')}`);
  }
  console.log(`   最近3笔:`);
  payer.transactions.slice(0, 3).forEach(t => {
    console.log(`     - ${t.date}: $${t.amount.toFixed(2)} - ${t.description.substring(0, 60)}`);
  });
});

console.log('\n' + '='.repeat(80));
console.log('2. 业务相关转入（含发票号、公司名等关键词）');
console.log('='.repeat(80));
businessRelated
  .filter(p => !multipleTransactions.includes(p)) // Exclude those already shown
  .forEach((payer, index) => {
    console.log(`\n${index + 1}. ${payer.name}`);
    console.log(`   转账次数: ${payer.count}`);
    console.log(`   总金额: $${payer.totalAmount.toFixed(2)}`);
    if (payer.originalNames.length > 1) {
      console.log(`   名称变体: ${payer.originalNames.join(', ')}`);
    }
    console.log(`   交易记录:`);
    payer.transactions.forEach(t => {
      console.log(`     - ${t.date}: $${t.amount.toFixed(2)} - ${t.description}`);
    });
  });

console.log('\n' + '='.repeat(80));
console.log('3. 固定付款人 + 业务相关（两者兼有）');
console.log('='.repeat(80));
both.forEach((payer, index) => {
  console.log(`\n${index + 1}. ${payer.name}`);
  console.log(`   转账次数: ${payer.count}`);
  console.log(`   总金额: $${payer.totalAmount.toFixed(2)}`);
  console.log(`   平均金额: $${(payer.totalAmount / payer.count).toFixed(2)}`);
  if (payer.originalNames.length > 1) {
    console.log(`   名称变体: ${payer.originalNames.join(', ')}`);
  }
  console.log(`   所有交易:`);
  payer.transactions.forEach(t => {
    console.log(`     - ${t.date}: $${t.amount.toFixed(2)} - ${t.description}`);
  });
});

// Summary table
console.log('\n' + '='.repeat(80));
console.log('汇总表格（按转账次数排序）');
console.log('='.repeat(80));
console.log('\n付款人名称 | 转账次数 | 总金额 | 平均金额 | 业务相关');
console.log('-'.repeat(80));
filteredPayers.forEach(payer => {
  const businessFlag = payer.isBusiness ? '✓' : '';
  console.log(
    `${payer.name.padEnd(30)} | ${String(payer.count).padStart(4)} | ` +
    `$${payer.totalAmount.toFixed(2).padStart(10)} | ` +
    `$${(payer.totalAmount / payer.count).toFixed(2).padStart(8)} | ` +
    `${businessFlag}`
  );
});



