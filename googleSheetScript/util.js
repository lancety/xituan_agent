function getFolderByName_(folderName) {

  // Gets the Drive Folder of where the current spreadsheet is located.
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const parentFolder = DriveApp.getFileById(ssId).getParents().next();

  // Iterates the subfolders to check if the PDF folder already exists.
  const subFolders = parentFolder.getFolders();
  while (subFolders.hasNext()) {
    let folder = subFolders.next();

    // Returns the existing folder if found.
    if (folder.getName() === folderName) {
      return folder;
    }
  }
  // Creates a new folder if one does not already exist.
  return parentFolder.createFolder(folderName)
    .setDescription(`Created by XITUAN application to store PDF output files`);
}

/**
 * ssid - spreadsheet id
 * sheet - the sheet where data from
 * filderPath - the pdf save location
 * filename - saved file name
 * sr - start row
 * sc - start column
 * er - end row
 * ec - end column
 * orientation - optional orientation ('portrait' or 'landscape'), defaults to 'portrait'
 * margins - optional margins object {top, bottom, left, right}, defaults to current values
 */
function createPDF(ssid, sheet, folderPath, fileName, sr , sc, er, ec, orientation = 'portrait', margins = null) {
  const isPortrait = orientation === 'portrait';
  
  // Default margins (current values)
  const defaultMargins = {
    top: 0.5,
    bottom: 0.25,
    left: 0.5,
    right: 0.5
  };
  
  // Use provided margins or defaults
  const finalMargins = margins || defaultMargins;
  
  const url = "https://docs.google.com/spreadsheets/d/" + ssid + "/export" +
    "?format=pdf&" +
    "size=7&" +
    "fzr=true&" +
    "portrait=" + isPortrait + "&" +
    "fitw=true&" +
    "gridlines=false&" +
    "printtitle=false&" +
    "top_margin=" + finalMargins.top + "&" +
    "bottom_margin=" + finalMargins.bottom + "&" +
    "left_margin=" + finalMargins.left + "&" +
    "right_margin=" + finalMargins.right + "&" +
    "sheetnames=false&" +
    "pagenum=UNDEFINED&" +
    "attachment=true&" +
    "gid=" + sheet.getSheetId() + '&' +
    "r1=" + sr + "&c1=" + sc + "&r2=" + er + "&c2=" + ec;

  const params = { method: "GET", headers: { "authorization": "Bearer " + ScriptApp.getOAuthToken() } };
  const blob = UrlFetchApp.fetch(url, params).getBlob().setName(fileName + '.pdf');

  // Gets the folder in Drive where the PDFs are stored.
  const folder = getFolderByName_(folderPath);
  console.log(`Name: ${folder.getName()}\rID: ${folder.getId()}\rDescription: ${folder.getDescription()}`)

  const pdfFile = folder.createFile(blob);
  return pdfFile;
}


/**
 * Utility function for mapping sheet data to objects.
 */
function getObjects(data, keys) {
  let objects = [];
  for (let i = 0; i < data.length; ++i) {
    let object = {};
    let hasData = false;
    for (let j = 0; j < data[i].length; ++j) {
      let cellData = data[i][j];
      if (isCellEmpty(cellData)) {
        continue;
      }
      object[keys[j]] = cellData;
      hasData = true;
    }
    if (hasData) {
      objects.push(object);
    }
  }
  return objects;
}
// Creates object keys for column headers.
function createObjectKeys(keys) {
  return keys.map(function (key) {
    return key.replace(/\W+/g, '_').toLowerCase();
  });
}
// Returns true if the cell where cellData was read from is empty.
function isCellEmpty(cellData) {
  return typeof (cellData) == "string" && cellData == "";
}

/**
 * Column index utility functions for sheet operations
 */

// Helper function to get column index by column name from sheet headers
function getColumnIndexByName(sheet, columnName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headers.indexOf(columnName);
  return index === -1 ? null : index + 1; // +1 because sheet columns are 1-indexed
}

// Get column index from wholesale sheet by column name
function getWholesaleColumnIndex(columnName) {
  const wholesaleSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.wholesale);
  return getColumnIndexByName(wholesaleSheet, columnName);
}

// Get column index from wholesaleSum sheet by column name
function getWholesaleSumColumnIndex(columnName) {
  const wholesaleSumSheet = SpreadsheetApp.getActive().getSheetByName(sheetMap.wholesaleSum);
  return getColumnIndexByName(wholesaleSumSheet, columnName);
}