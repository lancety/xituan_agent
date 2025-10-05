// Additional cell addresses used in code (not listed in MD template order)
const gstA1Note = "H43";                        // GST amount
const discountA1Note = "J12";                   // Discount amount
const wholesalerA1Note = "J13";                 // wholesaler

// Email template range
const emailTempA1Note = "A1:A21";               // Email template content range

// Product data range constants
const productStartRow = 17;                      // First row of product data
const productStartCol = 2;                       // First column of product data (B)
const productRowCount = 22;                      // Number of product rows (17-34 = 18 rows)
const productColCount = 7;                       // Number of product columns (BCD merged + E + F + G + H)
// BCD is product name cell, E is product quantity cell, rest cells are dynamically generated
// so only clear BCDE, rest cells will be updated/cleared
const productClearCol2 = 5;    
  
const invoicePageEndRowCount = 10; // gst, total, signature, etc.


function priceCalcFormula(row) {
  return `=if($E${row}="", "", LET(priceCol, SWITCH($J$12, 0, if($J$13=1, "${prodColumn.wholeSalePrice}", "${prodColumn.price20}"),0.2,"${prodColumn.price20}",0.25,"${prodColumn.price25}",0.30,"${prodColumn.price30}"),SHEETCELLMATCH(prodHead,prodData,"${prodColumn.name_cn}",B${row},priceCol)))`
} 

function newInvoice() {
  const invoiceSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.invoice);
  invoiceHeaderDefault(invoiceSheet);
  invoiceProductListReset(invoiceSheet);
}

