/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  Calendar,
  Percent,
  Target,
  Building2,
  User as UserIcon,
  Calculator,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Scale,
  Eye,
  Sliders,
  Check,
  Key,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Search,
  Upload,
  Database,
  History,
  FileSpreadsheet,
  FileText,
  HelpCircle,
} from "lucide-react";
import {
  DashboardTheme,
  SalesRecord,
  YearlyEntityTarget,
  YearlyTaxConfig,
  CustomBuyerGroup,
  SyncLog,
} from "../types";
import {
  getYearlyTaxConfigs,
  saveYearlyTaxConfigs,
  getYearlyEntityTargets,
  saveYearlyEntityTargets,
  getDateFormat,
  saveDateFormat,
  getSalesYears,
  getMonthFormat,
  saveMonthFormat,
  getFiscalYearFormat,
  saveFiscalYearFormat,
  getSalesYearFormat,
  saveSalesYearFormat,
  getMonthsList,
  getLocalGeminiApiKey,
  saveLocalGeminiApiKey,
  getCustomBuyerGroups,
  saveCustomBuyerGroups,
  formatToYmd,
} from "../db/localDb";
import { formatBDT, parseNumeric } from "../utils/format";
import * as XLSX from "xlsx";
import { ensureCorrectReferenceRange, syncGoogleSheets } from "../utils/syncUtils";
import { DataTemplatePage } from "./DashboardPages";

const GAS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script for SalesPulse Bi-directional Real-Time Sync
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
}`;

interface SettingsPageProps {
  allRecords: SalesRecord[];
  theme: DashboardTheme;
  syncLogs?: SyncLog[];
  onImportRecords?: (newRecords: SalesRecord[], source: SyncLog["source"], name: string, customLogMessage?: string) => void;
  onImportCollections?: (records: any[]) => void;
  onImportTargets?: (records: any[]) => void;
  onImportFunnels?: (records: any[]) => void;
  onImportSoftwareSubscriptions?: (records: any[]) => void;
  onImportLeads?: (records: any[]) => void;
  onResetDb?: () => void;
}

export default function SettingsPage({
  allRecords,
  theme,
  syncLogs = [],
  onImportRecords,
  onImportCollections,
  onImportTargets,
  onImportFunnels,
  onImportSoftwareSubscriptions,
  onImportLeads,
  onResetDb,
}: SettingsPageProps) {
  const [activeYear, setActiveYear] = useState<number>(
    new Date().getFullYear(),
  );
  
  // Navigation tabs for premium settings structure
  const [activeTab, setActiveTab ] = useState<"targets" | "preferences" | "policy" | "groups" | "sync_maint" | "data_schema">("targets");
  const [targetEditType, setTargetEditType] = useState<"Branch" | "KAM">("Branch");

  // State for Synchronization & Database Management
  const [activeSyncTab, setActiveSyncTab] = useState<'upload' | 'sheets'>('upload');
  const [sheetUrlInput, setSheetUrlInput] = useState(() => localStorage.getItem("googleSheetUrl") || "");
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState(() => localStorage.getItem("googleAppsScriptUrl") || "");
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSuccessMessage, setSyncSuccessMessage] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Parse XLS / XLSX uploaded file locales
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary", cellDates: true });
        
        const getSheetTotalRows = (ws: XLSX.WorkSheet, parsedLen: number): number => {
          if (!ws || !ws["!ref"]) return parsedLen;
          try {
            const range = XLSX.utils.decode_range(ws["!ref"]);
            return Math.max(parsedLen, range.e.r - range.s.r);
          } catch (e) {
            return parsedLen;
          }
        };

        // 1. Process Sales Sheet
        const salesSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("sale")) || workbook.SheetNames[0];
        const salesWs = workbook.Sheets[salesSheetName];
        ensureCorrectReferenceRange(salesWs);
        const rawSales = XLSX.utils.sheet_to_json(salesWs) as any[];
        const salesTotalRows = getSheetTotalRows(salesWs, rawSales.length);

        let parsedRecords: SalesRecord[] = [];
        if (rawSales.length > 0) {
          parsedRecords = rawSales.map((row: any, idx) => {
            const mapped: any = { No: idx + 1 };
            const rowKeys = Object.keys(row);
            const findVal = (possibleNames: string[], defaultVal: any = "") => {
              const foundKey = rowKeys.find(k => 
                possibleNames.some(p => k.trim().toLowerCase() === p.toLowerCase())
              );
              return foundKey !== undefined ? row[foundKey] : defaultVal;
            };

            mapped.Branch = findVal(["Branch", "Outlet", "Location"], "Unassigned");
            mapped["Sales Person"] = findVal(["Sales Person", "SalesPerson", "Seller", "Account Manager"], "Unassigned");
            mapped["Buyer Group"] = findVal(["Buyer Group", "BuyerGroup", "Industry", "Segment"], "Conglomerate");
            mapped["Sales Order"] = findVal(["Sales Order", "SalesOrder", "SO", "Order No"], `SO-IMP-${100 + idx}`);
            mapped.Invoice = findVal(["Invoice", "Inv", "Billing ID"], `INV-IMP-${1000 + idx}`);
            mapped.Remarks = findVal(["Remarks", "Notes", "Comment"], "Excel Bulk Sync");
            mapped.Buyer = findVal(["Buyer", "Client", "Customer"], "Enterprise Client");
            mapped.Brand = findVal(["Brand", "Manufacturer", "Vendor"], "Cisco Systems");
            mapped.Group = findVal(["Group", "Category", "Classification"], "Networking");
            mapped.Product = findVal(["Product", "Item Description", "Asset"], "Corporate Device");
            mapped.Quantity = parseNumeric(findVal(["Quantity", "Qty", "Count"], 1), 1);
            mapped["Unit Price"] = parseNumeric(findVal(["Unit Price", "UnitPrice", "Rate"], 50000), 50000);
            
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
            mapped["Vat Amount"] = existingVat !== null ? parseNumeric(existingVat) : 0;
            mapped["Tax Amount"] = existingTax !== null ? parseNumeric(existingTax) : 0;
            
            const defaultDate = new Date().toISOString().split("T")[0];
            const rawDate = findVal(["Date", "Posting Date", "Invoiced Date", "Sales Date"], defaultDate);
            mapped.Date = formatToYmd(rawDate);

            return mapped as SalesRecord;
          });
        }

        // 2. Collections
        const collSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("collection") || n.toLowerCase().includes("payment"));
        let collRecords: any[] = [];
        let collTotalRows = 0;
        if (collSheetName) {
          const ws = workbook.Sheets[collSheetName];
          ensureCorrectReferenceRange(ws);
          collRecords = XLSX.utils.sheet_to_json(ws) as any[];
          collTotalRows = getSheetTotalRows(ws, collRecords.length);
          if (collRecords.length > 0 && onImportCollections) {
            onImportCollections(collRecords);
          }
        }

        // 3. Targets
        const targetSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("target") || n.toLowerCase().includes("kpi"));
        let rawTargets: any[] = [];
        let targetsTotalRows = 0;
        if (targetSheetName) {
          const ws = workbook.Sheets[targetSheetName];
          ensureCorrectReferenceRange(ws);
          rawTargets = XLSX.utils.sheet_to_json(ws) as any[];
          targetsTotalRows = getSheetTotalRows(ws, rawTargets.length);
          if (rawTargets.length > 0 && onImportTargets) {
            onImportTargets(rawTargets);
          }
        }

        // 4. Opportunities/Funnels
        const funnelSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("funnel") || n.toLowerCase().includes("pipeline") || n.toLowerCase().includes("opportunity") || n.toLowerCase().includes("deal"));
        let rawFunnels: any[] = [];
        let funnelsTotalRows = 0;
        if (funnelSheetName) {
          const ws = workbook.Sheets[funnelSheetName];
          ensureCorrectReferenceRange(ws);
          rawFunnels = XLSX.utils.sheet_to_json(ws) as any[];
          funnelsTotalRows = getSheetTotalRows(ws, rawFunnels.length);
          if (rawFunnels.length > 0 && onImportFunnels) {
            onImportFunnels(rawFunnels);
          }
        }

        // 5. Software Subscriptions (SBD)
        const swSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("software") || n.toLowerCase().includes("subscription") || n.toLowerCase().includes("contract") || n.toLowerCase().includes("licens"));
        let swRecords: any[] = [];
        let softwareTotalRows = 0;
        if (swSheetName) {
          const ws = workbook.Sheets[swSheetName];
          ensureCorrectReferenceRange(ws);
          swRecords = XLSX.utils.sheet_to_json(ws) as any[];
          softwareTotalRows = getSheetTotalRows(ws, swRecords.length);
          if (swRecords.length > 0 && onImportSoftwareSubscriptions) {
            onImportSoftwareSubscriptions(swRecords);
          }
        }

        // Build elegant sync statistics details
        const parts: string[] = [];
        if (parsedRecords.length > 0) parts.push(`Sales: ${parsedRecords.length}/${salesTotalRows} rows`);
        if (collSheetName) parts.push(`Collections: ${collRecords.length}/${collTotalRows} rows`);
        if (targetSheetName) parts.push(`Targets: ${rawTargets.length}/${targetsTotalRows} rows`);
        if (funnelSheetName) parts.push(`Funnels: ${rawFunnels.length}/${funnelsTotalRows} rows`);
        if (swSheetName && swRecords.length > 0) parts.push(`Software Subscriptions: ${swRecords.length}/${softwareTotalRows} rows`);

        const customMessage = `Workbook datasets successfully synchronized! Ingested stats: ${parts.join(", ")}.`;

        if (onImportRecords) {
          onImportRecords(parsedRecords, "Excel Import", file.name, customMessage);
        }

        setSyncSuccessMessage(`Processed Sheets Successfully!
