/**
 * EXPENSE TRACKER - GOOGLE APPS SCRIPT BACKEND
 *
 * Instructions:
 * 1. Open Google Sheets and create a new sheet named "Sheet1" (or rename accordingly).
 *    Set headers in Row 1: Date | Category | Amount | Type | Notes
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any code there and paste this entire file.
 * 4. Click Save (disk icon).
 * 5. Click Deploy > New deployment.
 * 6. Select type: "Web app".
 * 7. Description: "Expense Tracker API v1"
 * 8. Execute as: "Me"
 * 9. Who has access: "Anyone"
 * 10. Click Deploy and authorize the script.
 * 11. Copy the Web App URL and paste it into app.js `SCRIPT_URL`.
 */

const SHEET_NAME = 'Sheet1'; // Change if your sheet name is different

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function setupSheet() {
  const sheet = getSheet();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Date',
      'Category',
      'Amount',
      'Type',
      'Notes'
    ]);
  }
}

function doGet() {
  setupSheet();
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        data: []
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const transactions = [];

  for (let i = 1; i < data.length; i++) {
    let dateVal = data[i][0];
    if (dateVal instanceof Date) {
      dateVal = Utilities.formatDate(
        dateVal,
        Session.getScriptTimeZone(),
        "dd-MMM-yyyy"
      ).toLowerCase();
    }
    transactions.push({
      rowId: i + 1,
      Date: dateVal,
      Category: data[i][1],
      Amount: parseFloat(data[i][2]) || 0,
      Type: data[i][3],
      Notes: data[i][4] || ''
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'success',
      data: transactions
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  setupSheet();
  try {
    const sheet = getSheet();
    // Log incoming request data for debugging
    Logger.log('doPost received raw: ' + e.postData.contents);
    const requestData = JSON.parse(e.postData.contents);

    // DELETE
    if (requestData.action === 'delete') {
      const rowId = parseInt(requestData.rowId, 10);
      if (!rowId || rowId <= 1) {
        throw new Error('Invalid rowId');
      }
      sheet.deleteRow(rowId);
      return ContentService
        .createTextOutput(JSON.stringify({
          status: 'success',
          message: 'Deleted'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ADD OR UPDATE
    // Log parsed request data
    Logger.log('Parsed requestData: ' + JSON.stringify(requestData));
    const category = requestData.category || requestData.Category;
    const amount = parseFloat(requestData.amount || requestData.Amount || 0);
    const type = requestData.type || requestData.Type;
    const notes = requestData.notes || requestData.Notes || '';
    // Transaction date handling: expect date in ISO format or already formatted
    const rawDate = requestData.date || requestData.Date || new Date();
    // Ensure date is in dd-MMM-yyyy format for the sheet
    const txDate = (function (d) {
      // If d is a Date object, format directly
      if (d instanceof Date) {
        return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
      }
      // If d is a string, try parsing as ISO then format; if parsing fails, assume already formatted
      try {
        const parsed = new Date(d);
        if (!isNaN(parsed)) {
          return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
        }
      } catch (e) { }
      // Return as‑is (presumed correctly formatted)
      return d;
    })(rawDate);


    const rows = sheet.getDataRange().getValues();
    let existingRow = -1;
    for (let i = 1; i < rows.length; i++) {
      let rDate = rows[i][0];
      if (rDate instanceof Date) {
        rDate = Utilities.formatDate(rDate, Session.getScriptTimeZone(), 'dd-MMM-yyyy');
      }
      const rowDate = String(rDate).trim().toLowerCase();
      const rowCategory = String(rows[i][1]).trim().toLowerCase();
      const rowType = String(rows[i][3]).trim().toLowerCase();
      if (
        rowDate === String(txDate).trim().toLowerCase() &&
        rowCategory === String(category).trim().toLowerCase() &&
        rowType === String(type).trim().toLowerCase()
      ) {
        existingRow = i + 1;
        break;
      }
    }

    if (existingRow > 0) {
      const currentAmount = parseFloat(sheet.getRange(existingRow, 3).getValue()) || 0;
      // Preserve existing notes; do not modify the Notes column
      sheet.getRange(existingRow, 3).setValue(currentAmount + amount);
      Logger.log('Updated existing row #' + existingRow + ' amount to ' + (currentAmount + amount));
    } else {
      sheet.appendRow([txDate, category, amount, type, notes]);
      Logger.log('Appended new row: ' + [txDate, category, amount, type, notes]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Saved'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