function saveInvoice() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const invoiceSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.invoice);
  const wholesaleSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.wholesale);
  const invoiceId = invoiceSheet.getRange(invoiceIdA1Note).getValue();
  invoiceSheet.getRange(invoiceIdA1Note).setValue(invoiceId);  // once adding invoice, make invoice id solid value until reset
  const invoiceClient = invoiceSheet.getRange(clientNameA1Note).getValue();
  const invoiceClientId = invoiceSheet.getRange(invoiceClientIdA1Note).getValue();
  const issueDate = invoiceSheet.getRange(issueDateA1Note).getValue();
  const dueDate = invoiceSheet.getRange(dueDateA1Note).getValue();
  const total = invoiceSheet.getRange(totalAmountA1Note).getValue();
  const gst = invoiceSheet.getRange(gstA1Note).getValue();
  const discount = invoiceSheet.getRange(discountA1Note).getValue();

  const ui = SpreadsheetApp.getUi();
  if (total === 0) {
    const response = ui.alert("没有选择产品");
    return;
  }
  
  // product name cell is merged cell of column BCD so the prodData item length is 7 BCD + E + F + G + H
  const prodData = invoiceSheet.getRange(productStartRow, productStartCol, productRowCount, productColCount).getValues().filter(row => row[0] !== "");
  
  // Create row data using column mapping - get actual column count from sheet
  const wholesaleColumnCount = wholesaleSheet.getLastColumn();
  const rowData = new Array(wholesaleColumnCount);
  
  // Set values using column mapping for all wholesaleColumn keys
  const wholesaleColumnKeys = Object.keys(wholesaleColumn);
  wholesaleColumnKeys.forEach(columnKey => {
    const columnIndex = getWholesaleColumnIndex(columnKey);
    if (columnIndex !== null) {
      switch (columnKey) {
        case wholesaleColumn.id:
          rowData[columnIndex - 1] = invoiceId;
          break;
        case wholesaleColumn.client:
          rowData[columnIndex - 1] = invoiceClient;
          break;
        case wholesaleColumn.clientID:
          rowData[columnIndex - 1] = invoiceClientId;
          break;
        case wholesaleColumn.issueDate:
          rowData[columnIndex - 1] = issueDate;
          break;
        case wholesaleColumn.dueDate:
          rowData[columnIndex - 1] = dueDate;
          break;
        case wholesaleColumn.total:
          rowData[columnIndex - 1] = total;
          break;
        case wholesaleColumn.gst:
          rowData[columnIndex - 1] = gst;
          break;
        case wholesaleColumn.detail:
          rowData[columnIndex - 1] = JSON.stringify(prodData);
          break;
        case wholesaleColumn.discount:
          rowData[columnIndex - 1] = discount;
          break;
        case wholesaleColumn.bEmailSent:
        case wholesaleColumn.bDilivered:
        case wholesaleColumn.bPaid:
          rowData[columnIndex - 1] = ""; // Default empty for boolean flags
          break;
        case wholesaleColumn.invoiceLink:
          rowData[columnIndex - 1] = ""; // Will be set later when PDF is created
          break;
        case wholesaleColumn.discountDeduction:
        case wholesaleColumn.outdatedDeduction:
          rowData[columnIndex - 1] = ""; // Default empty for deduction data
          break;
        case wholesaleColumn.totalLoss:
        case wholesaleColumn.totalPaid:
          rowData[columnIndex - 1] = 0; // Default to 0 for financial fields
          break;
        default:
          rowData[columnIndex - 1] = ""; // Default empty for any other fields
          break;
      }
    }
  });
  
  console.log('rowData', rowData.join(", "))

  const search = wholesaleSheet.createTextFinder(invoiceId).matchEntireCell(true).findNext();
  if (search) {
    const choice = ui.alert('Invoice #' + invoiceId + " 已存在", "是否覆盖？", ui.ButtonSet.YES_NO);
    if (choice === ui.Button.YES) {
      const folder = DriveApp.getFoldersByName('invoice').next();
      const pdfFileName = pdfName(invoiceSheet, invoiceId);
      console.log('find folder', folder.getName(), "invoiceId", invoiceId)
      const files = folder.getFilesByName(pdfFileName+".pdf");
      while(files.hasNext()) {
        let pdf = files.next();
        if (pdf) {
          console.log('find pdf', pdf.getId())
          pdf.setTrashed(true);
        }
      }

      // 修改这里：添加 B7 单元格值作为文件名后缀
      pdf = createPDF(ss.getId(), invoiceSheet, sheetMap.invoice, pdfName(invoiceSheet, invoiceId), 1, 1, productStartRow + productRowCount + invoicePageEndRowCount, 8);
      const invoiceLinkIndex = getWholesaleColumnIndex(wholesaleColumn.invoiceLink);
      if (invoiceLinkIndex !== null) {
        rowData[invoiceLinkIndex - 1] = pdf.getUrl();
      }
      const existRow = wholesaleSheet.getRange(search.getRow(), 1, 1, rowData.length);
      existRow.setValues([rowData])
      ui.alert('Invoice #' + invoiceId + " 已覆盖");
    }
  } else {
    // 修改这里：添加 B7 单元格值作为文件名后缀
    const pdf = createPDF(ss.getId(), invoiceSheet, sheetMap.invoice, pdfName(invoiceSheet, invoiceId), 1, 1, productStartRow + productRowCount + invoicePageEndRowCount, 8);
    const invoiceLinkIndex = getWholesaleColumnIndex(wholesaleColumn.invoiceLink);
    if (invoiceLinkIndex !== null) {
      rowData[invoiceLinkIndex - 1] = pdf.getUrl();
    }
    wholesaleSheet.appendRow(rowData)
    ui.alert('Invoice #' + invoiceId + " 添加成功");
  }
}

function pdfName(invoiceSheet, invoiceId) {
    let invoiceClient = invoiceSheet.getRange(clientNameA1Note).getValue();
    
    // 1. 移除所有非字母数字字符（只保留字母和数字）
    invoiceClient = invoiceClient.replace(/[^a-zA-Z0-9]/g, "");
    
    // 2. 转换为驼峰式（首字母小写）
    invoiceClient = invoiceClient.charAt(0).toLowerCase() + invoiceClient.slice(1);
    
    const pdfFileName = invoiceId + "_" + invoiceClient;
    return pdfFileName;
}