• Invoiced Sales: loaded ${parsedRecords.length} out of ${salesTotalRows} potential data rows
${collSheetName ? `• Collections: loaded ${collRecords.length} out of ${collTotalRows} potential data rows` : ""}
${targetSheetName ? `• KPI Targets: loaded ${rawTargets.length} out of ${targetsTotalRows} potential data rows` : ""}
${funnelSheetName ? `• Opportunities Funnel: loaded ${rawFunnels.length} out of ${funnelsTotalRows} potential data rows` : ""}
${swSheetName && swRecords.length > 0 ? `• Software Subscriptions (SBD): loaded ${swRecords.length} out of ${softwareTotalRows} potential data rows` : ""}

* Note: Unloaded/skipped rows represent blank rows, formatting-only rows or empty entries in your Excel worksheet.`);

        setTimeout(() => setSyncSuccessMessage(""), 12000);
      } catch (err: any) {
        setSyncError(`Excel Parser Error: ${err.message || "Invalid columns mapping"}`);
        setTimeout(() => setSyncError(""), 6000);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Published Google Sheet Sync logic (using server side CORS proxy)
  const handleGoogleSheetsSync = async () => {
    if (!sheetUrlInput) {
      setSyncError("Please enter a valid published Google Sheet URL.");
      return;
    }

    setIsSyncing(true);
    setSyncError("");
    setSyncSuccessMessage("");

    try {
      const msg = await syncGoogleSheets(
        sheetUrlInput,
        (records, source, name, logMsg) => onImportRecords && onImportRecords(records, source, name, logMsg),
        onImportCollections,
        onImportTargets,
        onImportFunnels,
        onImportSoftwareSubscriptions,
        onImportLeads
      );

      setSyncSuccessMessage(msg);
      localStorage.setItem("googleSheetUrl", sheetUrlInput.trim());
      setSheetUrlInput("");
      setTimeout(() => setSyncSuccessMessage(""), 12000);
    } catch (err: any) {
      setSyncError(`Sync Fault: ${err.message || "Network Timeout. Please verify sheet publish settings."}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const [taxConfigs, setTaxConfigs] = useState<YearlyTaxConfig[]>([]);
  const [branchTargets, setBranchTargets] = useState<YearlyEntityTarget[]>([]);
  const [kamTargets, setKamTargets] = useState<YearlyEntityTarget[]>([]);
  const [dateFormat, setDateFormatState] = useState<string>("DD-MMM-YYYY");
  const [monthFormat, setMonthFormatState] = useState<string>("Short");
  const [fiscalYearFormat, setFiscalYearFormatState] = useState<string>("Jul-Jun");
  const [salesYearFormat, setSalesYearFormatState] = useState<string>("Jan-Dec");
  const [localApiKey, setLocalApiKey] = useState<string>("");

  // Custom Buyer Groups State
  const [customGroups, setCustomGroups] = useState<CustomBuyerGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupSelectedBuyers, setNewGroupSelectedBuyers] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [buyerSearchQuery, setBuyerSearchQuery] = useState("");

  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const branches = Array.from(new Set(allRecords.map((r) => r.Branch)))
    .filter(Boolean)
    .sort();
  const kams = Array.from(new Set(allRecords.map((r) => r["Sales Person"])))
    .filter((name) => name && name.toLowerCase().trim() !== "unassigned" && name.toLowerCase().trim() !== "unknown")
    .sort();

  const allUniqueBuyers = React.useMemo(() => {
    return Array.from(new Set(allRecords.map((r) => r.Buyer)))
      .filter((b) => b && String(b).trim() !== "")
      .sort();
  }, [allRecords]);

  const [selectedBranch, setSelectedBranch] = useState<string>(
    branches[0] || "",
  );
  const [selectedKam, setSelectedKam] = useState<string>(kams[0] || "");

  useEffect(() => {
    setTaxConfigs(getYearlyTaxConfigs());
    setBranchTargets(getYearlyEntityTargets("Branch"));
    setKamTargets(getYearlyEntityTargets("KAM"));
    setDateFormatState(getDateFormat());
    setMonthFormatState(getMonthFormat());
    setFiscalYearFormatState(getFiscalYearFormat());
    setSalesYearFormatState(getSalesYearFormat());
    setLocalApiKey(getLocalGeminiApiKey());
    setCustomGroups(getCustomBuyerGroups());
  }, [allRecords]);

  // Set initial selected lists if empty
  useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      setSelectedBranch(branches[0]);
    }
    if (kams.length > 0 && !selectedKam) {
      setSelectedKam(kams[0]);
    }
  }, [branches, kams, selectedBranch, selectedKam]);

  const showStatus = (type: "success" | "error", message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: null, message: "" }), 4000);
  };

  const handleSaveAll = () => {
    try {
      saveYearlyTaxConfigs(taxConfigs);
      saveYearlyEntityTargets("Branch", branchTargets);
      saveYearlyEntityTargets("KAM", kamTargets);
      saveDateFormat(dateFormat);
      saveMonthFormat(monthFormat);
      saveFiscalYearFormat(fiscalYearFormat);
      saveSalesYearFormat(salesYearFormat);
      saveLocalGeminiApiKey(localApiKey);

      // Dispatch event to refresh data across app
      window.dispatchEvent(new CustomEvent("banglabiz_vat_tax_updated"));
      showStatus(
        "success",
        "All parameters, ledger alignments, and naming configurations updated successfully.",
      );
    } catch (e) {
      showStatus("error", "Failed to preserve settings to directory memory.");
    }
  };

  const salesYears = getSalesYears();
  const fiscalYearLabel = `FY ${activeYear - 1}-${activeYear}`;
  
  const currentTaxConfig = taxConfigs.find((c) => c.year === activeYear) || {
    year: activeYear,
    vatRate: 10.0,
    taxRate: 5.0,
  };

  const updateTaxConfig = (field: "vatRate" | "taxRate", value: number) => {
    const existing = taxConfigs.find((c) => c.year === activeYear);
    if (existing) {
      setTaxConfigs(
        taxConfigs.map((c) =>
          c.year === activeYear ? { ...c, [field]: value } : c,
        ),
      );
    } else {
      setTaxConfigs([...taxConfigs, { ...currentTaxConfig, [field]: value }]);
    }
  };

  const syncTargetSubsets = (
    target: YearlyEntityTarget,
  ): YearlyEntityTarget => {
    let tSales = 0;
    let breakdown = target.monthlyBreakdown;
    if (target.monthlyBreakdown) {
      breakdown = target.monthlyBreakdown.map((m) => ({
        ...m,
        collection: m.sales,
      }));
      tSales = breakdown.reduce((s, m) => s + (m.sales || 0), 0);
    }
    return {
      ...target,
      monthlyBreakdown: breakdown,
      totalTarget: tSales,
      totalCollectionTarget: tSales,
    };
  };

  const updateMonthlyTarget = (
    type: "Branch" | "KAM",
    entityName: string,
    month: number,
    targetType: "sales" | "collection",
    value: number,
  ) => {
    const list = type === "Branch" ? branchTargets : kamTargets;
    const setter = type === "Branch" ? setBranchTargets : setKamTargets;

    let existing = list.find(
      (t) => t.year === activeYear && t.entityName === entityName,
    );

    if (!existing) {
      existing = {
        year: activeYear,
        entityName,
        totalTarget: 0,
        totalCollectionTarget: 0,
        monthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          sales: 0,
          collection: 0,
        })),
      };
    } else if (
      !existing.monthlyBreakdown ||
      existing.monthlyBreakdown.length === 0
    ) {
      existing = {
        ...existing,
        monthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          sales: 0,
          collection: 0,
        })),
      };
    }

    const newBreakdown = existing.monthlyBreakdown!.map((m) =>
      m.month === month ? { ...m, [targetType]: value } : m,
    );

    const updatedTarget = syncTargetSubsets({
      ...existing,
      monthlyBreakdown: newBreakdown,
    });

    const existingIndex = list.findIndex(
      (t) => t.year === activeYear && t.entityName === entityName,
    );
    if (existingIndex >= 0) {
      setter(list.map((t, idx) => (idx === existingIndex ? updatedTarget : t)));
    } else {
      setter([...list, updatedTarget]);
    }
  };

  const getTarget = (type: "Branch" | "KAM", entityName: string) => {
    const list = type === "Branch" ? branchTargets : kamTargets;
    let t = list.find(
      (t) => t.year === activeYear && t.entityName === entityName,
    ) || {
      year: activeYear,
      entityName,
      totalTarget: 0,
      totalCollectionTarget: 0,
      monthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        sales: 0,
        collection: 0,
      })),
    };
    if (!t.monthlyBreakdown || t.monthlyBreakdown.length === 0) {
      t.monthlyBreakdown = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        sales: 0,
        collection: 0,
      }));
    }
    return t;
  };

  // Mathematical target alignment function requested:
  // "All KAM's target sum is equal to Branch Target"
  const handleAutoAlignKams = () => {
    const updatedKamTargets = [...kamTargets];

    // Align month-by-month target allocations of KAMs to combined branch targets
    for (let month = 1; month <= 12; month++) {
      let branchMonthlySalesSum = 0;
      let branchMonthlyCollSum = 0;

      // Sum Branch monthly values for active year
      branches.forEach((bName) => {
        const t = branchTargets.find((b) => b.year === activeYear && b.entityName === bName);
        if (t && t.monthlyBreakdown) {
          const mData = t.monthlyBreakdown.find((m) => m.month === month);
          if (mData) {
            branchMonthlySalesSum += mData.sales || 0;
            branchMonthlyCollSum += mData.collection || 0;
          }
        }
      });

      // Sum KAM monthly values for active year
      let kamMonthlySalesSum = 0;
      let kamMonthlyCollSum = 0;
      kams.forEach((kName) => {
        const t = updatedKamTargets.find((k) => k.year === activeYear && k.entityName === kName);
        if (t && t.monthlyBreakdown) {
          const mData = t.monthlyBreakdown.find((m) => m.month === month);
          if (mData) {
            kamMonthlySalesSum += mData.sales || 0;
            kamMonthlyCollSum += mData.collection || 0;
          }
        }
      });

      // Distribute branch combined month values to each active KAM
      kams.forEach((kName) => {
        let existingIndex = updatedKamTargets.findIndex(
          (t) => t.year === activeYear && t.entityName === kName,
        );

        if (existingIndex === -1) {
          const defaultTarget: YearlyEntityTarget = {
            year: activeYear,
            entityName: kName,
            totalTarget: 0,
            totalCollectionTarget: 0,
            monthlyBreakdown: Array.from({ length: 12 }, (_, i) => ({
              month: i + 1,
              sales: 0,
              collection: 0,
            })),
          };
          updatedKamTargets.push(defaultTarget);
          existingIndex = updatedKamTargets.length - 1;
        }

        const targetEntity = updatedKamTargets[existingIndex];
        if (!targetEntity.monthlyBreakdown) {
          targetEntity.monthlyBreakdown = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            sales: 0,
            collection: 0,
          }));
        }

        const mData = targetEntity.monthlyBreakdown.find((m) => m.month === month);
        if (mData) {
          // Rule-based redistribution
          if (kamMonthlySalesSum === 0) {
            // Equal distribution if no existing target ratios
            mData.sales = Math.round(branchMonthlySalesSum / kams.length);
          } else {
            // Proportional distribution preserving key personnel ratios
            const ratio = (mData.sales || 0) / kamMonthlySalesSum;
            mData.sales = Math.round(branchMonthlySalesSum * ratio);
          }

          if (kamMonthlyCollSum === 0) {
            mData.collection = Math.round(branchMonthlyCollSum / kams.length);
          } else {
            const ratio = (mData.collection || 0) / kamMonthlyCollSum;
            mData.collection = Math.round(branchMonthlyCollSum * ratio);
          }
        }
      });
    }

    // Stabilize entity summaries (totalTarget & totalCollectionTarget) for modified entities
    const finalized = updatedKamTargets.map((kt) => {
      if (kt.year === activeYear) {
        return syncTargetSubsets(kt);
      }
      return kt;
    });

    setKamTargets(finalized);
    showStatus(
      "success",
      "Dynamic Balance Recalibration: All Key Accounts Manager (KAM) target matrices aligned exactly to active Branch totals.",
    );
  };

  // Date formatted preview generator for premium selector
  const getFormattedDatePreview = (fmt: string) => {
    const sampleDate = new Date("2026-05-31T08:58:42Z");
    const yy = sampleDate.getFullYear();
    const mm = String(sampleDate.getMonth() + 1).padStart(2, "0");
    const dd = String(sampleDate.getDate()).padStart(2, "0");
    if (fmt === "DD-MMM-YYYY") return `${dd}-MAY-${yy}`;
    if (fmt === "YYYY-MM-DD") return `${yy}-${mm}-${dd}`;
    if (fmt === "DD/MM/YYYY") return `${dd}/${mm}/${yy}`;
    if (fmt === "MM/DD/YYYY") return `${mm}/${dd}/${yy}`;
    if (fmt === "DD-MM-YYYY") return `${dd}-${mm}-${yy}`;
    return `${dd}-MAY-${yy}`;
  };

  // Calculations for Target Reconciliation Display
  const totalBranchSalesSum = branchTargets
    .filter((t) => t.year === activeYear)
    .reduce((s, t) => s + t.totalTarget, 0);

  const totalBranchCollectionSum = branchTargets
    .filter((t) => t.year === activeYear)
    .reduce((s, t) => s + (t.totalCollectionTarget || 0), 0);

  const totalKamSalesSum = kamTargets
    .filter((t) => t.year === activeYear)
    .reduce((s, t) => s + t.totalTarget, 0);

  const totalKamCollectionSum = kamTargets
    .filter((t) => t.year === activeYear)
    .reduce((s, t) => s + (t.totalCollectionTarget || 0), 0);

  const salesTargetMismatch = Math.abs(totalBranchSalesSum - totalKamSalesSum) > 5; // allow minimal rounding buffer
  const collTargetMismatch = Math.abs(totalBranchCollectionSum - totalKamCollectionSum) > 5;
  const isAligned = !salesTargetMismatch && !collTargetMismatch;

  return (
    <div className="space-y-6 pb-20">
      {/* Title & Global Control Bar */}
      <div
        className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col md:flex-row md:items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-400/20">
            <Settings className="text-indigo-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Enterprise Control Parameters
            </h2>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
              Manage core targets, calendar views & legislative tax ratios
            </p>
          </div>
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center gap-4 w-full md:w-auto">
          {status.type && (
            <div
              className={`px-4 py-2.5 rounded-lg text-xs font-semibold animate-pulse border ${
                status.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              {status.message}
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
            <Calendar size={14} className="text-slate-400 ml-2" />
            <select
              value={activeYear}
              onChange={(e) => setActiveYear(parseInt(e.target.value))}
              className="bg-transparent border-none text-slate-200 text-xs focus:ring-0 cursor-pointer font-mono font-bold outline-none pr-8"
            >
              {salesYears.map((y) => (
                <option key={y} value={y} className="bg-slate-950 text-white font-mono">
                  {y} Sales Year / FY {y - 1}-{y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSaveAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
          >
            <Save size={15} />
            Commit Changes
          </button>
        </div>
      </div>

      {/* Premium Tabbed Navigation Segmentor */}
      <div className="grid grid-cols-2 md:flex md:flex-row gap-2 p-1.5 bg-slate-950/80 border border-slate-800/80 rounded-xl w-full md:w-max">
        {[
          {
            id: "targets",
            label: "Targets & Allocations",
            icon: "🎯",
            activeColor: "bg-indigo-500/10 border-indigo-500/40 text-indigo-400 font-black shadow-lg shadow-indigo-600/10",
            hoverColor: "hover:text-indigo-300 hover:bg-indigo-500/5 hover:border-slate-800"
          },
          {
            id: "preferences",
            label: "System Preferences",
            icon: "⚙️",
            activeColor: "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-black shadow-lg shadow-emerald-600/10",
            hoverColor: "hover:text-emerald-300 hover:bg-emerald-500/5 hover:border-slate-800"
          },
          {
            id: "policy",
            label: "Policy & Audit Rates",
            icon: "⚖️",
            activeColor: "bg-amber-500/10 border-amber-500/40 text-amber-400 font-black shadow-lg shadow-amber-600/10",
            hoverColor: "hover:text-amber-300 hover:bg-amber-500/5 hover:border-slate-800"
          },
          {
            id: "groups",
            label: "Custom Buyer Groups",
            icon: "🏢",
            activeColor: "bg-rose-500/10 border-rose-500/40 text-rose-400 font-black shadow-lg shadow-rose-600/10",
            hoverColor: "hover:text-rose-300 hover:bg-rose-500/5 hover:border-slate-800"
          },
          {
            id: "sync_maint",
            label: "Sync & Database",
            icon: "🔄",
            activeColor: "bg-cyan-500/10 border-cyan-500/40 text-cyan-400 font-black shadow-lg shadow-cyan-600/10",
            hoverColor: "hover:text-cyan-300 hover:bg-cyan-500/5 hover:border-slate-800"
          },
          {
            id: "data_schema",
            label: "Data Integration Hub",
            icon: "📋",
            activeColor: "bg-purple-500/10 border-purple-500/40 text-purple-400 font-black shadow-lg shadow-purple-600/10",
            hoverColor: "hover:text-purple-300 hover:bg-purple-500/5 hover:border-slate-800"
          },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-3 md:py-2.5 rounded-lg text-[10px] md:text-xs font-bold font-mono transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 border w-full md:w-auto uppercase tracking-wider ${
                isActive
                  ? `${tab.activeColor} scale-[1.01]`
                  : `border-slate-900/40 text-slate-450 bg-slate-900/20 ${tab.hoverColor}`
              }`}
            >
              <span className="text-xs md:text-sm shrink-0">{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB SCREEN 1: Targets & Allocations */}
      {activeTab === "targets" && (
        <div className="space-y-6">
          {/* Executive Target Alignment Audit Panel */}
          <div
            className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} bg-radial from-slate-950 to-transparent`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Scale className="text-amber-500" size={18} />
                <h3 className="font-bold text-white text-sm">
                  CFO Ledger Allocation & Alignments Validation
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase">
                <span>Active Year: {activeYear}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Branch Total Box */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 font-mono uppercase font-semibold">
                    1. Combined Branch Targets
                  </p>
                  <p className="text-lg font-bold text-indigo-100 font-mono mt-1">
                    {formatBDT(totalBranchSalesSum)}
                  </p>
                  <p className="text-[10px] text-slate-400/70 font-mono mt-0.5">
                    Coll: {formatBDT(totalBranchCollectionSum)}
                  </p>
                </div>
                <Building2 size={24} className="opacity-15 text-indigo-400" />
              </div>

              {/* Status Bridge */}
              <div className="flex flex-col items-center justify-center py-2">
                {isAligned ? (
                  <div className="flex flex-col items-center text-center">
                    <div className="p-1 px-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 flex items-center gap-1.5 text-xs font-bold">
                      <CheckCircle size={12} />
                      Perfect Balance
                    </div>
                    <p className="text-[9px] text-slate-500 font-mono leading-relaxed mt-2 max-w-[200px]">
                      Zero allocation offset. Cumulative KAM targets equal branch targets exactly.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center w-full">
                    <div className="p-1 px-3 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20 flex items-center gap-1.5 text-xs font-bold">
                      <AlertTriangle size={12} />
                      Discrepancy Detected
                    </div>
                    <p className="text-[9px] text-amber-400/80 font-mono leading-relaxed mt-1">
                      Variance: ৳{formatBDT(Math.abs(totalBranchSalesSum - totalKamSalesSum))} BDT
                    </p>
                    <button
                      onClick={handleAutoAlignKams}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 transition text-slate-950 font-extrabold text-[10px] uppercase rounded-lg tracking-wider font-mono cursor-pointer shadow-md shadow-amber-500/10"
                    >
                      <RefreshCw size={11} className="animate-spin-slow" />
                      Auto-Scale KAMs to Match Branch
                    </button>
                  </div>
                )}
              </div>

              {/* KAM Total Box */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 font-mono uppercase font-semibold">
                    2. Combined KAM Allocations
                  </p>
                  <p className="text-lg font-bold text-rose-300 font-mono mt-1">
                    {formatBDT(totalKamSalesSum)}
                  </p>
                  <p className="text-[10px] text-slate-400/70 font-mono mt-0.5">
                    Coll: {formatBDT(totalKamCollectionSum)}
                  </p>
                </div>
                <UserIcon size={24} className="opacity-15 text-rose-400" />
              </div>
            </div>
          </div>

          {/* Toggle Editors Section */}
          <div
            className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-indigo-400" />
                <h3 className="font-bold text-slate-200 text-sm">
                  Monthly Target Allocator Matrix
                </h3>
              </div>

              {/* Sub tabs to choose edit list */}
              <div className="flex gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
                <button
                  onClick={() => setTargetEditType("Branch")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all cursor-pointer ${
                    targetEditType === "Branch"
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Building2 size={12} className="opacity-70" />
                  🏢 Branch Targets
                </button>
                <button
                  onClick={() => setTargetEditType("KAM")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-extrabold transition-all cursor-pointer ${
                    targetEditType === "KAM"
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <UserIcon size={12} className="opacity-70" />
                  💼 KAM Portfolios
                </button>
              </div>
            </div>

            {/* List and Fields Grid */}
            {targetEditType === "Branch" ? (
              /* Branch Targets Row */
              branches.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-mono italic">
                  No branch entities tracked in active ledger records.
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Mobile Select branch Carousel */}
                  <div className="block md:hidden w-full mb-4 shrink-0">
                    <label className="block text-[10px] uppercase font-mono text-slate-500 mb-2 font-bold tracking-wider">
                      Select Branch Outlet
                    </label>
                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none snap-x">
                      {branches.map((b) => {
                        const t = getTarget("Branch", b);
                        const isSelected = selectedBranch === b;
                        return (
                          <button
                            key={b}
                            onClick={() => setSelectedBranch(b)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition-all border shrink-0 cursor-pointer snap-start ${
                              isSelected
                                ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-400 font-black shadow-lg shadow-indigo-600/5"
                                : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                              <span className="truncate max-w-[120px]">{b}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[8px] font-mono text-slate-500 font-medium">
                              <span>S: {formatBDT(t.totalTarget)}</span>
                              <span>C: {formatBDT(t.totalCollectionTarget || 0)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Desktop Select branch sidebar list */}
                  <div className="hidden md:flex w-full md:w-1/3 flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 shrink-0">
                    {branches.map((b) => {
                      const t = getTarget("Branch", b);
                      return (
                        <button
                          key={b}
                          onClick={() => setSelectedBranch(b)}
                          className={`w-full text-left px-4 py-3.5 rounded-xl text-xs transition-all border outline-none cursor-pointer ${
                            selectedBranch === b
                              ? "bg-indigo-600/10 border-indigo-500/40 text-white font-bold"
                              : "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{b}</span>
                            <span className="font-mono text-[9px] bg-indigo-900/30 text-indigo-400 px-1.5 py-0.5 rounded">
                              Target Count
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/40 opacity-80 text-[10px] font-mono">
                            <span>S: {formatBDT(t.totalTarget)}</span>
                            <span>C: {formatBDT(t.totalCollectionTarget || 0)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Monthly Editor */}
                  <div className="w-full md:w-2/3">
                    {selectedBranch && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-slate-900/40 p-3.5 rounded-xl border border-slate-800 gap-2">
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                            🏢 Branch: {selectedBranch}
                          </span>
                          <div className="flex flex-wrap gap-4 font-mono text-[10px]">
                            <span className="text-indigo-400 font-semibold">
                              Yearly Sales Target: {formatBDT(getTarget("Branch", selectedBranch).totalTarget)}
                            </span>
                            <span className="text-emerald-400 font-semibold">
                              Yearly Collection: {formatBDT(getTarget("Branch", selectedBranch).totalCollectionTarget || 0)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {getTarget("Branch", selectedBranch).monthlyBreakdown!.map((m) => (
                            <div
                              key={m.month}
                              className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80 hover:border-slate-700/65 transition-all"
                            >
                              <div className="text-[10px] font-mono text-slate-400 uppercase font-bold mb-3 border-b border-indigo-900/20 pb-1.5 flex justify-between">
                                <span>{getMonthsList()[m.month - 1]}</span>
                                <span className="text-[8px] bg-slate-900/90 text-slate-500 rounded px-1">Index: {m.month}</span>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <label className="text-[9px] text-slate-500 uppercase font-bold tracking-widest block mb-1">
                                    Sales Target (BDT)
                                  </label>
                                  <input
                                    type="number"
                                    value={m.sales === 0 ? "" : m.sales}
                                    placeholder="0"
                                    onChange={(e) =>
                                      updateMonthlyTarget(
                                        "Branch",
                                        selectedBranch,
                                        m.month,
                                        "sales",
                                        parseFloat(e.target.value) || 0,
                                      )
                                    }
                                    className="w-full bg-slate-900 border border-slate-800/80 rounded-lg px-2.5 py-2 text-xs text-indigo-100 focus:border-indigo-500 outline-none font-mono placeholder:text-slate-700 focus:ring-0 transition"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-emerald-500/70 uppercase font-bold tracking-widest block mb-1">
                                    Collection (BDT)
                                  </label>
                                  <input
                                    type="number"
                                    value={m.collection === 0 ? "" : m.collection}
                                    placeholder="0"
                                    onChange={(e) =>
                                      updateMonthlyTarget(
                                        "Branch",
                                        selectedBranch,
                                        m.month,
                                        "collection",
                                        parseFloat(e.target.value) || 0,
                                      )
                                    }
                                    className="w-full bg-slate-900 border border-slate-800/80 rounded-lg px-2.5 py-2 text-xs text-emerald-100 focus:border-emerald-500 outline-none font-mono placeholder:text-slate-700 focus:ring-0 transition"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              /* KAM Targets Row */
              kams.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-mono italic">
                  No active sales representative key accounts managers (KAM) tracked.
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Mobile Select KAM Carousel */}
                  <div className="block md:hidden w-full mb-4 shrink-0">
                    <label className="block text-[10px] uppercase font-mono text-slate-500 mb-2 font-bold tracking-wider">
                      Select KAM Portfolio
                    </label>
                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none snap-x">
                      {kams.map((kam) => {
                        const t = getTarget("KAM", kam);
                        const isSelected = selectedKam === kam;
                        return (
                          <button
                            key={kam}
                            onClick={() => setSelectedKam(kam)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition-all border shrink-0 cursor-pointer snap-start ${
                              isSelected
                                ? "bg-rose-600/20 border-rose-500/50 text-rose-400 font-black shadow-lg shadow-rose-600/5"
                                : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              <span className="truncate max-w-[120px]">{kam}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[8px] font-mono text-slate-500 font-medium">
                              <span>S: {formatBDT(t.totalTarget)}</span>
                              <span>C: {formatBDT(t.totalCollectionTarget || 0)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Desktop Select KAM List */}
                  <div className="hidden md:flex w-full md:w-1/3 flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 font-sans shrink-0">
                    {kams.map((kam) => {
                      const t = getTarget("KAM", kam);
                      return (
                        <button
                          key={kam}
                          onClick={() => setSelectedKam(kam)}
                          className={`w-full text-left px-4 py-3.5 rounded-xl text-xs transition-all border outline-none cursor-pointer ${
                            selectedKam === kam
                              ? "bg-rose-600/10 border-rose-500/40 text-white font-bold"
                              : "bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{kam}</span>
                            <span className="font-mono text-[9px] bg-rose-950/30 text-rose-400 px-1.5 py-0.5 rounded">
                              Salesperson
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/40 opacity-80 text-[10px] font-mono">
                            <span>S: {formatBDT(t.totalTarget)}</span>
                            <span>C: {formatBDT(t.totalCollectionTarget || 0)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Monthly Editor */}
                  <div className="w-full md:w-2/3">
                    {selectedKam && (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-slate-900/40 p-3.5 rounded-xl border border-slate-800 gap-2 font-mono">
                          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            💼 KAM: {selectedKam}
                          </span>
                          <div className="flex flex-wrap gap-4 text-[10px]">
                            <span className="text-rose-400 font-semibold">
                              Allocated Sales: {formatBDT(getTarget("KAM", selectedKam).totalTarget)}
                            </span>
                            <span className="text-emerald-400 font-semibold">
                              Allocated Coll: {formatBDT(getTarget("KAM", selectedKam).totalCollectionTarget || 0)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {getTarget("KAM", selectedKam).monthlyBreakdown!.map((m) => (
                            <div
                              key={m.month}
                              className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80 hover:border-slate-700/65 transition-all"
                            >
                              <div className="text-[10px] font-mono text-slate-400 uppercase font-bold mb-3 border-b border-rose-900/20 pb-1.5 flex justify-between">
                                <span>{getMonthsList()[m.month - 1]}</span>
                                <span className="text-[8px] bg-slate-900/90 text-slate-500 rounded px-1">Index: {m.month}</span>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <label className="text-[9px] text-slate-500 uppercase font-bold tracking-widest block mb-1">
                                    Sales Target (BDT)
                                  </label>
                                  <input
                                    type="number"
                                    value={m.sales === 0 ? "" : m.sales}
                                    placeholder="0"
                                    onChange={(e) =>
                                      updateMonthlyTarget(
                                        "KAM",
                                        selectedKam,
                                        m.month,
                                        "sales",
                                        parseFloat(e.target.value) || 0,
                                      )
                                    }
                                    className="w-full bg-slate-900 border border-slate-800/80 rounded-lg px-2.5 py-2 text-xs text-rose-100 focus:border-rose-500 outline-none font-mono placeholder:text-slate-700 focus:ring-0 transition"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-emerald-500/70 uppercase font-bold tracking-widest block mb-1">
                                    Collection (BDT)
                                  </label>
                                  <input
                                    type="number"
                                    value={m.collection === 0 ? "" : m.collection}
                                    placeholder="0"
                                    onChange={(e) =>
                                      updateMonthlyTarget(
                                        "KAM",
                                        selectedKam,
                                        m.month,
                                        "collection",
                                        parseFloat(e.target.value) || 0,
                                      )
                                    }
                                    className="w-full bg-slate-900 border border-slate-800/80 rounded-lg px-2.5 py-2 text-xs text-emerald-100 focus:border-emerald-500 outline-none font-mono placeholder:text-slate-700 focus:ring-0 transition"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* TAB SCREEN 2: Premium Preferences Header & Interactive Segment Cards */}
      {activeTab === "preferences" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: System Date Format */}
          <div
            className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sliders size={18} className="text-indigo-400" />
                <h3 className="font-bold text-slate-200 text-sm">System Date Format</h3>
              </div>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Choose the standard ledger timestamp format used across transactions lists, headers, exports, and audits.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
                {[
                  { value: "DD-MMM-YYYY", desc: "Default BD Short Naming Form" },
                  { value: "YYYY-MM-DD", desc: "ISO Stable Database Standard" },
                  { value: "DD/MM/YYYY", desc: "Standard Commonwealth Grid" },
                  { value: "MM/DD/YYYY", desc: "Traditional Commercial Form" },
                  { value: "DD-MM-YYYY", desc: "Standard Bangladesh Compact form" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setDateFormatState(item.value)}
                    className={`p-3 text-left rounded-xl border text-xs transition duration-200 cursor-pointer flex justify-between items-center ${
                      dateFormat === item.value
                        ? "bg-indigo-600/10 border-indigo-500/50 text-indigo-400"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    <div>
                      <div className="font-mono font-extrabold">{item.value}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
                    </div>
                    {dateFormat === item.value && (
                      <Check className="text-indigo-400" size={14} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">Live Formatted Preview</span>
              <span className="font-mono text-xs text-slate-200 font-extrabold">
                {getFormattedDatePreview(dateFormat)}
              </span>
            </div>
          </div>

          {/* Card 2: Month Naming Format */}
          <div
            className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={18} className="text-emerald-400" />
                <h3 className="font-bold text-slate-200 text-sm">Month Naming Convention</h3>
              </div>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Dictate whether months in grids and sliders utilize abbreviations, full spellings, or the local hybrid structure.
              </p>

              <div className="grid grid-cols-1 gap-2.5 mb-6">
                {[
                  { value: "Short", desc: "Strict Short Form — e.g. Jan, Feb, Mar, Apr, May [" + (monthFormat === "Short" ? "Active" : "Select") + "]" },
                  { value: "Full", desc: "Traditional Long Form — e.g. January, February, March" },
                  { value: "Mixed", desc: "Mixed Hybrid — e.g. Jan, Feb, Mar, Apr (Alternative Formatting)" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setMonthFormatState(item.value)}
                    className={`p-3 text-left rounded-xl border text-xs transition duration-200 cursor-pointer flex justify-between items-center ${
                      monthFormat === item.value
                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 font-bold"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    <span>{item.desc}</span>
                    {monthFormat === item.value && (
                      <Check className="text-emerald-400" size={14} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[9px] uppercase font-mono text-slate-500 block mb-1">Render Array Overview</span>
              <div className="flex flex-wrap gap-1">
                {monthFormat === "Mixed" &&
                  ["Jan", "Feb", "Mar", "Apr", "May"].map((m) => (
                    <span key={m} className="font-mono text-[9px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">
                      {m}
                    </span>
                  ))}
                {monthFormat === "Short" &&
                  ["Jan", "Feb", "Mar", "Apr", "May"].map((m) => (
                    <span key={m} className="font-mono text-[9px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">
                      {m}
                    </span>
                  ))}
                {monthFormat === "Full" &&
                  ["January", "February", "March"].map((m) => (
                    <span key={m} className="font-mono text-[9px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">
                      {m}
                    </span>
                  ))}
                <span className="text-[9px] text-slate-500 font-mono flex items-center">...</span>
              </div>
            </div>
          </div>

          {/* Card 3: Fiscal Year Format */}
          <div
            className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Target size={18} className="text-pink-400" />
                <h3 className="font-bold text-slate-200 text-sm">Fiscal Year Rotation Boundary</h3>
              </div>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Specify the statutory annual reporting sequence for evaluating targets and quarterly collections.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { value: "Jul-Jun", duration: "July 1 to June 30", desc: "Bangladesh NBR System" },
                  { value: "Jan-Dec", duration: "January 1 to December 31", desc: "Standard Calendar Year" },
                  { value: "Apr-Mar", duration: "April 1 to March 31", desc: "Subcontinental Legacy" },
                  { value: "Oct-Sep", duration: "October 1 to September 30", desc: "Global Institutional Year" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setFiscalYearFormatState(item.value)}
                    className={`p-3.5 text-left rounded-xl border text-xs transition duration-200 cursor-pointer flex justify-between items-center ${
                      fiscalYearFormat === item.value
                        ? "bg-pink-500/10 border-pink-500/50 text-pink-400 font-bold"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    <div>
                      <div className="font-mono text-slate-300 font-bold">{item.value}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
                    </div>
                    {fiscalYearFormat === item.value && (
                      <Check className="text-pink-400" size={14} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 mt-4">
              <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">Active Fiscal Bracket</span>
              <span className="text-[11px] text-slate-300 font-semibold font-mono">
                {fiscalYearFormat === "Jul-Jun" && `July ${activeYear - 1} through June ${activeYear}`}
                {fiscalYearFormat === "Jan-Dec" && `January ${activeYear} through December ${activeYear}`}
                {fiscalYearFormat === "Apr-Mar" && `April ${activeYear - 1} through March ${activeYear}`}
                {fiscalYearFormat === "Oct-Sep" && `October ${activeYear - 1} through September ${activeYear}`}
              </span>
            </div>
          </div>

          {/* Card 4: Sales Year Format */}
          <div
            className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sliders size={18} className="text-amber-400" />
                <h3 className="font-bold text-slate-200 text-sm">Sales Year Boundary</h3>
              </div>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Allows remapping of raw sales transaction groupings if your internal team measures achievements on custom periods.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { value: "Jan-Dec", desc: "Calendar Year Alignment" },
                  { value: "Jul-Jun", desc: "Midyear Operational Segment" },
                  { value: "Apr-Mar", desc: "Quarter-1 Commencement" },
                  { value: "Oct-Sep", desc: "Operational Year Offset" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setSalesYearFormatState(item.value)}
                    className={`p-3.5 text-left rounded-xl border text-xs transition duration-200 cursor-pointer flex justify-between items-center ${
                      salesYearFormat === item.value
                        ? "bg-amber-500/10 border-amber-500/50 text-amber-500 font-bold"
                        : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    <div>
                      <div className="font-mono text-slate-300 font-bold">{item.value}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
                    </div>
                    {salesYearFormat === item.value && (
                      <Check className="text-amber-500" size={14} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 mt-4">
              <span className="text-[9px] uppercase font-mono text-slate-500 block mb-0.5">Primary Analytic Range</span>
              <span className="text-[11px] text-slate-300 font-semibold font-mono">
                {salesYearFormat === "Jan-Dec" && `Jan 1 - Dec 31 (Calendar)`}
                {salesYearFormat === "Jul-Jun" && `Jul 1 - Jun 30 (Fiscal Offset)`}
                {salesYearFormat === "Apr-Mar" && `Apr 1 - Mar 31 (Q1 Start)`}
                {salesYearFormat === "Oct-Sep" && `Oct 1 - Sep 30 (Fiscal Offset)`}
              </span>
            </div>
          </div>

          {/* Card 5: Gemini AI Key Configuration for APK / offline client-side fallback */}
          <div
            className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} md:col-span-2 flex flex-col md:flex-row justify-between gap-6`}
          >
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <Key size={18} className="text-amber-400" />
                <h3 className="font-bold text-slate-200 text-sm">Gemini API Key (APK / Offline Mobile Client)</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                When running inside an <strong>Android APK</strong> or offline webview package, the Express Node.js back-end is not available. To use a generative <strong>SalesPulse Brain (CFO copilot)</strong> in these environments, configure your personal Gemini API Key here.
              </p>
              
              <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/15 flex gap-2">
                <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-400/90 leading-relaxed">
                  <strong>Security Architecture:</strong> This key is stored exclusively inside your phone's local secure application container (<code>localStorage</code>) and will never be uploaded to external web databases. It will only make direct, client-side queries to Google API endpoints.
                </p>
              </div>
            </div>

            <div className="w-full md:w-1/2 flex flex-col justify-between pt-2">
              <div className="space-y-2">
                <label className="block text-[10px] uppercase font-mono text-slate-500 font-bold tracking-widest">
                  Configure Gemini Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={localApiKey || ""}
                    placeholder="AIzaSy..."
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    className="w-full bg-slate-950/65 border border-slate-800 rounded-xl pl-4 pr-10 py-3 text-slate-100 text-xs focus:border-amber-500 outline-none font-mono focus:ring-0"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500">
                    <Key size={14} className="opacity-60" />
                  </div>
                </div>
                
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!localApiKey.trim()) {
                        showStatus("error", "Please input a valid Gemini API key.");
                        return;
                      }
                      saveLocalGeminiApiKey(localApiKey.trim());
                      // Raise local event so other components refresh immediately
                      window.dispatchEvent(new CustomEvent("banglabiz_local_gemini_key_updated"));
                      showStatus("success", "✓ Personal Gemini API Key registered and saved to device memory.");
                    }}
                    className="flex-1 text-center text-[10px] uppercase font-mono tracking-wider text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 py-2.5 rounded-lg border border-emerald-950/50 transition cursor-pointer font-bold"
                  >
                    Save API Key
                  </button>
                  {getLocalGeminiApiKey() && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocalApiKey("");
                        saveLocalGeminiApiKey("");
                        window.dispatchEvent(new CustomEvent("banglabiz_local_gemini_key_updated"));
                        showStatus("success", "✓ Gemini API Key erased from this device.");
                      }}
                      className="text-center text-[10px] uppercase font-mono tracking-wider text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 px-3 py-2.5 rounded-lg border border-rose-900/30 transition cursor-pointer"
                    >
                      Erase Key
                    </button>
                  )}
                </div>

                <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono mt-1">
                  <span>Input your API key starting with 'AIzaSy'</span>
                  {getLocalGeminiApiKey() ? (
                    <span className="text-emerald-400 font-bold">✓ Active saved key in browser storage ({getLocalGeminiApiKey().length} chars)</span>
                  ) : (
                    <span className="text-rose-400 italic">No key registered (offline rules engine active)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB SCREEN 3: Fiscal Policy & Stats */}
      {activeTab === "policy" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div
            className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} lg:col-span-1 space-y-4`}
          >
            <div className="flex items-center gap-2 mb-4">
              <Percent size={18} className="text-amber-500" />
              <div className="flex flex-col">
                <h3 className="font-bold text-slate-200 text-sm">
                  Fiscal Legislative Policy ({fiscalYearLabel})
                </h3>
                <span className="text-[9px] text-slate-500 font-mono uppercase">
                  Duration: Jul {activeYear - 1} - Jun {activeYear}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-500 mb-2 font-bold tracking-widest">
                  Value Added Tax (VAT Rate %)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={currentTaxConfig.vatRate}
                    onChange={(e) =>
                      updateTaxConfig("vatRate", parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-xs focus:border-indigo-500/50 transition-all outline-none font-mono"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-500 mb-2 font-bold tracking-widest">
                  Advance Income Tax (AIT Rate %)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={currentTaxConfig.taxRate}
                    onChange={(e) =>
                      updateTaxConfig("taxRate", parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-xs focus:border-indigo-500/50 transition-all outline-none font-mono"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                    %
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 mt-4">
                <p className="text-[10px] text-blue-400/80 leading-relaxed italic">
                  Statutory rates applied to general pipeline computations in {activeYear}. Total invoices utilize these variables at point of sync.
                </p>
              </div>
            </div>
          </div>

          <div
            className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} lg:col-span-2 flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calculator size={18} className="text-emerald-500" />
                <h3 className="font-bold text-slate-200 text-sm">
                  Active Year Target & Allocation Summary
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Consolidated balance sheet targets representing configured branch volumes for {activeYear}.
              </p>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2.5 border-b border-slate-850">
                  <span className="text-xs text-slate-400">Total Configured Branches</span>
                  <span className="font-mono text-xs text-slate-200 font-bold">
                    {branchTargets.filter((t) => t.year === activeYear).length} Outlets
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-850">
                  <span className="text-xs text-slate-400">Total Account Managers (KAM)</span>
                  <span className="font-mono text-xs text-slate-200 font-bold">
                    {kamTargets.filter((t) => t.year === activeYear).length} Representatives
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-850">
                  <span className="text-xs text-slate-400 font-semibold">Grand Corporate Target Sum</span>
                  <span className="font-mono text-xs text-indigo-400 font-extrabold">
                    {formatBDT(totalBranchSalesSum)} BDT
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-xs text-slate-400 font-semibold">Grand Collection Target Sum</span>
                  <span className="font-mono text-xs text-emerald-400 font-extrabold">
                    {formatBDT(totalBranchCollectionSum)} BDT
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
              <Eye size={16} className="text-slate-500 shrink-0" />
              <p className="text-[10px] text-slate-400/80 leading-relaxed">
                Changes on this dashboard remain local to the interface memory until committed. Ensure you click the "Commit Changes" button to apply edits permanently.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB SCREEN 4: Custom Buyer Groups */}
      {activeTab === "groups" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          
          {/* Creation / Editing Pane */}
          <div className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} lg:col-span-1 space-y-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Plus size={18} className="text-violet-400" />
              <h3 className="font-bold text-slate-200 text-sm">
                {editingGroupId ? "📝 Modify Custom Buyer Group" : "➕ Create Custom Buyer Group"}
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-500 mb-1.5 font-bold tracking-widest">
                  Group / Corporate Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Abul Khair Syndicate"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-xs focus:border-indigo-500/50 transition-all outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] uppercase font-mono text-slate-500 font-bold tracking-widest">
                    Select Member Buyers ({newGroupSelectedBuyers.length} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Select all matching search
                        const matched = allUniqueBuyers.filter(b => b.toLowerCase().includes(buyerSearchQuery.toLowerCase()));
                        setNewGroupSelectedBuyers(prev => Array.from(new Set([...prev, ...matched])));
                      }}
                      className="text-[9px] font-mono text-indigo-400 hover:underline cursor-pointer"
                    >
                      All Filtered
                    </button>
                    <span className="text-[9px] text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => setNewGroupSelectedBuyers([])}
                      className="text-[9px] font-mono text-rose-450 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Buyer search box */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Search buyers..."
                    value={buyerSearchQuery}
                    onChange={(e) => setBuyerSearchQuery(e.target.value)}
                    className="w-full bg-slate-950/70 border border-slate-800/80 rounded-lg pl-8 pr-4 py-1.5 text-slate-200 text-xs focus:border-indigo-500/50 outline-none font-mono"
                  />
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>

                {/* Filtered list of buyers with checkboxes */}
                <div className="h-64 overflow-y-auto border border-slate-800 bg-slate-950/50 rounded-xl p-3 space-y-2 scroll-sm-y shadow-inner">
                  {allUniqueBuyers
                    .filter(buyerName => buyerName.toLowerCase().includes(buyerSearchQuery.toLowerCase()))
                    .map((buyerName) => {
                      const isChecked = newGroupSelectedBuyers.includes(buyerName);
                      return (
                        <label
                          key={buyerName}
                          className="flex items-center gap-2 hover:bg-slate-800/20 p-1.5 rounded-lg cursor-pointer select-none text-[11px] font-mono"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setNewGroupSelectedBuyers(p => p.filter(b => b !== buyerName));
                              } else {
                                setNewGroupSelectedBuyers(p => [...p, buyerName]);
                              }
                            }}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5 shrink-0"
                          />
                          <span className={isChecked ? "text-slate-100 font-medium" : "text-slate-400"}>
                            {buyerName}
                          </span>
                        </label>
                      );
                    })}
                  {allUniqueBuyers.filter(buyerName => buyerName.toLowerCase().includes(buyerSearchQuery.toLowerCase())).length === 0 && (
                    <div className="text-center text-slate-500 py-8 text-xs italic">
                      No matching buyers found
                    </div>
                  )}
                </div>
              </div>

              {/* Save/Cancel button controls */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!newGroupName.trim()) {
                      alert("Please specify a custom corporate group name.");
                      return;
                    }
                    if (newGroupSelectedBuyers.length === 0) {
                      alert("Please select at least one buyer entity to join this group.");
                      return;
                    }

                    let updatedGroups: CustomBuyerGroup[] = [];
                    if (editingGroupId) {
                      updatedGroups = customGroups.map(g =>
                        g.id === editingGroupId
                          ? { ...g, name: newGroupName.trim(), buyers: [...newGroupSelectedBuyers] }
                          : g
                      );
                    } else {
                      const newGroupObj: CustomBuyerGroup = {
                        id: `group-${Date.now()}`,
                        name: newGroupName.trim(),
                        buyers: [...newGroupSelectedBuyers]
                      };
                      updatedGroups = [...customGroups, newGroupObj];
                    }

                    // Save the updated groups
                    saveCustomBuyerGroups(updatedGroups);
                    setCustomGroups(updatedGroups);

                    // Reset states
                    setNewGroupName("");
                    setNewGroupSelectedBuyers([]);
                    setEditingGroupId(null);
                    setBuyerSearchQuery("");
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-center bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer select-none"
                >
                  {editingGroupId ? "💾 Update Group" : "✨ Save Group"}
                </button>

                {(editingGroupId || newGroupName || newGroupSelectedBuyers.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewGroupName("");
                      setNewGroupSelectedBuyers([]);
                      setEditingGroupId(null);
                      setBuyerSearchQuery("");
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-center bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer select-none"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Area: List of Group of Companies with Stats */}
          <div className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} lg:col-span-2 space-y-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-emerald-400" />
                <h3 className="font-bold text-slate-200 text-sm">
                  Active Custom Buyer Groups & Conglomerates ({customGroups.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Mapped Local Entities</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              Create and manage custom alliances representing Parent / Holding Group of Companies. After creating a custom group, it will automatically populate as a first-class selector slice under the main dashboard filters.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[480px] overflow-y-auto pr-1 scrollbar-none">
              {customGroups.map((group) => (
                <div
                  key={group.id}
                  className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 hover:border-slate-700/60 transition flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-xs text-slate-200 block truncate max-w-[210px]" title={group.name}>
                        🏢 {group.name}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded">
                        {group.buyers.length} Subsidiaries
                      </span>
                    </div>

                    {/* Compact preview of member buyers */}
                    <div className="mt-2.5 space-y-1 font-mono">
                      <span className="text-[9px] uppercase font-mono text-slate-500 font-semibold block">Subsidiary Concerns:</span>
                      <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto scrollbar-none">
                        {group.buyers.map((b) => (
                          <span key={b} className="text-[9px] bg-slate-900 border border-slate-800/80 rounded py-0.5 px-1.5 text-slate-350 block truncate max-w-[170px]" title={b}>
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions for Group */}
                  <div className="flex justify-end gap-2 border-t border-slate-850 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGroupId(group.id);
                        setNewGroupName(group.name);
                        setNewGroupSelectedBuyers(group.buyers);
                        setBuyerSearchQuery("");
                      }}
                      className="p-1 px-2 text-[10px] text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/50 border border-slate-800 hover:border-slate-750 font-mono font-bold rounded flex items-center gap-1 cursor-pointer transition select-none"
                    >
                      <Edit2 size={10} />
                      Modify Group
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${group.name}"?`)) {
                          const updated = customGroups.filter(g => g.id !== group.id);
                          saveCustomBuyerGroups(updated);
                          setCustomGroups(updated);
                          if (editingGroupId === group.id) {
                            setNewGroupName("");
                            setNewGroupSelectedBuyers([]);
                            setEditingGroupId(null);
                          }
                        }
                      }}
                      className="p-1 px-2 text-[10px] text-rose-450 hover:text-rose-400 hover:bg-rose-500/5 border border-rose-505/10 rounded flex items-center gap-1 cursor-pointer transition select-none"
                    >
                      <Trash2 size={10} />
                      Disband
                    </button>
                  </div>
                </div>
              ))}

              {customGroups.length === 0 && (
                <div className="col-span-2 text-center py-16 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                  <Building2 size={24} className="text-slate-650 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 italic">No custom group alliances defined yet.</p>
                  <p className="text-[10px] text-slate-600 mt-1 max-w-sm mx-auto">Use the creator panel on the left to map multiple client subsidiary concerns into high-level business clusters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "sync_maint" && (
        <div className="space-y-6 animate-fade-in text-slate-100">
          {/* Top Panel Actions: Sync tools & Database administration */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Sync Hub - 7 Cols */}
            <div className={`lg:col-span-7 p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} space-y-6`}>
              <div className="flex items-center gap-3 border-b border-slate-800/40 pb-4">
                <FileSpreadsheet className="text-cyan-400 shrink-0" size={24} />
                <div>
                  <h3 className="font-bold text-slate-100 text-sm md:text-base">Workbook Synchronization Hub</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-mono">Excel Spreadsheets & Live Google Sheets ingest portal</p>
                </div>
              </div>

              {/* In-tab switch: Excel manual or Google Sheet live link */}
              <div className="flex gap-2 p-1 bg-slate-950/80 border border-slate-800 rounded-lg w-max">
                <button
                  type="button"
                  onClick={() => {
                    setSyncError("");
                    setSyncSuccessMessage("");
                    setActiveSyncTab("upload");
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer select-none transition ${activeSyncTab === "upload" ? "bg-cyan-600/10 text-cyan-400 border border-cyan-500/20" : "text-slate-450 hover:text-slate-200"}`}
                >
                  Excel Import File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSyncError("");
                    setSyncSuccessMessage("");
                    setActiveSyncTab("sheets");
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer select-none transition ${activeSyncTab === "sheets" ? "bg-cyan-600/10 text-cyan-400 border border-cyan-500/20" : "text-slate-450 hover:text-slate-200"}`}
                >
                  Live Google Sheet Connection
                </button>
              </div>

              {/* Sync Errors / Success Notifications feedback */}
              {syncError && (
                <div id="settings-sync-error-box" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex gap-2 items-start animate-fade-in font-semibold">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-400 animate-bounce" />
                  <span>{syncError}</span>
                </div>
              )}

              {syncSuccessMessage && (
                <div id="settings-sync-saved-success-box" className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex gap-2 items-start animate-fade-in font-medium whitespace-pre-line">
                  <CheckCircle size={15} className="shrink-0 mt-0.5 text-emerald-400" />
                  <span>{syncSuccessMessage}</span>
                </div>
              )}

              {/* Render Selected Sync Tab contents */}
              {activeSyncTab === "upload" ? (
                <div className={`border border-dashed rounded-xl p-8 text-center transition ${theme.isDark ? "border-slate-800 bg-slate-950/40 hover:bg-slate-900/10" : "border-slate-350 bg-slate-50 hover:bg-slate-100/50"}`}>
                  <label className="cursor-pointer block space-y-3">
                    <Upload size={32} className="mx-auto text-cyan-400 animate-pulse hover:scale-110 transition-transform" />
                    <div>
                      <span className={`text-xs md:text-sm font-bold block ${theme.isDark ? "text-slate-200" : "text-slate-800"}`}>
                        Import Microsoft Excel Workbook
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono mt-1">Accepts standard .xlsx and .xls file formats</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-1.5 rounded bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-600 hover:text-white text-[11px] font-mono cursor-pointer transition select-none"
                    >
                      Browse Files
                    </button>
                    <input
                      id="excel-file-selector-settings-input"
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleExcelUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label id="sheets-input-label" className="text-[10px] md:text-xs uppercase font-mono tracking-wider font-bold text-slate-400">
                      Published Google Sheet URL
                    </label>
                    <input
                      id="google-sheets-url-settings-input"
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv"
                      value={sheetUrlInput}
                      onChange={(e) => setSheetUrlInput(e.target.value)}
                      className={`w-full text-xs font-mono p-3 rounded-lg border focus:outline-none focus:ring-1 ${
                        theme.isDark 
                          ? "bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-700 focus:border-cyan-500 focus:ring-cyan-500" 
                          : "bg-white border-slate-250 text-slate-800 placeholder-slate-400 focus:border-cyan-600 focus:ring-cyan-600"
                      }`}
                    />
                  </div>

                  <div className="p-3 bg-cyan-500/5 rounded-xl border border-cyan-500/10 flex gap-2">
                    <HelpCircle size={15} className="text-cyan-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-cyan-400/85 leading-relaxed font-mono">
                      <strong>How to link:</strong> Open your Google Sheet, select <em>File &gt; Share &gt; Publish to web</em>, set type to <strong>"Entire Document" &amp; "Comma-separated values (.csv)"</strong>, and copy the generated link. It will synchronise Invoices, Targets, Funnels and Collections in one process!
                    </p>
                  </div>

                  <button
                    id="trigger-google-sheet-settings-sync"
                    type="button"
                    onClick={handleGoogleSheetsSync}
                    disabled={isSyncing}
                    className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white rounded-xl transition-all font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 animate-pulse"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Establishing link and downloading datasets...</span>
                      </>
                    ) : (
                      <>
                        <Database size={13} />
                        <span>Synchronize from Published Sheets</span>
                      </>
                    )}
                  </button>

                  <div className="border-t border-slate-800/40 my-4 pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-mono tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        Real-Time Bi-Directional Cloud Web App Sync
                      </span>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] md:text-xs uppercase font-mono tracking-wider font-bold text-slate-400">
                        Google Apps Script Web App URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={appsScriptUrlInput}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setAppsScriptUrlInput(val);
                          localStorage.setItem("googleAppsScriptUrl", val);
                        }}
                        className={`w-full text-xs font-mono p-3 rounded-lg border focus:outline-none focus:ring-1 ${
                          theme.isDark 
                            ? "bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-700 focus:border-cyan-500 focus:ring-cyan-500" 
                            : "bg-white border-slate-250 text-slate-800 placeholder-slate-400 focus:border-cyan-600 focus:ring-cyan-600"
                        }`}
                      />
                    </div>
                    
                    <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex gap-2">
                      <HelpCircle size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-emerald-400/90 leading-relaxed font-mono">
                        <strong>Live Auto-Sync:</strong> Adding this URL enables <strong>real-time CRUD syncing</strong>. Whenever you edit, add or delete records on the Lead Analysis page, they are immediately written and updated back to your master Google Sheet! See directions below for set up.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowScriptCode(!showScriptCode)}
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 cursor-pointer`}
                    >
                      {showScriptCode ? "Hide deployment instructions" : "Show Google Apps Script setup instructions & code"}
                    </button>

                    {showScriptCode && (
                      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3 font-mono text-[10px] leading-relaxed text-slate-300">
                        <p className="text-slate-400 font-bold uppercase tracking-wider text-cyan-400">Step-by-Step Directions:</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-400">
                          <li>Open your master Google Sheet.</li>
                          <li>Click <strong className="text-slate-200">Extensions &gt; Apps Script</strong>.</li>
                          <li>Delete any template code &amp; paste the script below verbatim.</li>
                          <li>Click <strong className="text-slate-200">Deploy &gt; New Deployment</strong>. Choose <strong className="text-slate-200">Web app</strong>.</li>
                          <li>Set "Execute as" to <strong className="text-slate-200">Me</strong> and "Who has access" to <strong className="text-slate-200">Anyone</strong>.</li>
                          <li>Deploy, complete initial authorization pop-ups, retrieve your <strong className="text-cyan-400">Web App URL</strong> and paste it in the field above!</li>
                        </ol>
                        <div className="relative mt-2">
                          <textarea
                            readOnly
                            rows={12}
                            value={GAS_SCRIPT_TEMPLATE}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-300 p-2 rounded-lg text-[9px] font-mono focus:outline-none focus:ring-0 resize-none select-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Database Purge / Recovery - 5 Cols */}
            <div className={`lg:col-span-5 p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} self-start flex flex-col justify-between space-y-6`}>
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-800/40 pb-4">
                  <Database className="text-rose-500 shrink-0 animate-pulse" size={24} />
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm md:text-base">Database Operations</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-mono">Purge and restore factory demo datasets</p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Purging the local application memory wipes your browser's offline securely partitioned cache (<code>localStorage</code>) absolutely, and resets all quarterly business targets, custom group alliances, invoice records, and software assets back to default demo logs.
                </p>

                <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 flex gap-2">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-400 leading-relaxed font-mono">
                    <strong>Critical Warning:</strong> This database operation is irreversible. Ensure you export your spreadsheet backups before executing a database cache purge!
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-mono text-slate-500 block">Active Local Database Size</span>
                  <span className="text-indigo-400 font-bold font-mono text-xs md:text-sm">{allRecords.length} Invoice Transactions</span>
                </div>
                <span className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Ready State
                </span>
              </div>

              {/* Clear Database button trigger */}
              <div className="pt-2">
                {confirmClear ? (
                  <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-955/20 flex flex-col gap-2.5 animate-pulse border-rose-500">
                    <span className="text-[10px] uppercase font-mono font-bold text-rose-300 text-center">Confirm irreversible deep cache purge?</span>
                    <div className="flex gap-2">
                      <button
                        id="confirm-delete-db-settings-btn"
                        type="button"
                        onClick={() => {
                          if (onResetDb) {
                            onResetDb();
                          }
                          setConfirmClear(false);
                          setSyncSuccessMessage("Success! Database cache successfully cleared and demo templates restored.");
                          setTimeout(() => setSyncSuccessMessage(""), 5000);
                        }}
                        className="flex-1 text-center py-2 rounded-lg bg-rose-600 text-white font-semibold text-xs cursor-pointer select-none border border-rose-700 hover:bg-rose-500 transition shadow-[0_4px_12px_rgba(239,68,68,0.2)]"
                      >
                        Yes, Clear Database
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="p-2 px-3 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg text-xs cursor-pointer select-none"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    id="restore-factory-demodata-settings-btn"
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="w-full py-2.5 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 rounded-xl border border-rose-500/20 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition select-none tracking-wide"
                  >
                    <Trash2 size={13} className="shrink-0" />
                    <span>Purge &amp; Clear Database Cache</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Sync History Logs Section */}
          <div className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
            <div className="flex items-center gap-2.5 border-b border-slate-800/40 pb-4 mb-4 justify-between">
              <div className="flex items-center gap-2.5">
                <History className="text-cyan-400 shrink-0" size={20} />
                <h4 className="font-bold text-slate-100 text-sm md:text-base">Synchronization Audit Trail</h4>
              </div>
              <span className="font-mono text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-bold">
                {syncLogs.length} Sync Events Logged
              </span>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
              {syncLogs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
                  <FileText size={28} className="text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 italic">No synchronization events registered yet.</p>
                  <p className="text-[10px] text-slate-600 mt-1 max-w-sm mx-auto">Upload an Excel datasheet or connect a Google Sheets endpoint above to populate live records.</p>
                </div>
              ) : (
                [...syncLogs].reverse().map((log) => (
                  <div 
                    key={log.id} 
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/20 hover:bg-slate-950/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`w-2 h-2 rounded-full ${
                          log.status === "success" ? "bg-emerald-500" :
                          log.status === "warning" ? "bg-amber-500" : "bg-rose-500"
                        }`} />
                        <span className="font-bold text-slate-200">{log.fileName || "Workbook Dataset"}</span>
                        <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono uppercase tracking-widest font-extrabold shadow-sm">
                          {log.source}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-450 font-medium leading-relaxed">
                        {log.message}
                      </p>
                    </div>
                    
                    <span className="text-[10px] text-slate-500 font-mono font-bold shrink-0 text-left md:text-right">
                      {log.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB SCREEN: Data Integration Hub */}
      {activeTab === "data_schema" && (
        <div className="w-full">
          <DataTemplatePage theme={theme} />
        </div>
      )}
    </div>
  );
}
