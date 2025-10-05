// InvoiceSummary sheet cell address constants
const filterFromDateA1Note = "K2";              // Filter from date
const filterToDateA1Note = "K3";                // Filter to date

// InvoiceSummary result range constants
const summaryListStartRow = 17;                      // First row of summary results
const summaryListRowCount = 16;                       // Number of summary result rows (17-34 = 18 rows) - DEPRECATED, now using dynamic
const summaryStartCol = 2;                       // First column of summary results (B)
const summaryColCount = 7;                       // Number of columns in summary (B, C, D, E, F, G, H) - CD and EF are merged



function invoiceFilter() {
    const invoiceSummarySheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.invoiceSum);
    const wholesaleSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.wholesale);

    // Get filter criteria
    const filterFromDate = invoiceSummarySheet.getRange(filterFromDateA1Note).getValue();
    const filterToDate = invoiceSummarySheet.getRange(filterToDateA1Note).getValue();
    const filterClient = invoiceSummarySheet.getRange(clientNameA1Note).getValue();

    console.log('Filter criteria:', {
        fromDate: filterFromDate,
        toDate: filterToDate,
        client: filterClient
    });

    // Clear existing results with an extended range to clear any previous dynamic content
    const maxClearRows = 50; // Clear up to 50 rows to ensure we remove all previous content
    const clearRange = invoiceSummarySheet.getRange(summaryListStartRow, summaryStartCol, maxClearRows, summaryColCount);
    clearRange.clear();

    // Get all wholesale data (skip header row)
    const wholesaleData = wholesaleSheet.getDataRange().getValues();
    const headers = wholesaleData[0];
    const dataRows = wholesaleData.slice(1);

    // Find column indices in wholesale sheet using columnMap values
    const idColIndex = headers.indexOf(wholesaleColumn.id);
    const clientColIndex = headers.indexOf(wholesaleColumn.client);
    const issueDateColIndex = headers.indexOf(wholesaleColumn.issueDate);
    const totalColIndex = headers.indexOf(wholesaleColumn.total);
    const discountColIndex = headers.indexOf(wholesaleColumn.discount);
    const detailJsonColIndex = headers.indexOf(wholesaleColumn.detail);
    const discountDeductionColIndex = headers.indexOf(wholesaleColumn.discountDeduction);
    const outdatedDeductionColIndex = headers.indexOf(wholesaleColumn.outdatedDeduction);
    const discountedLossColIndex = headers.indexOf(wholesaleColumn.discountedLoss);
    const outdatedLossColIndex = headers.indexOf(wholesaleColumn.outdatedLoss);
    const totalPaidColIndex = headers.indexOf(wholesaleColumn.totalPaid);

    // Filter data based on criteria
    const filteredData = dataRows.filter(row => {
        const issueDate = row[issueDateColIndex];
        const client = row[clientColIndex];

        // Check date range (if dates are provided)
        let dateMatch = true;
        if (filterFromDate && filterToDate) {
            const rowDate = new Date(issueDate);
            const fromDate = new Date(filterFromDate);
            const toDate = new Date(filterToDate);
            dateMatch = rowDate >= fromDate && rowDate <= toDate;
        }

        // Check english name (if provided)
        let clientMatch = true;
        if (filterClient && filterClient.trim() !== '') {
            clientMatch = client && client.toString().toLowerCase().includes(filterClient.toString().toLowerCase());
        }

        return dateMatch && clientMatch;
    });

    console.log('Filtered results count:', filteredData.length);

    // Process filtered data using pre-calculated values
    const summaryData = [];
    const invoiceComments = []; // Store comments for each invoice

    filteredData.forEach(row => {
        const id = row[idColIndex];
        const total = row[totalColIndex] || 0;
        const discountPercentage = row[discountColIndex] || 0;
        const detailJson = row[detailJsonColIndex];
        const discountDeductionJson = row[discountDeductionColIndex];
        const outdatedDeductionJson = row[outdatedDeductionColIndex];
        
        // Use pre-calculated loss values from wholesale sheet
        const discountedLoss = row[discountedLossColIndex] || 0;
        const outdatedLoss = row[outdatedLossColIndex] || 0;
        const totalPayable = row[totalPaidColIndex] || (total - discountedLoss - outdatedLoss);

        summaryData.push([
            id,                                           // Column B: id
            discountedLoss,                              // Column C: pre-calculated discount deduction (merged with D)
            '',                                          // Column D: empty (part of merged cell CD)
            outdatedLoss,                               // Column E: pre-calculated outdated deduction (merged with F)
            '',                                          // Column F: empty (part of merged cell EF)
            total,                                       // Column G: total
            totalPayable                                 // Column H: totalPayable
        ]);

        // Generate detailed comment for this invoice if it has deductions
        if ((discountedLoss > 0 || outdatedLoss > 0) && (discountDeductionJson || outdatedDeductionJson)) {
            let detailedCommentParts = [];
            
            try {
                // Parse discount deductions for comment
                if (discountDeductionJson && discountDeductionJson.toString().trim() !== "") {
                    const discountDeductions = JSON.parse(discountDeductionJson);
                    discountDeductions.forEach(([productName, discountQty, discountRate]) => {
                        detailedCommentParts.push(`${productName}_${discountQty}_${discountRate}`);
                    });
                }
                
                // Parse outdated deductions for comment
                if (outdatedDeductionJson && outdatedDeductionJson.toString().trim() !== "") {
                    const outdatedDeductions = JSON.parse(outdatedDeductionJson);
                    outdatedDeductions.forEach(([productName, outdatedQty]) => {
                        detailedCommentParts.push(`${productName}_${outdatedQty}`);
                    });
                }
                
                if (detailedCommentParts.length > 0) {
                    const detailedComment = `${id} - ${detailedCommentParts.join(', ')}`;
                    invoiceComments.push(detailedComment);
                }
            } catch (error) {
                console.error('Error parsing deduction data for comments:', error);
            }
        }
    });

    // Write filtered data to summary sheet
    if (summaryData.length > 0) {
        const dataRowsCount = summaryData.length;
        const writeRange = invoiceSummarySheet.getRange(summaryListStartRow, summaryStartCol, dataRowsCount, summaryColCount);
        writeRange.setValues(summaryData);

        // Re-merge the cells for each written row
        for (let i = 0; i < dataRowsCount; i++) {
            const rowNum = summaryListStartRow + i;
            // Merge discount deduction cells (columns C, D)
            const discountMergeRange = invoiceSummarySheet.getRange(rowNum, 3, 1, 2); // C, D columns (3, 4)
            discountMergeRange.merge();
            // Merge outdated deduction cells (columns E, F)
            const outdatedMergeRange = invoiceSummarySheet.getRange(rowNum, 5, 1, 2); // E, F columns (5, 6)
            outdatedMergeRange.merge();
            
            // Set alternating background colors for invoice list rows
            const rowRange = invoiceSummarySheet.getRange(rowNum, summaryStartCol, 1, summaryColCount);
            if (i % 2 === 0) {
                rowRange.setBackground('e3f4f4'); // White for even rows (0, 2, 4, ...)
            } else {
                rowRange.setBackground('#ffffff'); // Light blue for odd rows (1, 3, 5, ...)
            }
        }

        // Set invoice ID column (column B) to left alignment
        const invoiceIdRange = invoiceSummarySheet.getRange(summaryListStartRow, summaryStartCol, dataRowsCount, 1);
        invoiceIdRange.setHorizontalAlignment('left');

        // Add border row
        const borderRowPos = summaryListStartRow + dataRowsCount;
        const borderRange = invoiceSummarySheet.getRange(borderRowPos, summaryStartCol, 1, summaryColCount);
        borderRange.setBorder(true, false, false, false, false, false, "black", SpreadsheetApp.BorderStyle.SOLID);
        borderRange.setBackground('#1dc7ca'); // Set border row background color
        
        // Make border row narrower
        invoiceSummarySheet.setRowHeight(borderRowPos, 10); // Set row height to 10 pixels

        let totalRowsUsed = dataRowsCount + 1; // data + border

        // Add comment rows if there are any comments
        if (invoiceComments.length > 0) {
            const commentStartRow = borderRowPos + 1;
            const commentText = 'Discount & outdate product list\n\n' + invoiceComments.join('\n');
            
            // Write comment text in the first cell of the comment row(s)
            const commentCell = invoiceSummarySheet.getRange(commentStartRow, summaryStartCol);
            commentCell.setValue(commentText);
            commentCell.setWrap(true);
            commentCell.setHorizontalAlignment('left');
            commentCell.setVerticalAlignment('top');
            
            // Merge comment cells across the invoice detail column range (B through H)
            const commentMergeRange = invoiceSummarySheet.getRange(commentStartRow, summaryStartCol, 1, summaryColCount);
            commentMergeRange.merge();
            commentMergeRange.setHorizontalAlignment('left');
            commentMergeRange.setVerticalAlignment('top');
            commentMergeRange.setBackground('#f4f4f4'); // Set light grey 3 background color
            
            totalRowsUsed += 1; // add comment row
        }

        // Update dynamic formulas for Invoice Ref and Total Due
        updateDynamicFormulas(invoiceSummarySheet, dataRowsCount);

        // Clear any leftover formatting from previous filter results that might have had more rows
        clearLeftoverFormatting(invoiceSummarySheet, totalRowsUsed);

        console.log(`Written ${dataRowsCount} data rows + 1 border row + ${invoiceComments.length > 0 ? 1 : 0} comment row(s) = ${totalRowsUsed} total rows`);

    } else {
        console.log('No matching results found');
        // Clear dynamic formulas when no data
        updateDynamicFormulas(invoiceSummarySheet, 0);
        // Clear all formatting when no data
        clearLeftoverFormatting(invoiceSummarySheet, 0);
        const ui = SpreadsheetApp.getUi();
        ui.alert('No matching invoices found for the specified criteria.');
    }
}

