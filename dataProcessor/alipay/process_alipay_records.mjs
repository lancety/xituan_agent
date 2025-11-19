#!/usr/bin/env node
/**
 * Process Alipay transaction records for bakery business tax reporting
 * Extract and categorize orders into raw materials, consumables, and equipment
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Category keywords - expanded to catch more bakery-related items
const RAW_MATERIAL_KEYWORDS = [
  '预拌粉', '面粉', '果酱', '馅料', '糖', '奶油', '黄油', '芝士', '奶酪',
  '酵母', '改良剂', '果胶', '巧克力', '可可', '抹茶', '香草', '杏仁',
  '开心果', '红豆沙', '绿豆', '莲蓉', '奶黄', '枣泥', '五仁', '凤梨',
  '紫薯', '黑芝麻', '麻薯', '大米', '烘焙原料', '烘焙材料', '原料', '材料',
  '果粒', '草莓', '鸡蛋', '蛋', '牛奶', '酸奶', '淡奶油', '鲜奶油',
  '白砂糖', '糖粉', '蜂蜜', '麦芽糖', '果干', '坚果', '核桃', '腰果',
  '葡萄干', '蔓越莓', '蓝莓', '柠檬', '橙子', '香草精', '食用色素',
  '泡打粉', '小苏打', '塔塔粉', '吉利丁', '明胶', '琼脂', '淀粉', '玉米淀粉'
];

const CONSUMABLE_KEYWORDS = [
  '包装盒', '包装袋', '贴纸', '标签', '纸杯', '模具', '裱花', '油纸',
  '保鲜袋', '打包袋', '自封袋', '透明袋', '保温袋', '冷藏袋', '保鲜袋',
  '蛋糕盒', '面包盒', '甜品盒', '慕斯盒', '切块盒', '打包盒', '围边',
  '纸托', '马芬杯', '裱花袋', '裱花嘴', '装饰', '插件', '摆件', '插牌',
  '蜡烛', '贴纸', '不干胶', '封口贴', 'logo', '二维码', '吸管', '餐具',
  '刀叉', '纸盘', '手套', '一次性', '蒸笼纸', '蒸笼垫', '笼布', '烘焙',
  '蛋糕', '面包', '甜品', '西点', '点心', '打包', '外卖', '配送',
  '布丁杯', '舒芙蕾杯', '烧杯',
  '标签机', '标签纸', '打印纸', '热敏标签',
  '可可百利', '薄脆片', '饼干脆片', '慕斯碎片',
  '三洋糕粉', '熟糯米粉', '防粘手粉',
  'MOMAX', '摩米士', '转换插头', '转换器',
  '冰格袋', '冰袋', '保鲜冷冻包', '冷冻包',
  '美工刀', '壁纸刀', '开箱刀', '裁纸刀', '手工刀',
  '保软剂', '保软酶', '保软保糯', '米制品保软剂'
];

const EQUIPMENT_KEYWORDS = [
  '压面机', '揉面机', '擀面机', '面条机', '打蛋器', '奶泡器', '封口机',
  '烤箱', '烤盘', '蛋糕模', '面包模', '模具', '切蛋糕', '分片器', '分割器',
  '打奶泡', '糖艺灯', '拉糖', '翻糖', '发酵', '风炉', '平炉',
  '抹胚机', '抹面机', '摸胚机', '摸面机',
  '千层蛋糕皮机', '春卷皮机', '班戟皮机', '蛋皮机',
  '双温柜', '冷藏柜', '冷藏冷冻', '工作台冰箱', '冰箱',
  '洞洞板', '货架', '展示架',
  '炒馅机'
];

// Absolutely exclude keywords (definitely not bakery related)
const ABSOLUTE_EXCLUDE_KEYWORDS = [
  '花呗', '还款', '话费', '电影票', '衣服', '服装', '睡衣', '内衣', 'T恤',
  '牛仔裤', '短裤', '外套', '鞋子', '袜子', '包', '箱', '收纳', '钥匙',
  '化妆品', '药', '药品', '保健品', '茶', '花茶', '泡脚', '足浴', '血氧仪',
  '制氧机', '呼吸机', '轮椅', '矫正器', '拇指外翻', '自行车', '山地车',
  '公路车', '骑行', '水壶', '电池', '电机', '3D打印', '麻将机', '樟木箱',
  '相框', '照片', '充电', '数据线', '洗漱包', '玩具', '水枪', '捏捏乐',
  '小红书', '菜鸟', '寄件费', '转运', '税费费用', '海外税费',
  '国际转运', '补差价', '运费', '邮费', '补差', '补运费', '补胎', '牙刷',
  '羊肉粉', '牛肉粉', '米粉', '小吃', '速食', '方便', '土特产', '零食',
  '果脯', '蜜饯', '水城', '六盘水', '遵义', '花溪', '血糖', '太阳能',
  '牙科', '口腔', '补胎', '轮胎', '硫化', '胶条', '光轴', '固定环',
  '轴承', '锁紧环', '限位环', '轴套', '定位圈', 'PETG', '打印耗材',
  '防冻液', '冷却液', '地暖', '锅炉', '暖气', '暖气片', '壁挂炉', '采暖',
  '汽车', '摩托', '电动车', '助力车', '代步车',
  // Note: 洞洞板、双温柜、标签机等已移到设备/耗材关键词，不在此排除
];

// Business-related software/services keywords (for design, marketing, etc.)
// Only match specific software/service names to avoid false positives
const BUSINESS_SOFTWARE_KEYWORDS = [
  'Midjourney', 'midjourney', 'Stripe', 'STRIPE'
];

// Possibly related keywords (might be bakery related, need manual review)
const POSSIBLY_RELATED_KEYWORDS = [
  '超市', 'Supermarket', 'Chemist', 'Warehouse', 'Tong Li', 'ASIAN CITY',
  'NEW YEN YEN', 'JOY MART', 'YAOCHII', 'LCLIMITED'
];

function categorizeProduct(productName, amount = 0, excludeInfo = {}) {
  if (!productName) {
    excludeInfo.reason = '产品名称为空';
    excludeInfo.type = 'absolute';
    return { category: 'other', excludeInfo };
  }
  
  // FIRST: Check if it matches bakery-related keywords (before exclude check)
  // Check equipment keywords (more specific, check first)
  let matchedEquipment = false;
  for (const keyword of EQUIPMENT_KEYWORDS) {
    if (productName.includes(keyword)) {
      // But exclude if it's just a mold (模具) which could be consumable
      if (keyword === '模具' && (productName.includes('一次性') || productName.includes('纸'))) {
        continue;
      }
      matchedEquipment = true;
      break;
    }
  }
  
  // If matched equipment keyword, check if amount is less than 300
  // Tools under 300 should be categorized as consumables
  if (matchedEquipment && amount < 300) {
    return { category: 'consumable', excludeInfo: null };
  } else if (matchedEquipment) {
    return { category: 'equipment', excludeInfo: null };
  }
  
  // Check raw material keywords
  for (const keyword of RAW_MATERIAL_KEYWORDS) {
    if (productName.includes(keyword)) {
      return { category: 'raw_material', excludeInfo: null };
    }
  }
  
  // Check consumable keywords
  for (const keyword of CONSUMABLE_KEYWORDS) {
    if (productName.includes(keyword)) {
      return { category: 'consumable', excludeInfo: null };
    }
  }
  
  // SECOND: Check exclude keywords (only if not matched bakery keywords)
  // But use more precise matching for ambiguous keywords like "包"
  const ambiguousKeywords = ['包', '箱', '收纳', '茶', '零食', '充电', '米粉', '服装'];
  for (const keyword of ABSOLUTE_EXCLUDE_KEYWORDS) {
    if (productName.includes(keyword)) {
      // For ambiguous keywords, only exclude if it's clearly not bakery-related
      if (ambiguousKeywords.includes(keyword)) {
        // Check if it's part of a bakery term (e.g., "面包", "包装", "蛋糕盒")
        const bakeryContext = ['面包', '包装', '蛋糕', '甜品', '烘焙', '面包盒', '蛋糕盒', '包装盒', '包装袋', '打包', '外卖', '布丁杯', '舒芙蕾', '烧杯', '标签机', '标签纸', '可可百利', '薄脆片', '三洋糕粉', '熟糯米粉', '洞洞板', '双温柜', '冷藏柜', '转换插头', '转换器', '冰格袋', '冰袋', '保鲜冷冻', '冷冻包', '美工刀', '壁纸刀', '裁纸刀', '保软剂', '保软酶', '保软保糯', '雪媚娘', '驴打滚', '糯米果', '冰皮月饼'];
        const hasBakeryContext = bakeryContext.some(ctx => productName.includes(ctx));
        if (hasBakeryContext) {
          continue; // Skip this exclude keyword, it's bakery-related
        }
      }
      excludeInfo.reason = `包含绝对排除关键词: ${keyword}`;
      excludeInfo.type = 'absolute';
      return { category: 'other', excludeInfo };
    }
  }
  
  // Check possibly related keywords (might need manual review)
  let isPossiblyRelated = false;
  let possibleReason = '';
  for (const keyword of POSSIBLY_RELATED_KEYWORDS) {
    if (productName.includes(keyword)) {
      isPossiblyRelated = true;
      possibleReason = `可能相关（超市/商店购物，需确认是否包含烘焙用品）: ${keyword}`;
      break;
    }
  }
  
  // If possibly related, mark for manual review
  if (isPossiblyRelated) {
    excludeInfo.reason = possibleReason;
    excludeInfo.type = 'possibly_related';
    return { category: 'other', excludeInfo };
  }
  
  // Otherwise, mark as unrelated
  excludeInfo.reason = '未匹配到烘焙相关关键词';
  excludeInfo.type = 'possibly_related'; // Let user decide
  return { category: 'other', excludeInfo };
}

function parseAmount(amountStr) {
  try {
    return parseFloat(amountStr.trim()) || 0;
  } catch (e) {
    return 0;
  }
}

function parseAlipayFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const records = [];
  
  // Skip header lines (first 5 lines)
  for (let i = 5; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('-') || line.includes('共') || 
        line.includes('已收入') || line.includes('待收入') || 
        (line.includes('已支出') && !line.includes('支出      ,交易成功')) || 
        line.includes('待支出') || 
        line.includes('导出时间')) {
      continue;
    }
    
    // Data format: first 2 fields separated by tab, rest in 3rd field separated by comma
    const tabParts = line.split('\t');
    if (tabParts.length < 3) {
      continue;
    }
    
    const transactionId = tabParts[0]?.trim() || '';
    const orderId = tabParts[1]?.replace(/^[,\s]+/, '').trim() || '';
    const restFields = tabParts[2]?.split(',').map(p => p.trim()) || [];
    
    if (restFields.length < 11) {
      continue;
    }
    
    // Extract fields from restFields: [0]=empty, [1]=交易创建时间, [2]=付款时间, [3]=最近修改时间, [4]=交易来源地, [5]=类型, [6]=交易对方, [7]=商品名称, [8]=金额（元）, [9]=收/支, [10]=交易状态
    const createTime = restFields[1] || '';
    const payTime = restFields[2] || '';
    const source = restFields[4] || ''; // 交易来源地
    const counterparty = restFields[6] || ''; // 交易对方
    const productName = restFields[7] || '';
    const amount = parseAmount(restFields[8] || '0');
    const transactionType = (restFields[9] || '').trim();
    const status = (restFields[10] || '').trim();
    
    // Only process successful expense transactions
    if (transactionType.includes('支出') && status.includes('交易成功')) {
      // Check if it's business-related software/service first (e.g., Midjourney for design)
      // Only match if product name contains the keyword (not just any text)
      const isBusinessSoftware = BUSINESS_SOFTWARE_KEYWORDS.some(keyword => {
        if (keyword === 'Stripe' || keyword === 'STRIPE') {
          // For Stripe, check if counterparty is Stripe Inc and product is STRIPE
          return counterparty.includes('Stripe') && productName.includes('STRIPE');
        }
        return productName.includes(keyword);
      });
      
      if (isBusinessSoftware) {
        // Business software/services should be categorized as consumables (design tools, etc.)
        records.push({
          transactionId,
          orderId,
          payTime,
          productName,
          amount,
          category: 'consumable',
          excludeInfo: null,
          source,
          counterparty
        });
      } else {
        // Check if it's overseas payment
        const isOverseasPayment = source.includes('阿里巴巴和外部商家') || 
                                    productName.includes('海外税费费用');
        
        if (isOverseasPayment) {
          records.push({
            transactionId,
            orderId,
            payTime,
            productName,
            amount,
            category: 'overseas_payment',
            excludeInfo: null,
            source,
            counterparty
          });
        } else {
          const excludeInfo = {};
          const result = categorizeProduct(productName, amount, excludeInfo);
          const category = result.category;
          
          records.push({
            transactionId,
            orderId,
            payTime,
            productName,
            amount,
            category,
            excludeInfo: result.excludeInfo,
            source,
            counterparty
          });
        }
      }
    }
  }
  
  return records;
}

function writeOrderList(records, outputFile, categories) {
  const filteredRecords = records.filter(r => categories.includes(r.category));
  
  let csv = '\uFEFF订单号,支付日期时间,产品名称,价格（元）\n';
  
  for (const record of filteredRecords) {
    csv += `"${record.orderId}","${record.payTime}","${record.productName}","${record.amount.toFixed(2)}"\n`;
  }
  
  fs.writeFileSync(outputFile, csv, 'utf-8');
}

function writeStatistics(records, outputFile) {
  const rawMaterialRecords = records.filter(r => r.category === 'raw_material');
  const consumableRecords = records.filter(r => r.category === 'consumable');
  const equipmentRecords = records.filter(r => r.category === 'equipment');
  const overseasPaymentRecords = records.filter(r => r.category === 'overseas_payment');
  const otherRecords = records.filter(r => r.category === 'other');
  
  const rawMaterialCount = rawMaterialRecords.length;
  const rawMaterialTotal = rawMaterialRecords.reduce((sum, r) => sum + r.amount, 0);
  
  const consumableCount = consumableRecords.length;
  const consumableTotal = consumableRecords.reduce((sum, r) => sum + r.amount, 0);
  
  const equipmentCount = equipmentRecords.length;
  const equipmentTotal = equipmentRecords.reduce((sum, r) => sum + r.amount, 0);
  
  const overseasPaymentCount = overseasPaymentRecords.length;
  const overseasPaymentTotal = overseasPaymentRecords.reduce((sum, r) => sum + r.amount, 0);
  
  const otherCount = otherRecords.length;
  const otherTotal = otherRecords.reduce((sum, r) => sum + r.amount, 0);
  
  const totalCount = rawMaterialCount + consumableCount + equipmentCount + overseasPaymentCount + otherCount;
  const totalAmount = rawMaterialTotal + consumableTotal + equipmentTotal + overseasPaymentTotal + otherTotal;
  
  // Format as text file with clear layout
  let text = '='.repeat(60) + '\n';
  text += '                   支付宝交易记录处理统计\n';
  text += '='.repeat(60) + '\n\n';
  
  text += '类别统计：\n';
  text += '-'.repeat(60) + '\n';
  text += `原材料        : ${rawMaterialCount.toString().padStart(4)} 笔    ${rawMaterialTotal.toFixed(2).padStart(12)} 元\n`;
  text += `耗材          : ${consumableCount.toString().padStart(4)} 笔    ${consumableTotal.toFixed(2).padStart(12)} 元\n`;
  text += `设备          : ${equipmentCount.toString().padStart(4)} 笔    ${equipmentTotal.toFixed(2).padStart(12)} 元\n`;
  text += `海外支付      : ${overseasPaymentCount.toString().padStart(4)} 笔    ${overseasPaymentTotal.toFixed(2).padStart(12)} 元\n`;
  text += `其他不相关    : ${otherCount.toString().padStart(4)} 笔    ${otherTotal.toFixed(2).padStart(12)} 元\n`;
  text += '-'.repeat(60) + '\n';
  text += `合计          : ${totalCount.toString().padStart(4)} 笔    ${totalAmount.toFixed(2).padStart(12)} 元\n`;
  text += '='.repeat(60) + '\n';
  
  // Add percentage breakdown
  text += '\n占比分析：\n';
  text += '-'.repeat(60) + '\n';
  if (totalAmount > 0) {
    text += `原材料        : ${((rawMaterialTotal / totalAmount) * 100).toFixed(2)}%\n`;
    text += `耗材          : ${((consumableTotal / totalAmount) * 100).toFixed(2)}%\n`;
    text += `设备          : ${((equipmentTotal / totalAmount) * 100).toFixed(2)}%\n`;
    text += `海外支付      : ${((overseasPaymentTotal / totalAmount) * 100).toFixed(2)}%\n`;
    text += `其他不相关    : ${((otherTotal / totalAmount) * 100).toFixed(2)}%\n`;
  }
  text += '='.repeat(60) + '\n';
  
  fs.writeFileSync(outputFile, text, 'utf-8');
}

function writeExcludedList(records, outputFile) {
  const excludedRecords = records.filter(r => r.category === 'other' && r.excludeInfo);
  
  // Separate into two groups
  const absoluteExcluded = excludedRecords.filter(r => r.excludeInfo.type === 'absolute');
  const possiblyRelated = excludedRecords.filter(r => r.excludeInfo.type === 'possibly_related');
  
  let csv = '\uFEFF订单号,支付日期时间,产品名称,价格（元）,排除原因\n';
  
  // Group 1: Absolutely unrelated
  csv += '\n=== 绝对不相干 ===\n';
  for (const record of absoluteExcluded) {
    csv += `"${record.orderId}","${record.payTime}","${record.productName}","${record.amount.toFixed(2)}","${record.excludeInfo.reason}"\n`;
  }
  
  // Group 2: Possibly related (need manual review)
  csv += '\n=== 不直接相关但有可能，需要人工确认 ===\n';
  for (const record of possiblyRelated) {
    csv += `"${record.orderId}","${record.payTime}","${record.productName}","${record.amount.toFixed(2)}","${record.excludeInfo.reason}"\n`;
  }
  
  fs.writeFileSync(outputFile, csv, 'utf-8');
  
  return {
    absoluteCount: absoluteExcluded.length,
    absoluteTotal: absoluteExcluded.reduce((sum, r) => sum + r.amount, 0),
    possiblyCount: possiblyRelated.length,
    possiblyTotal: possiblyRelated.reduce((sum, r) => sum + r.amount, 0)
  };
}

function main() {
  // Get input file from command line argument or use default
  const args = process.argv.slice(2);
  const inputFileName = args[0] || 'alipay_record_20251117_0831.txt';
  const inputFile = join(__dirname, inputFileName);
  
  // Check if file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`错误: 文件不存在: ${inputFile}`);
    console.error(`用法: node process_alipay_records.mjs [文件名]`);
    console.error(`示例: node process_alipay_records.mjs alipay_record_20251117_0831.txt`);
    process.exit(1);
  }
  
  console.log(`正在解析支付宝记录文件: ${inputFileName}...`);
  const records = parseAlipayFile(inputFile);
  console.log(`共解析 ${records.length} 条有效支出记录`);
  
  // Count by category
  const categoryCounts = {};
  const categoryTotals = {};
  for (const record of records) {
    categoryCounts[record.category] = (categoryCounts[record.category] || 0) + 1;
    categoryTotals[record.category] = (categoryTotals[record.category] || 0) + record.amount;
  }
  
  console.log('\n分类统计:');
  for (const [category, count] of Object.entries(categoryCounts)) {
    console.log(`  ${category}: ${count} 笔, 总计 ${categoryTotals[category].toFixed(2)} 元`);
  }
  
  // Generate output files
  console.log('\n正在生成输出文件...');
  
  // 1. 原材料耗材订单列表
  writeOrderList(records, join(__dirname, '原材料耗材订单列表.csv'), ['raw_material', 'consumable']);
  console.log('✓ 已生成: 原材料耗材订单列表.csv');
  
  // 2. 处理统计
  writeStatistics(records, join(__dirname, '处理统计.txt'));
  console.log('✓ 已生成: 处理统计.txt');
  
  // 3. 海外支付订单列表
  writeOrderList(records, join(__dirname, '海外支付订单列表.csv'), ['overseas_payment']);
  console.log('✓ 已生成: 海外支付订单列表.csv');
  
  // 4. 设备订单列表
  writeOrderList(records, join(__dirname, '设备订单列表.csv'), ['equipment']);
  console.log('✓ 已生成: 设备订单列表.csv');
  
  // 5. 排除列表
  const excludedStats = writeExcludedList(records, join(__dirname, '排除订单列表.csv'));
  console.log('✓ 已生成: 排除订单列表.csv');
  console.log(`  绝对不相干: ${excludedStats.absoluteCount} 笔, 总计 ${excludedStats.absoluteTotal.toFixed(2)} 元`);
  console.log(`  需要人工确认: ${excludedStats.possiblyCount} 笔, 总计 ${excludedStats.possiblyTotal.toFixed(2)} 元`);
  
  console.log('\n处理完成！');
}

main();