function emailClient() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invoiceSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.invoice);
  const invoiceEmailSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.invoiceEmail);
  const wholesaleSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.wholesale);

  const invoiceId = invoiceSheet.getRange(invoiceIdA1Note).getValue();
  const search = wholesaleSheet.createTextFinder(invoiceId).matchEntireCell(true).findNext();
  if (!search) {
    ui.alert("invoice #"+invoiceId+" 请先保存发票信息");
    return;
  }
  
  /**
   * check email has been sent
   */
  const bEmailSentColIndex = getWholesaleColumnIndex(wholesaleColumn.bEmailSent);
  const bEmailSent = wholesaleSheet.getRange(search.getRow(), bEmailSentColIndex, 1,1);
  if (bEmailSent.getValue()) {
    ui.alert("之前已经发过发票邮件，忽略");
    return;
  }


  /**
   * get pdf
   */
  const folder = DriveApp.getFoldersByName('invoice').next();
  const pdfFileName = pdfName(invoiceSheet, invoiceId);
  const attachment = folder.getFilesByName(pdfFileName+".pdf")?.next();
  if (!attachment) {
    ui.alert("出错：invoice #"+invoiceId+" 没有生成pdf")
    return;
  }

  /**
   * send email
   */
  const email = invoiceSheet.getRange(emailA1Note).getValue();
  const emailBody = invoiceEmailSheet.getRange(emailTempA1Note).getValues().map(arr=>arr[0]).join("\n");
  console.log(email, emailBody);

  GmailApp.sendEmail(
    email, 
    "XITUAN - Please find attached invoice of your order [#"+invoiceId+"]", 
    emailBody,
    {
      attachments: [attachment.getAs(MimeType.PDF)],
      name: "Finance",
    }
  )
  bEmailSent.setValue("y");
  ui.alert("Email已发送")
}

