import { SalesRecord, SyncLog, FunnelRecord, CollectionRecord, LeadAnalysisRecord } from "../types";
import { formatToYmd, safeLocalStorage } from "../db/localDb";
import { parseNumeric } from "./format";
import * as XLSX from "xlsx";

export const ensureCorrectReferenceRange = (ws: XLSX.WorkSheet) => {
  if (!ws) return;
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  const cellKeys = Object.keys(ws).filter(k => k[0] !== "!");
  if (cellKeys.length === 0) return;

  for (const k of cellKeys) {
    try {
      const decoded = XLSX.utils.decode_cell(k);
      if (decoded.r < minRow) minRow = decoded.r;
      if (decoded.r > maxRow) maxRow = decoded.r;
      if (decoded.c < minCol) minCol = decoded.c;
      if (decoded.c > maxCol) maxCol = decoded.c;
    } catch {
      // ignore
    }
  }

  if (minRow !== Infinity && maxRow !== -Infinity && minCol !== Infinity && maxCol !== -Infinity) {
    const startCell = XLSX.utils.encode_cell({ r: minRow, c: minCol });
    const endCell = XLSX.utils.encode_cell({ r: maxRow, c: maxCol });
    const calculatedRef = `${startCell}:${endCell}`;

    if (!ws["!ref"]) {
      ws["!ref"] = calculatedRef;
    } else {
      try {
        const existingRange = XLSX.utils.decode_range(ws["!ref"]);
        if (maxRow > existingRange.e.r || maxCol > existingRange.e.c) {
          ws["!ref"] = calculatedRef;
        }
      } catch {
        ws["!ref"] = calculatedRef;
      }
    }
  }
};

