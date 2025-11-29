import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get filename from command line arguments
const fileName = process.argv[2];

if (!fileName) {
  console.error('Error: Please provide a filename as the first parameter');
  console.error('Usage: node processTransactions.mjs <filename>');
  process.exit(1);
}

// Construct file path
const filePath = path.join(__dirname, fileName);

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

// Read and parse CSV file
try {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  
  // Keywords to match (case-insensitive)
  const joymartYaochiiKeywords = ['joymart', 'yaochii'];
  const dragonBayKeyword = 'dragon bay';
  
  // Groups
  const joymartYaochiiGroup = [];
  const dragonBayGroup = [];
  const otherGroup = [];
  const excludedRefunds = [];
  
  // Process each line
  lines.forEach((line, index) => {
    // Parse CSV line (handling quoted fields)
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
    parts.push(currentPart); // Add last part
    
    if (parts.length < 3) {
      console.warn(`Warning: Skipping line ${index + 1} - insufficient columns`);
      return;
    }
    
    const date = parts[0].trim();
    const amountStr = parts[1].trim().replace(/[+"]/g, ''); // Remove + and quotes
    const description = parts[2].trim().replace(/"/g, ''); // Remove quotes
    const balance = parts[3] ? parts[3].trim().replace(/[+"]/g, '') : '';
    
    // Parse amount
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount)) {
      console.warn(`Warning: Skipping line ${index + 1} - invalid amount: ${amountStr}`);
      return;
    }
    
    // Skip refund transactions
    const descriptionLower = description.toLowerCase();
    if (descriptionLower.includes('refund')) {
      excludedRefunds.push({
        date,
        amount,
        description
      });
      return; // Skip refund transactions
    }
    
    // Check if description contains any of the keywords (case-insensitive)
    const matchesJoymartYaochii = joymartYaochiiKeywords.some(keyword => 
      descriptionLower.includes(keyword.toLowerCase())
    );
    const matchesDragonBay = descriptionLower.includes(dragonBayKeyword.toLowerCase());
    
    const transaction = {
      date,
      amount,
      description,
      balance
    };
    
    if (matchesJoymartYaochii) {
      joymartYaochiiGroup.push(transaction);
    } else if (matchesDragonBay) {
      dragonBayGroup.push(transaction);
    } else {
      otherGroup.push(transaction);
    }
  });
  
  // Calculate sums
  const joymartYaochiiSum = joymartYaochiiGroup.reduce((sum, t) => sum + t.amount, 0);
  const dragonBaySum = dragonBayGroup.reduce((sum, t) => sum + t.amount, 0);
  const otherSum = otherGroup.reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate excluded refunds total
  const excludedRefundsSum = excludedRefunds.reduce((sum, t) => sum + t.amount, 0);
  
  // Display summary
  console.log('\n=== Summary ===\n');
  console.log(`Joymart/Yaochii: $${joymartYaochiiSum.toFixed(2)} (${joymartYaochiiGroup.length} transactions)`);
  console.log(`Dragon Bay: $${dragonBaySum.toFixed(2)} (${dragonBayGroup.length} transactions)`);
  console.log(`Other: $${otherSum.toFixed(2)} (${otherGroup.length} transactions)`);
  console.log(`Excluded Refunds: $${excludedRefundsSum.toFixed(2)} (${excludedRefunds.length} transactions)`);
  console.log(`Total (excluding refunds): $${(joymartYaochiiSum + dragonBaySum + otherSum).toFixed(2)}\n`);
  
  // Display detailed Joymart/Yaochii transactions
  if (joymartYaochiiGroup.length > 0) {
    console.log('=== Joymart/Yaochii Transactions Detail ===\n');
    joymartYaochiiGroup.forEach(t => {
      console.log(`${t.date} | $${t.amount.toFixed(2)} | ${t.description}`);
    });
    console.log('');
  }
  
  // Display detailed Excluded Refunds
  if (excludedRefunds.length > 0) {
    console.log('=== Excluded Refunds Detail ===\n');
    excludedRefunds.forEach(t => {
      console.log(`${t.date} | $${t.amount.toFixed(2)} | ${t.description}`);
    });
    console.log('');
  }
  
  // Generate statistics report file
  const outputFilePath = path.join(__dirname, '统计结果.txt');
  let reportContent = '';
  
  reportContent += '=== 转账记录统计结果 ===\n\n';
  reportContent += `处理文件: ${fileName}\n`;
  reportContent += `处理时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  
  reportContent += '=== 汇总统计 ===\n\n';
  reportContent += `Joymart/Yaochii: $${joymartYaochiiSum.toFixed(2)} (${joymartYaochiiGroup.length} 笔交易)\n`;
  reportContent += `Dragon Bay: $${dragonBaySum.toFixed(2)} (${dragonBayGroup.length} 笔交易)\n`;
  reportContent += `其他: $${otherSum.toFixed(2)} (${otherGroup.length} 笔交易)\n`;
  reportContent += `排除的退款: $${excludedRefundsSum.toFixed(2)} (${excludedRefunds.length} 笔交易)\n`;
  reportContent += `总计 (排除退款): $${(joymartYaochiiSum + dragonBaySum + otherSum).toFixed(2)}\n\n`;
  
  // Joymart/Yaochii transactions detail
  if (joymartYaochiiGroup.length > 0) {
    reportContent += '=== Joymart/Yaochii 交易明细 ===\n\n';
    joymartYaochiiGroup.forEach(t => {
      reportContent += `${t.date} | $${t.amount.toFixed(2)} | ${t.description}\n`;
    });
    reportContent += '\n';
  }
  
  // Dragon Bay transactions detail
  if (dragonBayGroup.length > 0) {
    reportContent += '=== Dragon Bay 交易明细 ===\n\n';
    dragonBayGroup.forEach(t => {
      reportContent += `${t.date} | $${t.amount.toFixed(2)} | ${t.description}\n`;
    });
    reportContent += '\n';
  }
  
  // Excluded Refunds detail
  if (excludedRefunds.length > 0) {
    reportContent += '=== 排除的退款明细 ===\n\n';
    excludedRefunds.forEach(t => {
      reportContent += `${t.date} | $${t.amount.toFixed(2)} | ${t.description}\n`;
    });
    reportContent += '\n';
  }
  
  // Write to file
  fs.writeFileSync(outputFilePath, reportContent, 'utf-8');
  console.log(`\n✅ 统计结果已保存到: ${outputFilePath}`);
  
} catch (error) {
  console.error('Error processing file:', error.message);
  process.exit(1);
}