function loadInvoice() {
  const ui = SpreadsheetApp.getUi();
  const invoiceSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.invoice);
  const wholesaleSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.wholesale);
  
  // Get invoice info from K2 (now in format invoiceID:clientName)
  const invoiceInfo = invoiceSheet.getRange("K2").getValue();
  if (!invoiceInfo) {
    ui.alert("请在K2单元格输入发票信息");
    return;
  }
  
  // Pre-split the invoice info to extract just the invoice ID
  let invoiceId;
  const invoiceInfoStr = invoiceInfo.toString();
  if (invoiceInfoStr.includes(":")) {
    // New format: invoiceID:clientName - extract the invoice ID part
    invoiceId = invoiceInfoStr.split(":")[0].trim();
  } else {
    // Old format: just invoiceID - use as is for backward compatibility
    invoiceId = invoiceInfoStr.trim();
  }
  
  if (!invoiceId) {
    ui.alert("无法从K2单元格提取发票ID");
    return;
  }
  
  // Search for invoice ID in wholesale sheet
  const search = wholesaleSheet.createTextFinder(invoiceId).matchEntireCell(true).findNext();
  if (!search) {
    ui.alert("未找到发票ID: " + invoiceId);
    return;
  }
  
  // Get the row data from wholesale sheet using the length of wholesaleColumn
  const row = search.getRow();
  const wholesaleColumnCount = wholesaleSheet.getLastColumn();
  const rowData = wholesaleSheet.getRange(row, 1, 1, wholesaleColumnCount).getValues()[0];
  
  // Extract data using column mapping
  const extractedData = {};
  const wholesaleColumnKeys = Object.keys(wholesaleColumn);
  
  wholesaleColumnKeys.forEach(columnKey => {
    const columnIndex = getWholesaleColumnIndex(columnKey);
    if (columnIndex !== null) {
      extractedData[columnKey] = rowData[columnIndex - 1];
    }
  });
  
  // Use extracted data with proper fallbacks
  const id = extractedData.id;
  const client = extractedData.client;
  const clientID = extractedData.clientID;
  const issueDate = extractedData.issueDate;
  const dueDate = extractedData.dueDate;
  const total = extractedData.total;
  const gst = extractedData.gst;
  const detailJson = extractedData.detail;
  const bEmailSent = extractedData.bEmailSent;
  const bDelivered = extractedData.bDilivered;
  const bPaid = extractedData.bPaid;
  const invoiceLink = extractedData.invoiceLink;
  const discount = extractedData.discount;
  const discountDeductionJson = extractedData.discountDeduction;
  const outdatedDeductionJson = extractedData.outdatedDeduction;
  
  // Clear product list using invoiceProductListReset function
  invoiceProductListReset(invoiceSheet);
  
  // Populate invoice header information
  invoiceSheet.getRange(invoiceIdA1Note).setValue(id);
  invoiceSheet.getRange(issueDateA1Note).setValue(issueDate);
  invoiceSheet.getRange(dueDateA1Note).setValue(dueDate);
  if (discount) {
    invoiceSheet.getRange(discountA1Note).setValue(discount);
  }
  
  // Set client english name and clientID
  if (client) {
    invoiceSheet.getRange(clientNameA1Note).setValue(client);
  }
  if (clientID) {
    invoiceSheet.getRange(invoiceClientIdA1Note).setValue(clientID);
  }
  
  // Parse deduction data
  let discountDeductions = [];
  let outdatedDeductions = [];
  
  try {
    if (discountDeductionJson && discountDeductionJson.toString().trim() !== "") {
      discountDeductions = JSON.parse(discountDeductionJson);
    }
  } catch (error) {
    console.error("Error parsing discount deduction data:", error);
  }
  
  try {
    if (outdatedDeductionJson && outdatedDeductionJson.toString().trim() !== "") {
      outdatedDeductions = JSON.parse(outdatedDeductionJson);
    }
  } catch (error) {
    console.error("Error parsing outdated deduction data:", error);
  }
  
  // Parse and populate product details
  if (detailJson) {
    try {
      const productDetails = JSON.parse(detailJson);
      
      for (let i = 0; i < productDetails.length && i <= productRowCount; i++) {
        const [productName, , , quantity, unitPrice, gstAmount, subTotal] = productDetails[i];
        const currentRow = productStartRow + i;
        
        // Set product name in merged BCD columns (column B)
        invoiceSheet.getRange(currentRow, 2).setValue(productName);
        
        // Merge BCD columns for this row
        const mergeRange = invoiceSheet.getRange(currentRow, 2, 1, 3); // B, C, D columns
        mergeRange.merge();
        
        // Set quantity (column E)
        invoiceSheet.getRange(currentRow, 5).setValue(quantity);
        
        // Set unit price (column F) 
        invoiceSheet.getRange(currentRow, 6).setValue(unitPrice);
        
        // Set GST (column G)
        invoiceSheet.getRange(currentRow, 7).setValue(gstAmount);
        
        // Set subtotal (column H)
        invoiceSheet.getRange(currentRow, 8).setValue(subTotal);
        
        // Check for discount deduction data for this product
        const discountMatch = discountDeductions.find(item => item[0] === productName);
        if (discountMatch) {
          const [, discountQty, discountRate] = discountMatch;
          invoiceSheet.getRange(currentRow, 9).setValue(`${discountQty}, ${discountRate}`); // Column I
        }
        
        // Check for outdated deduction data for this product
        const outdatedMatch = outdatedDeductions.find(item => item[0] === productName);
        if (outdatedMatch) {
          const [, outdatedQty] = outdatedMatch;
          invoiceSheet.getRange(currentRow, 10).setValue(outdatedQty); // Column J
        }
      }
    } catch (error) {
      console.error("Error parsing product details:", error);
      ui.alert("解析产品详情时出错: " + error.message);
    }
  }
  
  // ui.alert("发票 #" + invoiceId + " 加载成功");
}