// Remove the calculateDeductionsForInvoice function - no longer needed since calculations are done in updateDeduction()

function calculateInvoiceSummary() {
    const ui = SpreadsheetApp.getUi();
    const wholesaleSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.wholesale);
    const invoiceSummarySheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.invoiceSummary);

    // Get all wholesale data (starting from row 2, assuming row 1 is headers)
    const wholesaleData = wholesaleSheet.getDataRange().getValues();
    const summaryData = invoiceSummarySheet.getDataRange().getValues();
    const headers = wholesaleData[0];

    // Find column indices using column mapping
    const idColIndex = headers.indexOf(wholesaleColumn.id);
    const totalColIndex = headers.indexOf(wholesaleColumn.total);
    const discountedLossColIndex = headers.indexOf(wholesaleColumn.discountedLoss);
    const outdatedLossColIndex = headers.indexOf(wholesaleColumn.outdatedLoss);
    const totalPaidColIndex = headers.indexOf(wholesaleColumn.totalPaid);

    // Process each wholesale row (skip header row)
    for (let i = 1; i < wholesaleData.length; i++) {
        const row = wholesaleData[i];
        const id = row[idColIndex];
        
        if (!id) continue; // Skip empty rows

        // Find corresponding row in invoiceSummary sheet
        let summaryRowIndex = -1;
        for (let j = 1; j < summaryData.length; j++) {
            if (summaryData[j][0] === id) { // Assuming invoice ID is in column A
                summaryRowIndex = j;
                break;
            }
        }

        if (summaryRowIndex === -1) continue; // Invoice not found in summary

        // Use pre-calculated values from wholesale sheet
        const total = row[totalColIndex] || 0;
        const discountedLoss = row[discountedLossColIndex] || 0;
        const outdatedLoss = row[outdatedLossColIndex] || 0;
        const totalPayable = row[totalPaidColIndex] || (total - discountedLoss - outdatedLoss);

        // Update invoiceSummary sheet
        const summaryRow = summaryRowIndex + 1; // Convert to 1-indexed

        // Assuming columns in invoiceSummary sheet:
        // Column G: total, Column H: totalPayable
        // You may need to adjust column indices based on actual invoiceSummary structure

        // Update the invoiceSummary sheet (adjust column indices as needed)
        invoiceSummarySheet.getRange(summaryRow, 8).setValue(totalPayable); // Column H: totalPayable

        // Optionally, you can also update separate columns for discount and outdated deductions
        // invoiceSummarySheet.getRange(summaryRow, 9).setValue(discountedLoss); // Additional column for discount deduction
        // invoiceSummarySheet.getRange(summaryRow, 10).setValue(outdatedLoss); // Additional column for outdated deduction
    }

    ui.alert("发票汇总已更新完成");
}

