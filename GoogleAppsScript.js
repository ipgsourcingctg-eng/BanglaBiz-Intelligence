/**
 * Google Apps Script for SalesPulse Bi-directional Real-Time Sync
 * 
 * Paste this file's content into your Extensions > Apps Script editor in your Google Sheet.
 * Then deploy this script as a "Web App", accessible by "Anyone".
 */

function getOrCreateSheet(ss, sheetName) {
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
  var sheetName = e.parameter.sheet || "Leads";
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
          record[h] = row[j];
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
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var sheetName = payload.sheet || "Leads";
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, sheetName);
    
    if (action === "sync_leads") {
      var records = payload.records;
      if (records && records.length >= 0) {
        sheet.clearContents();
        var headers = ["id", "Quarter", "SL", "Date", "Leads Ref.", "Customer Name", "Type", "Lead Value", "OEM", "Status"];
        sheet.appendRow(headers);
        
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          var rowData = [
            r.id || "",
            r.Quarter || "",
            r.SL || (i + 1),
            r.Date || "",
            r["Leads Ref."] || "",
            r["Customer Name"] || "",
            r.Type || "",
            r["Lead Value"] || 0,
            r.OEM || "",
            r.Status || ""
          ];
          sheet.appendRow(rowData);
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
              record[h] = row[j];
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