function updateDeduction() {
  const ui = SpreadsheetApp.getUi();
  const invoiceSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.invoice);
  const wholesaleSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.wholesale);
  
  // Get current invoice ID
  const invoiceId = invoiceSheet.getRange(invoiceIdA1Note).getValue();
  if (!invoiceId) {
    ui.alert("没有发票ID");
    return;
  }
  
  // Find invoice row in wholesale sheet
  const search = wholesaleSheet.createTextFinder(invoiceId).matchEntireCell(true).findNext();
  if (!search) {
    ui.alert("未找到发票ID: " + invoiceId + " 在wholesale表中");
    return;
  }
  
  const wholesaleRow = search.getRow();
  const discountDeductions = [];
  const outdatedDeductions = [];
  
  // Check rows 17-34 for discount and outdated data
  for (let row = productStartRow; row <= productStartRow + productRowCount ; row++) {
    const productName = invoiceSheet.getRange(row, 2).getValue(); // Column B
    const discountData = invoiceSheet.getRange(row, 9).getValue(); // Column I
    const outdatedData = invoiceSheet.getRange(row, 10).getValue(); // Column J
    
    // Skip if no product name
    if (!productName) continue;
    
    // Process discount column (format: "quantity, rate")
    if (discountData && discountData.toString().trim() !== "") {
      const discountStr = discountData.toString().trim();
      if (discountStr.includes(",")) {
        const [quantity, rate] = discountStr.split(",").map(s => s.trim());
        if (quantity && rate) {
          discountDeductions.push([productName, parseFloat(quantity) || quantity, parseFloat(rate) || rate]);
        }
      }
    }
    
    // Process outdated column (format: number for quantity)
    if (outdatedData && outdatedData.toString().trim() !== "") {
      const quantity = parseFloat(outdatedData) || outdatedData;
      outdatedDeductions.push([productName, quantity]);
    }
  }
  
  // Get necessary data for calculations
  const total = invoiceSheet.getRange(totalAmountA1Note).getValue() || 0;
  const discountPercentage = invoiceSheet.getRange(discountA1Note).getValue() || 0;
  
  // Get product details from the current invoice for price lookup
  const prodData = invoiceSheet.getRange(productStartRow, productStartCol, productRowCount, productColCount).getValues().filter(row => row[0] !== "");
  
  // Create product price lookup from current invoice data
  const productPrices = {};
  prodData.forEach(([productName, , , quantity, unitPrice]) => {
    if (productName && unitPrice) {
      productPrices[productName] = unitPrice;
    }
  });
  
  // Calculate discount deduction amounts
  let totalDiscountedLoss = 0;
  discountDeductions.forEach(([productName, discountQty, discountRate]) => {
    const unitPrice = productPrices[productName];
    if (unitPrice && discountQty) {
      // discount deduction = (unit price) * (1 - discount percentage) * (1 - discountRate) * (discount quantity)
      const discountPercent = discountPercentage || 0;
      const deduction = unitPrice * (1 - discountPercent) * (1 - discountRate) * parseFloat(discountQty);
      totalDiscountedLoss += deduction;
    }
  });
  
  // Calculate outdated deduction amounts
  let totalOutdatedLoss = 0;
  outdatedDeductions.forEach(([productName, outdatedQty]) => {
    const unitPrice = productPrices[productName];
    if (unitPrice && outdatedQty) {
      // outdated deduction = (unit price) * (1 - discount percentage) * (outdated quantity)
      const discountPercent = discountPercentage || 0;
      const deduction = unitPrice * (1 - discountPercent) * parseFloat(outdatedQty);
      totalOutdatedLoss += deduction;
    }
  });
  
  // Calculate total loss and total paid
  const totalLoss = totalDiscountedLoss + totalOutdatedLoss;
  const totalPaid = total - totalLoss;
  
  // Update wholesale sheet with JSON data and calculated amounts using column mapping
  const outdatedDeductionColIndex = getWholesaleColumnIndex(wholesaleColumn.outdatedDeduction);
  const discountDeductionColIndex = getWholesaleColumnIndex(wholesaleColumn.discountDeduction);
  const discountedLossColIndex = getWholesaleColumnIndex(wholesaleColumn.discountedLoss);
  const outdatedLossColIndex = getWholesaleColumnIndex(wholesaleColumn.outdatedLoss);
  const totalLossColIndex = getWholesaleColumnIndex(wholesaleColumn.totalLoss);
  const totalPaidColIndex = getWholesaleColumnIndex(wholesaleColumn.totalPaid);
  
  // Set JSON strings for deduction data
  wholesaleSheet.getRange(wholesaleRow, outdatedDeductionColIndex).setValue(
    outdatedDeductions.length > 0 ? JSON.stringify(outdatedDeductions) : ""
  );
  
  wholesaleSheet.getRange(wholesaleRow, discountDeductionColIndex).setValue(
    discountDeductions.length > 0 ? JSON.stringify(discountDeductions) : ""
  );
  
  // Set calculated loss amounts
  wholesaleSheet.getRange(wholesaleRow, discountedLossColIndex).setValue(totalDiscountedLoss);
  wholesaleSheet.getRange(wholesaleRow, outdatedLossColIndex).setValue(totalOutdatedLoss);
  wholesaleSheet.getRange(wholesaleRow, totalLossColIndex).setValue(totalLoss);
  wholesaleSheet.getRange(wholesaleRow, totalPaidColIndex).setValue(totalPaid);
  
  console.log("Discount deductions:", discountDeductions);
  console.log("Outdated deductions:", outdatedDeductions);
  console.log("Calculated amounts:", {
    discountedLoss: totalDiscountedLoss,
    outdatedLoss: totalOutdatedLoss,
    totalLoss: totalLoss,
    totalPaid: totalPaid
  });
  
  ui.alert(`扣减信息已更新:\n折扣扣减: ${discountDeductions.length} 项 (金额: ${totalDiscountedLoss.toFixed(2)})\n过期扣减: ${outdatedDeductions.length} 项 (金额: ${totalOutdatedLoss.toFixed(2)})\n总损失: ${totalLoss.toFixed(2)}\n实际收款: ${totalPaid.toFixed(2)}`);
}

