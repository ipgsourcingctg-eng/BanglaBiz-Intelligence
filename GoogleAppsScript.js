/**
 * Google Apps Script for SalesPulse Bi-directional Real-Time Sync
 * 
 * Paste this file's content into your Extensions > Apps Script editor in your Google Sheet.
 * Then deploy this script as a "Web App", accessible by "Anyone".
 */

/**
 * 1. CLICK "Run" on this testConnection function first!
 * This will prompt the required Authorization Authorization Dialog.
 * Check the "Execution log" at the bottom to verify it states "Success!".
 */
function testConnection() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("No active spreadsheet found. Please make sure this script is created inside Extensions > Apps Script of your Google Sheet!");
    }
    var sheet = getOrCreateSheet(ss, "Leads");
    Logger.log("Success! Connected to Spreadsheet: " + ss.getName());
    Logger.log("Active Sheet: " + sheet.getName());
    Logger.log("Total Rows (including headers): " + sheet.getDataRange().getNumRows());
  } catch (err) {
    Logger.log("Error testing connection: " + err.toString());
  }
}

function parseYmdDate(dateStr) {
  if (!dateStr) return "";
  var str = String(dateStr).trim();
  var parts = str.split("-");
  if (parts.length === 3) {
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1; // 0-based month
    var d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 12, 0, 0); // midday to prevent timezone shifts
    }
  }
  return dateStr;
}

function formatDateValue(val, ss) {
  if (!val) return "";
  
  // 1. If it's already a Date object (or behaves like one)
  if (val instanceof Date || (typeof val === 'object' && val.getMonth && typeof val.getMonth === 'function')) {
    return Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), "dd-MMM-yyyy");
  }
  
  var str = String(val).trim();
  
  // 2. If it's a string, see if it is in YYYY-MM-DD format
  var ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    var dateObj = parseYmdDate(str);
    if (dateObj instanceof Date) {
      return Utilities.formatDate(dateObj, ss.getSpreadsheetTimeZone(), "dd-MMM-yyyy");
    }
  }
  
  // 3. Keep dd-MMM-yyyy format intact
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(str)) {
    return str;
  }
  
  return val;
}

function getOrCreateSheet(ss, sheetName) {
  // Graceful fallback if run manually without arguments in the Apps Script editor
  if (!ss) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  var sheets = ss.getSheets();
  if (sheets.length === 0) {
    throw new Error("The active spreadsheet has no sheets.");
  }
  
  // 1. Try to find the exact or case-insensitive matching sheet Name (e.g. SLA or Leads)
  var targetName = (sheetName || "SLA").trim().toLowerCase();
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName().trim().toLowerCase();
    if (sName === targetName) {
      return sheets[i];
    }
  }

  // 2. Try common synonyms as fallbacks (specifically "sla" or "lead" variants)
  var synonyms = ["sla", "sla=sales lead analysis", "leads", "lead analysis", "sales lead"];
  for (var k = 0; k < synonyms.length; k++) {
    var syn = synonyms[k];
    for (var i = 0; i < sheets.length; i++) {
      var sName = sheets[i].getName().trim().toLowerCase();
      if (sName === syn || sName.indexOf(syn) !== -1) {
        return sheets[i];
      }
    }
  }

  // 3. Absolute fallback: never create new sheets, use the very first sheet available!
  return sheets[0];
}

function doGet(e) {
  var sheetName = (e && e.parameter && e.parameter.sheet) || "Leads";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, sheetName);
  
  var data = [];
  var rows = sheet.getDataRange().getValues();
  if (rows.length > 1) {
    var headers = rows[0];
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var record = {};
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j];
        if (h) {
          var val = row[j];
          var lowerH = h.toLowerCase();
          if (lowerH.indexOf("date") !== -1 || lowerH.indexOf("activated") !== -1 || lowerH.indexOf("expires") !== -1 || lowerH === "on") {
            record[h] = formatDateValue(val, ss);
          } else {
            record[h] = val;
          }
        }
      }
      data.push(record);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "success", data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "error", 
        message: "No POST payload received. This function is designed to handle Web App requests from the SalesPulse application." 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var sheetName = payload.sheet || "Leads";
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, sheetName);
    
    if (action === "sync_leads") {
      var records = payload.records;
      if (records && records.length >= 0) {
        sheet.clearContents();
        var headers = ["Quarter", "SL", "Date", "Leads Ref.", "Customer Name", "Type", "Lead Value", "OEM", "Status"];
        sheet.appendRow(headers);
        
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          var dateVal = r.Date || "";
          if (dateVal && dateVal.indexOf("-") !== -1) {
            var dObj = parseYmdDate(dateVal);
            if (dObj instanceof Date) {
              dateVal = dObj;
            }
          }
          var rowData = [
            r.Quarter || "",
            r.SL || (i + 1),
            dateVal,
            r["Leads Ref."] || "",
            r["Customer Name"] || "",
            r.Type || "",
            r["Lead Value"] || 0,
            r.OEM || "",
            r.Status || ""
          ];
          sheet.appendRow(rowData);
        }
        
        if (records.length > 0) {
          sheet.getRange(2, 3, records.length, 1).setNumberFormat("dd-MMM-yyyy");
        }
        
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Leads successfully synced. Processed " + records.length + " rows." }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (action === "get_leads") {
      var data = [];
      var rows = sheet.getDataRange().getValues();
      if (rows.length > 1) {
        var headers = rows[0];
        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          var record = {};
          for (var j = 0; j < headers.length; j++) {
            var h = headers[j];
            if (h) {
              var val = row[j];
              var lowerH = h.toLowerCase();
              if (lowerH.indexOf("date") !== -1 || lowerH.indexOf("activated") !== -1 || lowerH.indexOf("expires") !== -1 || lowerH === "on") {
                record[h] = formatDateValue(val, ss);
              } else {
                record[h] = val;
              }
            }
          }
          data.push(record);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: data }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: "Unsupported action or invalid payload" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