function printInvoiceSummary() {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const invoiceSummarySheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.invoiceSum);
    const wholesaleSumSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.wholesaleSum);

    // Get key summary data directly from cells (using cellMap.js constants)
    const filterFromDate = invoiceSummarySheet.getRange(filterFromDateA1Note).getValue();
    const filterToDate = invoiceSummarySheet.getRange(filterToDateA1Note).getValue();
    const filterClient = invoiceSummarySheet.getRange(clientNameA1Note).getValue();
    const summaryTotal = invoiceSummarySheet.getRange(totalAmountA1Note).getValue();
    const summaryIssueDate = invoiceSummarySheet.getRange(issueDateA1Note).getValue();
    const summaryDueDate = invoiceSummarySheet.getRange(dueDateA1Note).getValue();

    // Generate PDF filename based on filter criteria
    const fromDateStr = Utilities.formatDate(new Date(filterFromDate), Session.getScriptTimeZone(), "yyyyMMdd");
    const toDateStr = Utilities.formatDate(new Date(filterToDate), Session.getScriptTimeZone(), "yyyyMMdd");
    let pdfFileName = fromDateStr + "to" + toDateStr;

    if (filterClient && filterClient.toString().trim() !== '') {
        // Remove non-alphanumeric characters and convert to camelCase like in invoice.js
        let clientName = filterClient.toString().replace(/[^a-zA-Z0-9]/g, "");
        clientName = clientName.charAt(0).toLowerCase() + clientName.slice(1);
        pdfFileName += "_" + clientName;
    }

    // Add timestamp to make filename unique
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd");
    pdfFileName += "_" + timestamp;

    try {
        // Find the last row with data by checking column B from summaryListStartRow
        let lastDataRow = summaryListStartRow - 1; // Start before the data range
        const maxRowsToCheck = 100; // Safety limit to avoid infinite loops
        
        for (let row = summaryListStartRow; row < summaryListStartRow + maxRowsToCheck; row++) {
            const cellValue = invoiceSummarySheet.getRange(row, 2).getValue(); // Column B (invoice ID)
            const bgColor = invoiceSummarySheet.getRange(row, 2).getBackground(); // Check background color
            
            // Continue if cell has value OR has border background color (cyan)
            if (cellValue !== "" && cellValue !== null && cellValue !== undefined) {
                lastDataRow = row;
            } else if (bgColor === '#1dc7ca' || bgColor === '#f4f4f4') {
                // Border row (cyan) or comment row (light grey) - continue but don't update lastDataRow
                lastDataRow = row;
            } else {
                // Found first truly empty row with no special formatting
                break;
            }
        }
        
        // Create PDF with the summary data range in landscape orientation with narrow margins
        const narrowMargins = {
            top: 0.5,
            bottom: 0.25,
            left: 0.5,
            right: 0.5
        };

        const pdf = createPDF(
            ss.getId(),
            invoiceSummarySheet,
            "invoiceSummary",
            pdfFileName,
            1,                          // start row
            1,                          // start column  
            lastDataRow,                     // end row (now dynamic)
            summaryStartCol + summaryColCount - 1,  // end column (B=2 + 7 columns - 1 = column H=8)
            'portrait',                // orientation
            narrowMargins               // custom narrow margins
        );

        // Get PDF URL
        const pdfUrl = pdf.getUrl();
        console.log('Invoice Summary PDF created:', pdfUrl);

        // Prepare wholesale summary row data using column mapping
        const wholesaleSummaryId = invoiceSummarySheet.getRange(invoiceIdA1Note).getValue();  // Get actual invoice ID
        const clientID = invoiceSummarySheet.getRange(invoiceClientIdA1Note).getValue(); // Get clientID if available
        
        // Create row data using column mapping - get actual column count from sheet
        const wholesaleSumColumnCount = wholesaleSumSheet.getLastColumn();
        const rowData = new Array(wholesaleSumColumnCount);
        
        // Set values using column mapping for all wholesaleSumColumn keys
        const wholesaleSumColumnKeys = Object.keys(wholesaleSumColumn);
        wholesaleSumColumnKeys.forEach(columnKey => {
          const columnIndex = getWholesaleSumColumnIndex(columnKey);
          if (columnIndex !== null) {
            switch (columnKey) {
              case wholesaleSumColumn.id:
                rowData[columnIndex - 1] = wholesaleSummaryId;
                break;
              case wholesaleSumColumn.client:
                rowData[columnIndex - 1] = filterClient || "All";
                break;
              case wholesaleSumColumn.clientID:
                rowData[columnIndex - 1] = clientID;
                break;
              case wholesaleSumColumn.issueDate:
                rowData[columnIndex - 1] = summaryIssueDate;
                break;
              case wholesaleSumColumn.dueDate:
                rowData[columnIndex - 1] = summaryDueDate;
                break;
              case wholesaleSumColumn.total:
                rowData[columnIndex - 1] = summaryTotal || 0;
                break;
              case wholesaleSumColumn.gst:
                rowData[columnIndex - 1] = 0; // Default to 0 for summary GST
                break;
              case wholesaleSumColumn.invoiceLink:
                rowData[columnIndex - 1] = pdfUrl;
                break;
              case wholesaleSumColumn.totalLoss:
              case wholesaleSumColumn.totalPaid:
                rowData[columnIndex - 1] = 0; // Default to 0 for financial fields
                break;
              default:
                rowData[columnIndex - 1] = ""; // Default empty for any other fields
                break;
            }
          }
        });

        console.log('Wholesale summary row data:', rowData.join(", "));

        // Check if summary already exists (similar to saveInvoice check)
        const search = wholesaleSumSheet.createTextFinder(wholesaleSummaryId).matchEntireCell(true).findNext();
        if (search) {
            const choice = ui.alert('Summary #' + wholesaleSummaryId + " 已存在", "是否覆盖？", ui.ButtonSet.YES_NO);
            if (choice === ui.Button.YES) {
                // Update existing row
                const existRow = wholesaleSumSheet.getRange(search.getRow(), 1, 1, rowData.length);
                existRow.setValues([rowData]);
                ui.alert('Summary #' + wholesaleSummaryId + " 已覆盖");
            }
        } else {
            // Add new row
            wholesaleSumSheet.appendRow(rowData);
            ui.alert(
                'PDF已生成并保存数据',
                `发票汇总PDF已成功生成！\n\n文件名: ${pdfFileName}.pdf\n汇总ID: ${wholesaleSummaryId}\n\n数据已保存到 wholesaleSum 表\n\n点击确定后可在invoiceSummary文件夹中找到PDF文件。`,
                ui.ButtonSet.OK
            );
        }

        return pdf;

    } catch (error) {
        console.error('Error generating PDF or saving data:', error);
        ui.alert('生成PDF或保存数据时出错', '错误信息: ' + error.toString(), ui.ButtonSet.OK);
        return null;
    }
}