export const syncGoogleSheets = async (
  sheetUrlInput: string,
  onImportRecords: (newRecords: SalesRecord[], source: SyncLog["source"], name: string, customLogMessage?: string) => void,
  onImportCollections?: (records: any[]) => void,
  onImportTargets?: (records: any[]) => void,
  onImportFunnels?: (records: any[]) => void,
  onImportSoftwareSubscriptions?: (records: any[]) => void,
  onImportLeads?: (records: any[]) => void,
) => {
  const trimmedUrl = sheetUrlInput.trim();
  
  // Transform standard Google Sheet URLs to the exported XLSX format directly.
  // This allows APKs/WebViews to fetch the XLSX sheet stream directly without a backend fallback when CORS permits.
  let directExportUrl = trimmedUrl;
  if (directExportUrl.includes("/pubhtml")) {
    directExportUrl = directExportUrl.replace("/pubhtml", "/pub");
  }

  if (directExportUrl.includes("/pub")) {
    if (directExportUrl.includes("output=")) {
      directExportUrl = directExportUrl.replace(/output=[a-zA-Z0-9_-]+/g, "output=xlsx");
    } else {
      directExportUrl = directExportUrl + (directExportUrl.includes("?") ? "&" : "?") + "output=xlsx";
    }
  } else if (directExportUrl.includes("/edit")) {
    const editIndex = directExportUrl.indexOf("/edit");
    directExportUrl = directExportUrl.substring(0, editIndex) + "/export?format=xlsx";
  } else if (directExportUrl.includes("/htmlview")) {
    const viewIndex = directExportUrl.indexOf("/htmlview");
    directExportUrl = directExportUrl.substring(0, viewIndex) + "/export?format=xlsx";
  }

  let response: Response;
  let responseDataHtml = false;

  try {
    // 1. First choice: try fetching directly from Google's CDN with the transformed direct XLSX link.
    // This is incredibly robust in APK contexts and bypasses the proxy entirely when possible.
    response = await fetch(directExportUrl);
    if (!response.ok) {
      throw new Error(`Direct URL returned status: ${response.status}`);
    }
    
    // Check if what google returned is an HTML login/sharing screen instead of raw spreadsheet binary.
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
      responseDataHtml = true;
      throw new Error("HTML login or preview redirected.");
    }
  } catch (error: any) {
    // 2. Second choice: fallback to our hosted proxy.
    // Check if the window location points to a web host to construct proxy URL.
    let proxyBase = "";
    if (typeof window !== "undefined" && window.location) {
      const origin = window.location.origin;
      if (origin && origin.startsWith("http")) {
        proxyBase = origin;
      }
    }
    
    const proxyUrl = `${proxyBase}/api/sheets-proxy?url=${encodeURIComponent(trimmedUrl)}`;
    try {
      response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Proxy sync failed with status ${response.status}`);
      }
      
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
        // If the proxy itself returns index.html (common in APK SPAs where absolute host is missing)
        throw new Error("Local host resolved to standard webview index.html instead of spreadsheet binary.");
      }
    } catch (proxyError: any) {
      // Formulate a clean troubleshooting guide for the user depending on why it failed.
      if (responseDataHtml) {
        throw new Error("Your sheet link appears to be a generic private collaborator link. In Google Sheets, please go to: File -> Share -> Publish to the Web, select 'Entire Document' and 'Microsoft Excel (.xlsx)', and copy that published link to sync.");
      }
      throw new Error(`Sync failed. Please ensure your Google Sheet is fully published to the web as an Excel spreadsheet (.xlsx/CSV) and the device has a live internet connection.`);
    }
  }

  const arrBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrBuffer, { type: "array", cellDates: true });
  
  if (workbook.SheetNames.length === 0) {
    throw new Error("Unable to read sheets from publication document. Ensure document is not empty.");
  }

  const getSheetTotalRows = (ws: XLSX.WorkSheet, parsedLen: number): number => {
    if (!ws || !ws["!ref"]) return parsedLen;
    try {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      return Math.max(parsedLen, range.e.r - range.s.r);
    } catch (e) {
      return parsedLen;
    }
  };

  let parsedSalesCount = 0;
  let totalSalesCount = 0;
  let parsedCollectionsCount = 0;
  let totalCollectionsCount = 0;
  let parsedTargetsCount = 0;
  let totalTargetsCount = 0;
  let parsedFunnelsCount = 0;
  let totalFunnelsCount = 0;
  let parsedSoftwareCount = 0;
  let totalSoftwareCount = 0;
  let parsedLeadsCount = 0;
  let totalLeadsCount = 0;

  let accumulatedSalesRecords: SalesRecord[] = [];
  let defaultSalesName = "Google Live Sales";

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    ensureCorrectReferenceRange(worksheet);
    const initialRawJson = XLSX.utils.sheet_to_json(worksheet) as any[];
    const rawJson = initialRawJson.filter(row => {
      const values = Object.values(row).map(v => String(v || "").trim());
      return values.some(v => v !== "");
    });
    if (rawJson.length === 0) continue;

    const firstRow = rawJson[0];
    const rowKeys = Object.keys(firstRow).map(k => k.trim().toLowerCase());

    let sheetType = "";
    const lowerSheetName = sheetName.toLowerCase();

    if (
      lowerSheetName === "sbd" ||
      lowerSheetName === "sbm" ||
      lowerSheetName === "sbed" ||
      lowerSheetName.includes("sbe") ||
      lowerSheetName.includes("software")
    ) {
      sheetType = "software";
    } else if (
      lowerSheetName === "sla" ||
      lowerSheetName === "sla=sales lead analysis" ||
      lowerSheetName.includes("lead analysis") ||
      lowerSheetName.includes("sales lead") ||
      lowerSheetName.includes("leads")
    ) {
      sheetType = "lead_analysis";
    } else if (
      lowerSheetName.includes("funnel") ||
      lowerSheetName.includes("deal") ||
      lowerSheetName.includes("pipeline") ||
      lowerSheetName.includes("opportunity") ||
      lowerSheetName.includes("ledger") ||
      lowerSheetName.includes("row")
    ) {
      sheetType = "funnel";
    } else if (
      lowerSheetName.includes("target") ||
      lowerSheetName.includes("quota") ||
      lowerSheetName.includes("performance") ||
      lowerSheetName.includes("goal") ||
      lowerSheetName.includes("board") ||
      lowerSheetName.includes("analytics")
    ) {
      sheetType = "target";
    } else if (
      lowerSheetName.includes("collection") ||
      lowerSheetName.includes("payment") ||
      lowerSheetName.includes("receipt") ||
      lowerSheetName.includes("financial") ||
      lowerSheetName.includes("overview")
    ) {
      sheetType = "collection";
    } else if (
      lowerSheetName.includes("sale") ||
      lowerSheetName.includes("invoice")
    ) {
      sheetType = "sales";
    } else {
      const hasFunnel = rowKeys.some(k => ["partner", "salesman", "quarter", "start date", "deal", "pipeline", "brand", "stage"].some(p => k.includes(p)));
      const hasTarget = rowKeys.some(k => ["target", "quota", "sales target", "collection target", "monthly target"].some(p => k.includes(p)));
      const hasCollection = rowKeys.some(k => ["collected", "transaction", "payment", "txn", "receipt"].some(p => k.includes(p)));
      const hasSales = rowKeys.some(k => ["sales person", "salesperson", "invoice", "sales order", "sales date", "buyer group", "exclude vat"].some(p => k.includes(p)));
      const hasSoftware = rowKeys.some(k => ["mrc", "otc", "hosting", "domain", "ssl", "sbd", "sbe", "sbm", "software", "subscription"].some(p => k.includes(p)));
      const hasLeads = rowKeys.some(k => ["leads ref", "lead value", "rfq/otm/ltm", "lead ref", "leads"].some(p => k.includes(p)));

      if (hasSoftware) sheetType = "software";
      else if (hasLeads) sheetType = "lead_analysis";
      else if (hasFunnel) sheetType = "funnel";
      else if (hasTarget) sheetType = "target";
      else if (hasCollection) sheetType = "collection";
      else if (hasSales) sheetType = "sales";
      else sheetType = "sales";
    }

    const currentTotalRows = getSheetTotalRows(worksheet, rawJson.length);

    if (sheetType === "sales") {
      const parsedRecords: (SalesRecord | null)[] = rawJson.map((row: any, idx) => {
        const innerKeys = Object.keys(row);
        const findVal = (possibleNames: string[], defaultVal: any = "") => {
          const foundKey = innerKeys.find(k => 
            possibleNames.some(p => k.trim().toLowerCase() === p.toLowerCase())
          );
          return foundKey !== undefined ? row[foundKey] : defaultVal;
        };

        const buyer = findVal(["Buyer", "Client", "Customer", "Customers"], "");
        const invoice = findVal(["Invoice", "Inv"], "");
        const totalPriceInput = findVal(["Total Price", "Total", "Grand Total", "Amount"], null);
        
        const invoiceDateRaw = findVal(["Invoice Date", "InvoiceDate"], "");
        const salesDateRaw = findVal(["Sales Date", "SalesDate"], "");
        
        // Validation: If no buyer, no invoice, no price AND no dates, skip it.
        // Also skip if it completely lacks a date, as it's likely junk data.
        if (!invoiceDateRaw && !salesDateRaw) {
          return null;
        }

        if (!buyer && !invoice && (totalPriceInput === null || parseNumeric(totalPriceInput) === 0)) {
          return null;
        }

        const mapped: any = { No: idx + 1 };
        mapped.Branch = findVal(["Branch", "Outlet", "Location"], "Unassigned");
        mapped["Sales Person"] = findVal(["Sales Person", "SalesPerson", "Seller", "Account Manager"], "Unassigned");
        mapped["Buyer Group"] = findVal(["Buyer Group", "BuyerGroup", "Industry", "Segment"], "Telecom");
        mapped["Sales Order"] = findVal(["Sales Order", "SalesOrder", "SO"], `SO-WEB-${100 + idx}`);
        mapped.Invoice = invoice || `INV-WEB-${1000 + idx}`;
        mapped.Remarks = findVal(["Remarks", "Notes"], "Google Sheets Live Sync");
        mapped.Buyer = buyer || "Enterprise Client";
        mapped.Brand = findVal(["Brand", "Manufacturer", "Vendor"], "Fortinet");
        mapped.Group = findVal(["Group", "Category"], "Security");
        mapped.Product = findVal(["Product", "Asset"], "Enterprise Core Hub");
        mapped.Quantity = parseNumeric(findVal(["Quantity", "Qty"], 1), 1);
        mapped["Unit Price"] = parseNumeric(findVal(["Unit Price", "UnitPrice"], 0), 0);
        
        const modeVal = String(findVal(["VAT Mode", "Tax Mode", "Mode", "Customization"], "both")).toLowerCase();
        let mode: "excl-both" | "only-vat" | "only-tax" | "both" = "both";
        if (modeVal.includes("excl") || modeVal.includes("no")) mode = "excl-both";
        else if (modeVal.includes("only vat") || (modeVal.includes("vat") && !modeVal.includes("tax"))) mode = "only-vat";
        else if (modeVal.includes("only tax") || (modeVal.includes("tax") && !modeVal.includes("vat"))) mode = "only-tax";
        mapped.vatTaxMode = mode;

        const existingNet = findVal(["Exclude Vat Tax", "Net Sales", "Net Price", "Amount Excl Tax"], null);
        mapped["Exclude Vat Tax"] = existingNet !== null ? parseNumeric(existingNet) : (mapped.Quantity * mapped["Unit Price"]);
        
        const existingVat = findVal(["Vat", "VAT Amount", "Treasury VAT"], null);
        const existingTax = findVal(["Tax", "Tax Amount", "Income Tax", "AIT"], null);
        
        mapped.Vat = existingVat !== null ? parseNumeric(existingVat) : Math.round(mapped["Exclude Vat Tax"] * 0.10);
        mapped.Tax = existingTax !== null ? parseNumeric(existingTax) : Math.round(mapped["Exclude Vat Tax"] * 0.05);
        
        mapped["Vat & Tax"] = mapped.Vat + mapped.Tax;
        mapped["Total Price"] = totalPriceInput !== null ? parseNumeric(totalPriceInput) : (mapped["Exclude Vat Tax"] + mapped["Vat & Tax"]);
        
        mapped["Invoice Date"] = formatToYmd(invoiceDateRaw);
        mapped["Sales Date"] = formatToYmd(salesDateRaw);
        mapped["Product Manager"] = findVal(["Product Manager", "PM"], "Farzana Ahmed");

        return mapped as SalesRecord;
      });

      const actualRecords = parsedRecords.filter((r): r is SalesRecord => r !== null);
      accumulatedSalesRecords = [...accumulatedSalesRecords, ...actualRecords];
      defaultSalesName = sheetName || "Google Live Sales";
      parsedSalesCount += actualRecords.length;
      totalSalesCount += currentTotalRows;

    } else if (sheetType === "collection" && onImportCollections) {
      const collRecords = rawJson.map((row: any, idx) => ({
        id: `coll-gs-${idx}-${Date.now()}`,
        paymentDate: formatToYmd(row["Payment Date"] || row["Date"] || "2026-05-27"),
        transactionNo: row["Transaction No"] || row["Transaction"] || row["TXN"] || "",
        buyerName: row["Buyer Name"] || row["Buyer"] || row["Customer"] || "Unknown",
        invoiceNo: row["Invoice No"] || row["Invoice"] || row["INV"] || "",
        amountCollected: parseNumeric(row["Amount Collected"] || row["Amount"] || 0),
        paymentMethod: row["Payment Method"] || row["Method"] || "Transfer",
        status: row["Status"] || "Initial",
        remarks: row["Remarks"] || "Google Sheet Sync",
        branch: row["Branch"] || row["Location"] || row["Outlet"] || row["Branch Location"] || undefined,
      }));
      onImportCollections(collRecords);
      parsedCollectionsCount += collRecords.length;
      totalCollectionsCount += currentTotalRows;

    } else if (sheetType === "software") {
      const parsedSubs = rawJson.map((row: any, idx) => {
        const innerKeys = Object.keys(row);
        const findVal = (possibleNames: string[], defaultVal: any = "") => {
          const foundKey = innerKeys.find(k => 
            possibleNames.some(p => k.trim().toLowerCase() === p.toLowerCase())
          );
          return foundKey !== undefined ? row[foundKey] : defaultVal;
        };

        const accountName = findVal(["Account Name", "Account", "Client", "Customer Name", "Customer"], "Unknown Client");
        const brand = findVal(["Brand", "Publisher", "Vendor Brand"], "Other");
        const product = findVal(["Product/Service", "Product", "Service"], "Unknown Product");
        const partNo = findVal(["Part No", "Part Number"], "");
        const contractNo = findVal(["Ref/Contract No", "Ref", "Contract No", "Contract"], "");
        const tenure = findVal(["Tenure", "Term"], "Annual");
        const activatedOn = formatToYmd(findVal(["Activated On", "Activation Date", "Activated"], ""));
        const expiresOn = formatToYmd(findVal(["Expires On", "Expiry Date", "Expires"], ""));
        const qty = parseNumeric(findVal(["Qty.", "Qty", "Quantity"], 1), 1);
        const unitPrice = parseNumeric(findVal(["Unit Price", "UnitPrice", "Price"], 0), 0);
        const totalValue = parseNumeric(findVal(["Total Value", "TotalValue", "Total"], 0), 0) || (qty * unitPrice);
        const vendorCol = findVal(["Vendor", "Partner", "Supplier"], "SMART TECH");
        const otherInfo = findVal(["Other Info", "Info", "Remarks"], "");

        const cleanVendorVal = String(vendorCol).trim().toLowerCase();
        let status = "Active";
        let renewalStage: any = "Not Started";
        let prob = 100;

        const expiryDate = expiresOn ? new Date(expiresOn) : null;
        const referenceDate = new Date("2026-06-04");
        let daysRemaining = 999;
        if (expiryDate && !isNaN(expiryDate.getTime())) {
          const diffTime = expiryDate.getTime() - referenceDate.getTime();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        if (cleanVendorVal === "lost") {
          status = "Expired";
          renewalStage = "Lost";
          prob = 0;
        } else if (cleanVendorVal === "expired") {
          status = "Expired";
          renewalStage = "Lost";
          prob = 0;
        } else if (cleanVendorVal === "proposal") {
          status = "Active";
          renewalStage = "Quotation Sent";
          prob = 40;
        } else {
          if (expiryDate && daysRemaining < 0) {
            status = "Expired";
            renewalStage = "Customer Contacted";
            prob = 50;
          } else {
            status = "Active";
            if (daysRemaining <= 30) {
              renewalStage = "Negotiation";
              prob = 90;
            } else if (daysRemaining <= 60) {
              renewalStage = "Quotation Sent";
              prob = 80;
            } else if (daysRemaining <= 90) {
              renewalStage = "Customer Contacted";
              prob = 75;
            } else {
              renewalStage = "Not Started";
              prob = 100;
            }
          }
        }

        const remarksParts = [];
        if (vendorCol && !["lost", "expired", "proposal"].includes(cleanVendorVal)) {
          remarksParts.push(`Distributor/Partner: ${vendorCol}`);
        }
        if (otherInfo) {
          remarksParts.push(`Other Info: ${otherInfo}`);
        }

        return {
          id: `sub-gs-${idx}-${Date.now()}`,
          account_name: accountName,
          customer_id: `CUST-SW-${1000 + idx}`,
          brand_oem: brand,
          local_vendor: vendorCol,
          product_name: product,
          part_no: partNo,
          contract_no: contractNo,
          tenure: tenure,
          activated_on: activatedOn || "2025-06-01",
          expires_on: expiresOn || "2026-06-01",
          quantity: qty,
          unit_price: unitPrice,
          total_value: totalValue,
          currency: "BDT",
          renewal_stage: renewalStage,
          renewal_probability: prob,
          status: status,
          sales_owner: "M. A. Rahman",
          competitor: "",
          remarks: remarksParts.join(" | ") || "Imported contract config details fully matched",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      if (onImportSoftwareSubscriptions) {
        onImportSoftwareSubscriptions(parsedSubs);
      } else {
        safeLocalStorage.setItem("salespulse_sw_subscriptions_v1", JSON.stringify(parsedSubs));
      }
      parsedSoftwareCount += parsedSubs.length;
      totalSoftwareCount += currentTotalRows;

    } else if (sheetType === "target" && onImportTargets) {
      onImportTargets(rawJson);
      parsedTargetsCount += rawJson.length;
      totalTargetsCount += currentTotalRows;

    } else if (sheetType === "funnel" && onImportFunnels) {
      onImportFunnels(rawJson);
      parsedFunnelsCount += rawJson.length;
      totalFunnelsCount += currentTotalRows;
    } else if (sheetType === "lead_analysis" && onImportLeads) {
      onImportLeads(rawJson);
      parsedLeadsCount += rawJson.length;
      totalLeadsCount += currentTotalRows;
    }
  }

  const parts: string[] = [];
  if (parsedSalesCount > 0) parts.push(`Sales: ${parsedSalesCount}/${totalSalesCount} rows`);
  if (parsedCollectionsCount > 0) parts.push(`Collections: ${parsedCollectionsCount}/${totalCollectionsCount} rows`);
  if (parsedTargetsCount > 0) parts.push(`Targets: ${parsedTargetsCount}/${totalTargetsCount} rows`);
  if (parsedFunnelsCount > 0) parts.push(`Funnels: ${parsedFunnelsCount}/${totalFunnelsCount} rows`);
  if (parsedSoftwareCount > 0) parts.push(`Software Subscriptions: ${parsedSoftwareCount}/${totalSoftwareCount} rows`);
  if (parsedLeadsCount > 0) parts.push(`Leads: ${parsedLeadsCount}/${totalLeadsCount} rows`);

  const customMessage = `Google Sheets live sync successfully completed! Ingested stats: ${parts.join(", ")}.`;

  onImportRecords(accumulatedSalesRecords, "Google Sheets Sync", defaultSalesName, customMessage);
  return customMessage;
};

/**
 * Pushes the updated Lead analysis records back to the Google Sheet using the Apps Script Web App API
 */
export const pushLeadsToGoogleSheet = async (
  appsScriptUrl: string,
  records: LeadAnalysisRecord[]
): Promise<{ success: boolean; message: string }> => {
  if (!appsScriptUrl || !appsScriptUrl.trim()) {
    return { success: false, message: "No Apps Script API URL configured." };
  }

  try {
    const payload = {
      action: "sync_leads",
      sheet: "Leads",
      records: records,
    };

    // We make a call to our Express write-proxy to guarantee bypass of any CORS or iframe redirect constraints
    const response = await fetch("/api/sheets-write-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: appsScriptUrl.trim(),
        payload: payload,
      }),
    });

    if (!response.ok) {
      throw new Error(`Write API responded with status ${response.status}`);
    }

    const data = await response.json();
    if (data && (data.success || data.status === "success")) {
      return {
        success: true,
        message: data.message || `Successfully synced ${records.length} leads in real time directly to Google Sheets!`,
      };
    } else {
      throw new Error(data.error || "Google Apps Script rejected transaction payload.");
    }
  } catch (error: any) {
    console.error("Failed to sync leads to cloud Google Sheets:", error);
    return {
      success: false,
      message: `Cloud Sync Failure: ${error.message || "Failed to contact Google Script API Web App"}`,
    };
  }
};