function invoiceHeaderDefault(invoiceSheet) {
    // Set default values and formulas for header cells
    invoiceSheet.getRange(clientNameA1Note).setValue("");  // this update client detail
    
    // these data will be overwritten by loadInvoice - so always reset thse formulas
    invoiceSheet.getRange(invoiceIdA1Note).setFormula('=IF(LEFT(INDEX(' + sheetMap.wholesale + '!A:A,COUNTA(' + sheetMap.wholesale + '!A:A),1),8)=TEXT(TODAY(),"yyyymmdd"),INDEX(' + sheetMap.wholesale + '!A:A,COUNTA(' + sheetMap.wholesale + '!A:A),1)+1,TEXT(TODAY(),"yyyymmdd")&"001")');
    invoiceSheet.getRange(invoiceClientIdA1Note).setValue(`=SHEETCELLMATCH(clientHead,clientData, "${clientColumn.client}", $B$7, "${clientColumn.id}")`);

    invoiceSheet.getRange(issueDateA1Note).setFormula("=Today()");
    invoiceSheet.getRange(dueDateA1Note).setFormula(`=if(SHEETCELLMATCH(clientHead,clientData, "id", $H$4, "invoicePay")=1, Today()+14, "")`);
    invoiceSheet.getRange(payToAccountNameA1Note).setValue("LuLin Zhang");
    invoiceSheet.getRange(payToBsbA1Note).setValue("'062006");
    invoiceSheet.getRange(payToAccountA1Note).setValue(12267255);
    invoiceSheet.getRange(payTransferRefA1Note).setFormula("=H3");

    invoiceSheet.getRange(discountA1Note).setValue(`=SHEETCELLMATCH(clientHead,clientData, "${clientColumn.id}", $H$4, "${clientColumn.discount}")`);
    
    console.log('Invoice header cells reset to default values/formulas');
}

function invoiceProductListReset(invoiceSheet) {
  // Clean product list for rows 17-34
  for (let row = productStartRow; row <= productStartRow + productRowCount; row++) {
    // Clear columns B, C, D, E, I, J
    invoiceSheet.getRange(row, 2, 1, 3).clearContent(); // B, C, D
    invoiceSheet.getRange(row, 5).clearContent(); // E
    invoiceSheet.getRange(row, 9).clearContent(); // I
    invoiceSheet.getRange(row, 10).clearContent(); // J
    
    // Reset F column formula
    invoiceSheet.getRange(row, 6).setFormula(priceCalcFormula(row));

    // Reset G column formula
    invoiceSheet.getRange(row, 7).setFormula(`=IF(E${row}="", "", F${row} / 11)`);
    
    // Reset H column formula
    invoiceSheet.getRange(row, 8).setFormula(`=if(B${row}="", "", E${row}*F${row})`);
  }
}