// Function to update dynamic formulas based on actual data rows
function updateDynamicFormulas(invoiceSummarySheet, dataRowsCount) {
    if (dataRowsCount > 0) {
        // Calculate the end row for data (excluding border and comment rows)
        const dataEndRow = summaryListStartRow + dataRowsCount - 1;
        
        // Update Invoice Ref formula to only look at data rows
        const invoiceRefFormula = `=INDEX(B${summaryListStartRow}:B${dataEndRow}, MAX(IF(B${summaryListStartRow}:B${dataEndRow}<>"", ROW(B${summaryListStartRow}:B${dataEndRow})-ROW(B${summaryListStartRow})+1)))`;
        invoiceSummarySheet.getRange(invoiceIdA1Note).setFormula(invoiceRefFormula);
        
        // Update Total Due formula to only sum data rows
        const totalDueFormula = `=SUM(H${summaryListStartRow}:H${dataEndRow})`;
        invoiceSummarySheet.getRange(totalAmountA1Note).setFormula(totalDueFormula);
    } else {
        // Clear formulas when no data
        invoiceSummarySheet.getRange(invoiceIdA1Note).setValue("");
        invoiceSummarySheet.getRange(totalAmountA1Note).setValue(0);
    }
}

// Function to clear leftover formatting from previous filter results
function clearLeftoverFormatting(invoiceSummarySheet, currentRowsUsed) {
    // Clear a reasonable range after the current data to remove any leftover formatting
    const clearStartRow = summaryListStartRow + currentRowsUsed;
    const clearRowCount = 30; // Clear up to 30 rows after current data to be safe
    
    if (clearStartRow <= summaryListStartRow + 50) { // Safety check to not clear too far
        const clearRange = invoiceSummarySheet.getRange(clearStartRow, summaryStartCol, clearRowCount, summaryColCount);
        
        // Clear content, formatting, and reset to default background
        clearRange.clear();
        clearRange.setBackground('#ffffff'); // Set to white background
        clearRange.setBorder(false, false, false, false, false, false); // Remove any borders
    }
}


