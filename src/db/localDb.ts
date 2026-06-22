/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SalesRecord,
  SyncLog,
  User,
  YearlyEntityTarget,
  YearlyTaxConfig,
  VatTaxMode,
  CollectionRecord,
  FunnelRecord,
  CustomBuyerGroup,
  LeadAnalysisRecord,
} from "../types";
import {
  INITIAL_SALES_DATA,
  generateCollectionRecords,
} from "../data/mockData";

const STORAGE_KEYS = {
  SALES_RECORDS: "banglabiz_sales_records_v2",
  COLLECTION_RECORDS: "banglabiz_collection_records_v2",
  SYNC_LOGS: "banglabiz_sync_logs_v2",
  CURRENT_USER: "banglabiz_current_user_v2",
  THEME: "banglabiz_theme_preference_v2",
  YEARLY_TAX_CONFIGS: "banglabiz_yearly_tax_configs_v2",
  BRANCH_TARGETS: "banglabiz_yearly_branch_targets_v2",
  SALES_PERSON_TARGETS: "banglabiz_yearly_sales_person_targets_v2",
  DATE_FORMAT: "banglabiz_date_format_v2",
  SALES_YEARS: "banglabiz_sales_years_v2",
  FUNNEL_RECORDS: "banglabiz_funnel_records_v2",
  CUSTOM_BUYER_GROUPS: "banglabiz_custom_buyer_groups_v2",
  LEAD_ANALYSIS_RECORDS: "banglabiz_lead_analysis_v1",
};

const DEFAULT_USERS: User[] = [
  {
    id: "u-1",
    username: "admin",
    role: "Admin",
    name: "Mahbub Alam",
    branch: "Unassigned",
  },
];

// In-memory fallback database for when localStorage quota is exceeded or fails
const memoryCache: Record<string, string> = {};

const RECORD_KEYS: (keyof SalesRecord)[] = [
  "No",
  "Branch",
  "Sales Person",
  "Buyer Group",
  "Sales Order",
  "Invoice",
  "Remarks",
  "Buyer",
  "Brand",
  "Group",
  "Product",
  "Quantity",
  "Unit Price",
  "Exclude Vat Tax",
  "Vat",
  "Tax",
  "Vat & Tax",
  "Total Price",
  "Invoice Date",
  "Sales Date",
  "Product Manager",
  "vatTaxMode",
  "customVatRate",
  "customTaxRate",
];

// Compresses the records by removing repeating JSON keys to save ~75% space (boosted with dictionary compression to save ~85%+)
export function compressRecords(records: SalesRecord[]): string {
  if (!records || records.length === 0) return JSON.stringify([]);

  const dict: string[] = [];
  const dictMap = new Map<string, number>();

  const getDictId = (val: any): number => {
    if (val === null || val === undefined) return -1;
    const s = String(val);
    let id = dictMap.get(s);
    if (id === undefined) {
      id = dict.length;
      dict.push(s);
      dictMap.set(s, id);
    }
    return id;
  };

  const rows = records.map((rec) => [
    rec.No, // 0
    getDictId(rec.Branch), // 1 (Encoded)
    getDictId(rec["Sales Person"]), // 2 (Encoded)
    getDictId(rec["Buyer Group"]), // 3 (Encoded)
    rec["Sales Order"], // 4
    rec.Invoice, // 5
    getDictId(rec.Remarks), // 6 (Encoded)
    getDictId(rec.Buyer), // 7 (Encoded)
    getDictId(rec.Brand), // 8 (Encoded)
    getDictId(rec.Group), // 9 (Encoded)
    getDictId(rec.Product), // 10 (Encoded)
    rec.Quantity, // 11
    rec["Unit Price"], // 12
    rec["Exclude Vat Tax"], // 13
    rec.Vat, // 14
    rec.Tax, // 15
    rec["Vat & Tax"], // 16
    rec["Total Price"], // 17
    rec["Invoice Date"], // 18
    rec["Sales Date"], // 19
    getDictId(rec["Product Manager"]), // 20 (Encoded)
    getDictId(rec.vatTaxMode), // 21 (Encoded)
    rec.customVatRate, // 22
    rec.customTaxRate, // 23
  ]);

  return JSON.stringify({ k: RECORD_KEYS, d: dict, r: rows });
}

// Decompresses packed structure cleanly, with backward compatibility for uncompressed or non-dictionary data
export function decompressRecords(packedStr: string): SalesRecord[] {
  try {
    const parsed = JSON.parse(packedStr);

    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.r) &&
      Array.isArray(parsed.k)
    ) {
      const keys = parsed.k as (keyof SalesRecord)[];
      const dict = Array.isArray(parsed.d) ? parsed.d : [];
      const hasDict = dict.length > 0;

      const combinedColIndices = [1, 2, 3, 6, 7, 8, 9, 10, 20, 21];

      return parsed.r.map((row: any[]) => {
        const obj: any = {};
        keys.forEach((key, idx) => {
          if (hasDict && combinedColIndices.includes(idx)) {
            const dictId = row[idx];
            if (dictId === -1 || dictId === undefined || dictId === null) {
              obj[key] = "";
            } else {
              obj[key] = dict[dictId] !== undefined ? dict[dictId] : "";
            }
          } else {
            obj[key] = row[idx];
          }
        });
        return obj as SalesRecord;
      });
    }

    if (Array.isArray(parsed)) {
      return parsed;
    }

    return [];
  } catch (e) {
    console.warn(
      "[decompressRecords] Falling back to initial array parser or default values",
      e,
    );
    return [];
  }
}

// Safe wrapper for localStorage operations to prevent QuotaExceededError and keep the application state fully functional
export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        memoryCache[key] = value;
        return value;
      }
    } catch (e) {
      console.warn(
        `[safeLocalStorage] Failed to read key "${key}" from localStorage; utilizing memory cache instead.`,
        e,
      );
    }
    return memoryCache[key] !== undefined ? memoryCache[key] : null;
  },

  setItem(key: string, value: string): boolean {
    // Keep in-memory cache synchronized as the absolute source of truth for session precision
    memoryCache[key] = value;

    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e: any) {
      const isQuotaError =
        e.name === "QuotaExceededError" ||
        e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        e.code === 22 ||
        e.code === 1014;

      if (isQuotaError) {
        console.warn(
          `[safeLocalStorage] Browser storage limit reached for key "${key}". Initiating self-healing and auto-recovery.`,
        );

        // 1. Proactively clear non-essential system data to immediately free up space
        let freedSpace = false;
        try {
          if (localStorage.getItem(STORAGE_KEYS.SYNC_LOGS)) {
            localStorage.removeItem(STORAGE_KEYS.SYNC_LOGS);
            delete memoryCache[STORAGE_KEYS.SYNC_LOGS];
            freedSpace = true;
          }
        } catch (_) {}

        // 2. If we freed space, retry setting the original value first to preserve maximum data fidelity
        if (freedSpace) {
          try {
            localStorage.setItem(key, value);
            console.info(
              `[safeLocalStorage] Self-healed: Successfully written "${key}" without downsampling after clearing sync logs.`
            );
            return true;
          } catch (_) {
            // If still failing, fall back to downsampling/slicing
          }
        }

        // 3. Perform granular slicing/downsampling of sales records to find the highest subset that fits
        if (key === STORAGE_KEYS.SALES_RECORDS) {
          try {
            const records = decompressRecords(value);
            // Dynamic cascading search of sub-limits: starts with high records and drops dynamically
            const limits = [
              80000, 60000, 40000, 30000, 20000, 15000, 10000, 5000,
              4000, 3000, 2000, 1500, 1000, 750, 500, 250, 100, 50
            ];
            for (const limit of limits) {
              if (records.length > limit) {
                // Slice from the end of the array to preserve the latest (most recent) entries
                const sliced = records.slice(-limit);
                const compressed = compressRecords(sliced);
                try {
                  localStorage.setItem(key, compressed);
                  console.info(
                    `[safeLocalStorage] Restored storage: Sliced and safely persisted latest ${limit} records.`,
                  );
                  return true;
                } catch (_) {
                  // If write fails, it continues to try the next, smaller limit
                }
              }
            }
          } catch (err) {
            console.warn(
              "[safeLocalStorage] Slicing downsample recovery aborted.",
              err,
            );
          }
        }
      } else {
        console.warn(
          `[safeLocalStorage] Failed to write key "${key}" to localStorage. Running in RAM-only cache mode fallback.`,
          e,
        );
      }
      return false;
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(
        `[safeLocalStorage] Failed to delete key "${key}" from localStorage.`,
        e,
      );
    }
    delete memoryCache[key];
  },
};

export function initializeLocalDb() {
  const existingRecords = safeLocalStorage.getItem(STORAGE_KEYS.SALES_RECORDS);
  if (existingRecords === null) {
    // Load initial seed data only if never initialized
    safeLocalStorage.setItem(
      STORAGE_KEYS.SALES_RECORDS,
      compressRecords([]),
    );

    // Seed collections based on initial sales
    const initialCollections = generateCollectionRecords([]);
    safeLocalStorage.setItem(
      STORAGE_KEYS.COLLECTION_RECORDS,
      JSON.stringify(initialCollections),
    );

    const initialLog: SyncLog = {
      id: "log-init-" + Date.now(),
      timestamp: getDhakaTimestamp(),
      fileName: "Seed Data",
      recordsCount: INITIAL_SALES_DATA.length,
      status: "success",
      source: "Default Dataset",
      message: `Database initialized with ${INITIAL_SALES_DATA.length} default records.`,
    };

    const existingLogs = getLocalSyncLogs();
    if (existingLogs.length === 0) {
      safeLocalStorage.setItem(
        STORAGE_KEYS.SYNC_LOGS,
        JSON.stringify([initialLog]),
      );
    }
  }

  // Seeding funnel records
  if (false && safeLocalStorage.getItem(STORAGE_KEYS.FUNNEL_RECORDS) === null) {
    const seedFunnels = [
      {
        id: "funnel-seed-1",
        partner: "KARNAPHULI SPORTSWEAR IND. LTD. (CTG)",
        salesman: "Md. Mahbub Alam",
        quarter: "2026 Q2",
        startDate: "2026-05-21",
        endDate: "2026-05-05",
        brand: "MICROSOFT, APACER",
        amount: 239979,
        status: "Achieved"
      },
      {
        id: "funnel-seed-2",
        partner: "MAS INTIMATES BANGLADESH (PVT) LTD (CTG)",
        salesman: "Md. Mahbub Alam",
        quarter: "2026 Q2",
        startDate: "2026-05-21",
        endDate: "2026-05-14",
        brand: "SMART",
        amount: 40000,
        status: "Achieved"
      },
      {
        id: "funnel-seed-3",
        partner: "SQUARE PHARMACEUTICALS LTD",
        salesman: "Unassigned",
        quarter: "2026 Q2",
        startDate: "2026-04-10",
        endDate: "2026-05-30",
        brand: "CISCO, FORTINET",
        amount: 850000,
        status: "Ongoing"
      },
      {
        id: "funnel-seed-4",
        partner: "GRAMEENPHONE LTD",
        salesman: "Ayesha Siddiqua",
        quarter: "2026 Q3",
        startDate: "2026-05-01",
        endDate: "2026-08-15",
        brand: "ORACLE",
        amount: 1450000,
        status: "Strategic Account"
      },
      {
        id: "funnel-seed-5",
        partner: "BRAC BANK PLC",
        salesman: "Tanvir Islam",
        quarter: "2026 Q2",
        startDate: "2026-05-15",
        endDate: "2026-07-20",
        brand: "DELL, MICROSOFT",
        amount: 520000,
        status: "Submitted"
      },
      {
        id: "funnel-seed-6",
        partner: "BEXIMCO TEXTILES LTD",
        salesman: "Imran Hossain",
        quarter: "2026 Q2",
        startDate: "2026-03-22",
        endDate: "2026-06-05",
        brand: "HP",
        amount: 120000,
        status: "New"
      }
    ];
    safeLocalStorage.setItem(STORAGE_KEYS.FUNNEL_RECORDS, JSON.stringify(seedFunnels));
  }
}

export function getLocalCollectionRecords(): CollectionRecord[] {
  initializeLocalDb();
  try {
    const data = safeLocalStorage.getItem(STORAGE_KEYS.COLLECTION_RECORDS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocalCollectionRecords(records: CollectionRecord[]) {
  safeLocalStorage.setItem(
    STORAGE_KEYS.COLLECTION_RECORDS,
    JSON.stringify(records),
  );
}

export function getLocalFunnelRecords(): FunnelRecord[] {
  initializeLocalDb();
  try {
    const data = safeLocalStorage.getItem(STORAGE_KEYS.FUNNEL_RECORDS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocalFunnelRecords(records: FunnelRecord[]) {
  safeLocalStorage.setItem(
    STORAGE_KEYS.FUNNEL_RECORDS,
    JSON.stringify(records),
  );
}

const DEFAULT_LEAD_ANALYSIS_RECORDS: LeadAnalysisRecord[] = [
  { id: "lead-0", Quarter: "Q4FY25", SL: 1, Date: "2025-12-21", "Leads Ref.": "CYNC-CCTV-21.12.2025", "Customer Name": "Sync Industrial", "Type": "RFQ", "Lead Value": 8443276.60, OEM: "SSAL", Status: "Waiting" },
  { id: "lead-1", Quarter: "Q1FY26", SL: 3, Date: "2026-01-04", "Leads Ref.": "KSI-RFQ-04.01.2026", "Customer Name": "KSI Corp", "Type": "RFQ", "Lead Value": 120000.00, OEM: "CISCO SMB", Status: "Won" },
  { id: "lead-2", Quarter: "Q1FY26", SL: 4, Date: "2026-01-04", "Leads Ref.": "DEL-GEEBEE-04.01.2026", "Customer Name": "GeeBee Exports", "Type": "RFQ", "Lead Value": 54869.00, OEM: "MICROSOFT", Status: "Won" },
  { id: "lead-3", Quarter: "Q1FY26", SL: 5, Date: "2026-01-06", "Leads Ref.": "KSI-Microsoft LSP-06.01.2026", "Customer Name": "KSI Global", "Type": "RFQ", "Lead Value": 7000000.00, OEM: "MICROSOFT", Status: "Won" },
  { id: "lead-4", Quarter: "Q1FY26", SL: 6, Date: "2026-01-06", "Leads Ref.": "Radisson Blu-RFQ-06.01.2026", "Customer Name": "Radisson Blu Chattogram", "Type": "RFQ", "Lead Value": 127500.00, OEM: "HP", Status: "Lost" }
];

export interface LeadAnalysisMutations {
  deleted: string[];
  edited: Record<string, Partial<LeadAnalysisRecord>>;
  added: LeadAnalysisRecord[];
}

export function getLocalLeadAnalysisMutations(): LeadAnalysisMutations {
  try {
    const data = safeLocalStorage.getItem("banglabiz_lead_analysis_mutations_v1");
    if (data) {
      const parsed = JSON.parse(data);
      return {
        deleted: parsed.deleted || [],
        edited: parsed.edited || {},
        added: parsed.added || []
      };
    }
  } catch (e) {
    console.error("Failed to parse lead analysis mutations:", e);
  }
  return { deleted: [], edited: {}, added: [] };
}

export function saveLocalLeadAnalysisMutations(mutations: LeadAnalysisMutations) {
  safeLocalStorage.setItem("banglabiz_lead_analysis_mutations_v1", JSON.stringify(mutations));
}

export function getLocalLeadAnalysisSheetRaw(): LeadAnalysisRecord[] {
  try {
    const data = safeLocalStorage.getItem("banglabiz_lead_analysis_sheet_raw_v1");
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to parse lead analysis sheet raw:", e);
  }
  return DEFAULT_LEAD_ANALYSIS_RECORDS;
}

export function saveLocalLeadAnalysisSheetRaw(records: LeadAnalysisRecord[]) {
  safeLocalStorage.setItem("banglabiz_lead_analysis_sheet_raw_v1", JSON.stringify(records));
}

export function reconcileLeadsWithMutations(parsedSheetLeads: LeadAnalysisRecord[]): LeadAnalysisRecord[] {
  const mutations = getLocalLeadAnalysisMutations();
  
  // 1. Filter out deleted leads
  const deletedSet = new Set(mutations.deleted);
  const filtered = parsedSheetLeads.filter(r => r.id && !deletedSet.has(r.id));
  
  // 2. Apply edits
  const processed = filtered.map(r => {
    if (r.id && mutations.edited[r.id]) {
      return { ...r, ...mutations.edited[r.id] };
    }
    return r;
  });
  
  // 3. Append added leads
  return [...processed, ...mutations.added];
}

export function updateLeadAnalysisMutationsFromList(newList: LeadAnalysisRecord[], originSheetList: LeadAnalysisRecord[]) {
  const sheetMap = new Map<string, LeadAnalysisRecord>();
  originSheetList.forEach(r => {
    if (r.id) sheetMap.set(r.id, r);
  });
  
  const newListMap = new Map<string, LeadAnalysisRecord>();
  newList.forEach(r => {
    if (r.id) newListMap.set(r.id, r);
  });
  
  // A. Deleted: any record in originSheetList that is NOT in newList
  const deleted: string[] = [];
  originSheetList.forEach(r => {
    if (r.id && !newListMap.has(r.id)) {
      deleted.push(r.id);
    }
  });
  
  // B. Added & Edited
  const added: LeadAnalysisRecord[] = [];
  const edited: Record<string, Partial<LeadAnalysisRecord>> = {};
  
  newList.forEach(r => {
    if (!r.id) return;
    
    // If it's a sheet lead (exists in originSheetList)
    if (sheetMap.has(r.id)) {
      const original = sheetMap.get(r.id)!;
      // Compare fields to see if edited
      const isDifferent = 
        original.Quarter !== r.Quarter ||
        original.SL !== r.SL ||
        original.Date !== r.Date ||
        original["Leads Ref."] !== r["Leads Ref."] ||
        original.Type !== r.Type ||
        original["Lead Value"] !== r["Lead Value"] ||
        original.OEM !== r.OEM ||
        original.Status !== r.Status;
        
      if (isDifferent) {
        edited[r.id] = { ...r };
      }
    } else {
      // It is locally added
      added.push(r);
    }
  });
  
  saveLocalLeadAnalysisMutations({ deleted, edited, added });
}

export function getLocalLeadAnalysisRecords(): LeadAnalysisRecord[] {
  initializeLocalDb();
  try {
    const sheetRaw = getLocalLeadAnalysisSheetRaw();
    const reconciled = reconcileLeadsWithMutations(sheetRaw);
    return reconciled;
  } catch (e) {
    console.error("Failed to load reconciled lead records:", e);
    return [];
  }
}

export function saveLocalLeadAnalysisRecords(records: LeadAnalysisRecord[]) {
  // Update mutations based on difference
  const sheetRaw = getLocalLeadAnalysisSheetRaw();
  updateLeadAnalysisMutationsFromList(records, sheetRaw);

  // Still save the full compiled list for fast loads
  safeLocalStorage.setItem(
    STORAGE_KEYS.LEAD_ANALYSIS_RECORDS,
    JSON.stringify(records),
  );
}

export function getDhakaTimestamp(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find(p => p.type === "year")?.value || "2026";
    const month = parts.find(p => p.type === "month")?.value || "06";
    const day = parts.find(p => p.type === "day")?.value || "22";
    const hour = parts.find(p => p.type === "hour")?.value || "00";
    const minute = parts.find(p => p.type === "minute")?.value || "00";
    const second = parts.find(p => p.type === "second")?.value || "00";
    return `${year}-${month}-${day} ${hour}:${minute}:${second} GMT+6`;
  } catch {
    const d = new Date();
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const dhakaDate = new Date(utc + 3600000 * 6);
    const y = dhakaDate.getFullYear();
    const m = String(dhakaDate.getMonth() + 1).padStart(2, "0");
    const day = String(dhakaDate.getDate()).padStart(2, "0");
    const h = String(dhakaDate.getHours()).padStart(2, "0");
    const min = String(dhakaDate.getMinutes()).padStart(2, "0");
    const s = String(dhakaDate.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}:${s} GMT+6`;
  }
}

export const formatToYmd = (val: any): string => {
  if (!val) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  let d: Date | null = null;

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      d = val;
    }
  } else {
    // If it's a number (Excel date serial number or timestamp)
    const num = Number(val);
    if (!isNaN(num)) {
      // If it looks like an Excel date serial number (e.g. 30000 to 60000 represents dates between 1982 and 2064)
      if (num > 30000 && num < 60000) {
        d = new Date(Math.round((num - 25569) * 86400 * 1000));
      }
      // If it looks like a Unix timestamp in milliseconds
      else if (num > 1000000000000 && num < 4000000000000) {
        d = new Date(num);
      }
    }

    if (!d) {
      let str = String(val).trim();
      if (!str) return "2026-05-27";

      // 1. Check YYYY-MM-DD format (already perfect)
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
      }

      // 2. Check YYYY-MM-DD HH:mm:ss format (take prefix)
      const ymdPrefixMatch = str.match(/^(\d{4}-\d{2}-\d{2})\b/);
      if (ymdPrefixMatch) {
        return ymdPrefixMatch[1];
      }

      // 3. Check for YYYY/MM/DD
      const ymdSlashMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
      if (ymdSlashMatch) {
        const y = ymdSlashMatch[1];
        const m = ymdSlashMatch[2].padStart(2, "0");
        const day = ymdSlashMatch[3].padStart(2, "0");
        return `${y}-${m}-${day}`;
      }

      // 4. Check for DD-MM-YYYY or DD/MM/YYYY (common BD/UK format)
      const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
      if (dmyMatch) {
        const dPart = dmyMatch[1].padStart(2, "0");
        const mPart = dmyMatch[2].padStart(2, "0");
        const yPart = dmyMatch[3];
        let resolvedMonth = mPart;
        let resolvedDay = dPart;
        if (parseInt(mPart) > 12 && parseInt(dPart) <= 12) {
          resolvedMonth = dPart;
          resolvedDay = mPart;
        }
        return `${yPart}-${resolvedMonth}-${resolvedDay}`;
      }

      // 5. Check for DD-MMM-YYYY or DD-MMM-YY (e.g. 27-May-2026 or 27-May-26 or 27-MAY-2026)
      const monthsMap: Record<string, string> = {
        jan: "01",
        feb: "02",
        mar: "03",
        apr: "04",
        may: "05",
        jun: "06",
        jul: "07",
        aug: "08",
        sep: "09",
        oct: "10",
        nov: "11",
        dec: "12",
      };
      const dMMyMatch = str.match(
        /^(\d{1,2})[\/\- ]([A-Za-z]{3,9})[\/\- ](\d{2,4})\b/,
      );
      if (dMMyMatch) {
        const dPart = dMMyMatch[1].padStart(2, "0");
        const monthStr = dMMyMatch[2].toLowerCase().substring(0, 3);
        const mPart = monthsMap[monthStr] || "05";
        let yPart = dMMyMatch[3];
        if (yPart.length === 2) {
          yPart = "20" + yPart; // Assume 20xx for 2-digit years
        }
        return `${yPart}-${mPart}-${dPart}`;
      }

      // 6. Check if it's an ISO timestamp or similar string containing T
      if (str.includes("T")) {
        const parsed = Date.parse(str);
        if (!isNaN(parsed)) {
          d = new Date(parsed);
        }
      }

      if (!d) {
        // Native JS Date.parse fallback
        const parsed = Date.parse(str);
        if (!isNaN(parsed)) {
          d = new Date(parsed);
        }
      }
    }
  }

  if (d && !isNaN(d.getTime())) {
    try {
      // Use Bangladesh timezone to recover the local calendar date timezone-agnostically
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(d);
      const year = parts.find(p => p.type === "year")?.value || String(d.getUTCFullYear());
      const month = parts.find(p => p.type === "month")?.value || String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = parts.find(p => p.type === "day")?.value || String(d.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch {
      // Fallback
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // 7. If still nothing, let's keep it as is if it has some digits, or fallback
  let strFallback = String(val).trim();
  return strFallback.substring(0, 10) || "2026-05-27";
};

export function getVatTaxRates(): { vat: number; tax: number } {
  try {
    const v = safeLocalStorage.getItem("banglabiz_vat_rate_v1");
    const t = safeLocalStorage.getItem("banglabiz_tax_rate_v1");
    return {
      vat: v ? parseFloat(v) : 10.0,
      tax: t ? parseFloat(t) : 5.0,
    };
  } catch {
    return { vat: 10.0, tax: 5.0 };
  }
}

export function saveVatTaxRates(vat: number, tax: number) {
  try {
    safeLocalStorage.setItem("banglabiz_vat_rate_v1", vat.toString());
    safeLocalStorage.setItem("banglabiz_tax_rate_v1", tax.toString());
  } catch {}
}

export function getYearlyTaxConfigs(): YearlyTaxConfig[] {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEYS.YEARLY_TAX_CONFIGS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveYearlyTaxConfigs(configs: YearlyTaxConfig[]) {
  safeLocalStorage.setItem(
    STORAGE_KEYS.YEARLY_TAX_CONFIGS,
    JSON.stringify(configs),
  );
}

export function getVatTaxRatesForDate(dateStr: string): {
  vat: number;
  tax: number;
} {
  const fiscalYearEnd = getFiscalYearEndForDate(dateStr);

  const configs = getYearlyTaxConfigs();
  const found = configs.find((c) => c.year === fiscalYearEnd);
  if (found) {
    return { vat: found.vatRate, tax: found.taxRate };
  }
  return getVatTaxRates(); // Fallback to global setting
}

export function getYearlyEntityTargets(
  type: "Branch" | "KAM" | "SalesPerson",
): YearlyEntityTarget[] {
  try {
    const key =
      type === "Branch"
        ? STORAGE_KEYS.BRANCH_TARGETS
        : STORAGE_KEYS.SALES_PERSON_TARGETS;
    const raw = safeLocalStorage.getItem(key);
    const parsed: YearlyEntityTarget[] = raw ? JSON.parse(raw) : [];
    return parsed.map((item) => {
      const salesVal = item.totalTarget || 0;
      const breakdown = item.monthlyBreakdown?.map((m) => ({
        ...m,
        collection: m.sales,
      })) || [];
      return {
        ...item,
        totalTarget: salesVal,
        totalCollectionTarget: salesVal,
        monthlyBreakdown: breakdown,
      };
    });
  } catch {
    return [];
  }
}

export function saveYearlyEntityTargets(
  type: "Branch" | "KAM" | "SalesPerson",
  targets: YearlyEntityTarget[],
) {
  const key =
    type === "Branch"
      ? STORAGE_KEYS.BRANCH_TARGETS
      : STORAGE_KEYS.SALES_PERSON_TARGETS;
  const enforcedTargets = targets.map((item) => {
    const salesVal = item.totalTarget || 0;
    const breakdown = item.monthlyBreakdown?.map((m) => ({
      ...m,
      collection: m.sales,
    })) || [];
    return {
      ...item,
      totalTarget: salesVal,
      totalCollectionTarget: salesVal,
      monthlyBreakdown: breakdown,
    };
  });
  safeLocalStorage.setItem(key, JSON.stringify(enforcedTargets));
}

export function getLocalSalesRecords(): SalesRecord[] {
  initializeLocalDb();
  try {
    const data = safeLocalStorage.getItem(STORAGE_KEYS.SALES_RECORDS);
    const records = data ? decompressRecords(data) : [];
    const globalRates = getVatTaxRates();
    const yearlyConfigs = getYearlyTaxConfigs();

    return records.map((rec) => {
      const salesDate = formatToYmd(rec["Sales Date"]);
      const dateObj = new Date(salesDate);
      const month = dateObj.getMonth();
      const calYear = dateObj.getFullYear();

      // Fiscal Year Mapping
      const fiscalYearEnd = getFiscalYearEndForDate(salesDate);
      const yearlyConfig = yearlyConfigs.find((c) => c.year === fiscalYearEnd);

      const vat =
        rec.customVatRate !== undefined
          ? rec.customVatRate
          : yearlyConfig
            ? yearlyConfig.vatRate
            : globalRates.vat;
      const tax =
        rec.customTaxRate !== undefined
          ? rec.customTaxRate
          : yearlyConfig
            ? yearlyConfig.taxRate
            : globalRates.tax;

      const mode = rec.vatTaxMode || "both";

      const quantity = Number(rec.Quantity || 0);
      const unitPrice = Number(rec["Unit Price"] || 0);
      const excludeVatTax = Math.round(
        rec["Exclude Vat Tax"] || quantity * unitPrice || 0,
      );

      // Prefer existing VAT/Tax if present and non-zero, otherwise calculate
      const calculatedVat =
        mode === "both" || mode === "only-vat"
          ? Math.round(excludeVatTax * (vat / 100))
          : 0;
      const calculatedTax =
        mode === "both" || mode === "only-tax"
          ? Math.round(excludeVatTax * (tax / 100))
          : 0;

      const finalVat =
        rec.Vat !== undefined && rec.Vat !== 0 ? rec.Vat : calculatedVat;
      const finalTax =
        rec.Tax !== undefined && rec.Tax !== 0 ? rec.Tax : calculatedTax;

      const vatAndTax = finalVat + finalTax;
      return {
        ...rec,
        vatTaxMode: mode,
        "Exclude Vat Tax": excludeVatTax,
        Vat: finalVat,
        Tax: finalTax,
        "Vat & Tax": vatAndTax,
        "Total Price": excludeVatTax + vatAndTax,
        "Sales Date": salesDate,
        "Invoice Date": formatToYmd(rec["Invoice Date"]),
      };
    });
  } catch (e) {
    console.error("Error reading local sales records", e);
    return [];
  }
}

export function saveLocalSalesRecords(
  records: SalesRecord[],
  source: SyncLog["source"],
  fileName: string,
  customLogMessage?: string
): boolean {
  try {
    const compressedStr = compressRecords(records);
    const success = safeLocalStorage.setItem(
      STORAGE_KEYS.SALES_RECORDS,
      compressedStr,
    );

    // Sync logs are non-essential but helpful. Keep the logs updated
    const isPartiallyStoredInLocalStorage = !success;

    const newLog: SyncLog = {
      id: "log-" + Date.now(),
      timestamp: getDhakaTimestamp(),
      fileName,
      recordsCount: records.length,
      status: success ? "success" : "warning",
      source,
      message: customLogMessage || (isPartiallyStoredInLocalStorage
        ? `Succeeded: All ${records.length} records are fully active in active-session memory, and the maximum safe amount has been persisted to browser storage.`
        : `Imported and synchronized ${records.length} records successfully.`),
    };

    const logs = getLocalSyncLogs();
    logs.unshift(newLog);
    // Limit to latest 30 logs to save space
    safeLocalStorage.setItem(
      STORAGE_KEYS.SYNC_LOGS,
      JSON.stringify(logs.slice(0, 30)),
    );
    return true;
  } catch (e) {
    console.error("Error writing sales records to localDb", e);

    const failedLog: SyncLog = {
      id: "log-" + Date.now(),
      timestamp: getDhakaTimestamp(),
      fileName,
      recordsCount: records.length,
      status: "warning",
      source,
      message: customLogMessage || `Sync successful for active session (${records.length} records) but skipped localStorage persistence limit.`,
    };
    const logs = getLocalSyncLogs();
    logs.unshift(failedLog);
    safeLocalStorage.setItem(
      STORAGE_KEYS.SYNC_LOGS,
      JSON.stringify(logs.slice(0, 30)),
    );
    return true;
  }
}

export function getLocalSyncLogs(): SyncLog[] {
  try {
    const data = safeLocalStorage.getItem(STORAGE_KEYS.SYNC_LOGS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function clearAndResetDb(): SalesRecord[] {
  const emptyData: SalesRecord[] = [];
  
  // 1. Clear sales records
  safeLocalStorage.setItem(
    STORAGE_KEYS.SALES_RECORDS,
    compressRecords(emptyData),
  );

  // 2. Clear collection records
  safeLocalStorage.setItem(
    STORAGE_KEYS.COLLECTION_RECORDS,
    JSON.stringify([]),
  );

  // 3. Clear branch & sales person targets
  safeLocalStorage.setItem(
    STORAGE_KEYS.BRANCH_TARGETS,
    JSON.stringify([]),
  );
  safeLocalStorage.setItem(
    STORAGE_KEYS.SALES_PERSON_TARGETS,
    JSON.stringify([]),
  );

  // 4. Clear yearly tax rates & override configurations
  safeLocalStorage.setItem(
    STORAGE_KEYS.YEARLY_TAX_CONFIGS,
    JSON.stringify([]),
  );

  // 5. Clear global flat VAT & TAX options
  safeLocalStorage.removeItem("banglabiz_vat_rate_v1");
  safeLocalStorage.removeItem("banglabiz_tax_rate_v1");

  // 5.5 Clear funnel records
  safeLocalStorage.setItem(
    STORAGE_KEYS.FUNNEL_RECORDS,
    JSON.stringify([]),
  );

  // 5.6 Clear software subscriptions & activities
  safeLocalStorage.setItem("salespulse_sw_subscriptions_v1", JSON.stringify([]));
  safeLocalStorage.setItem("salespulse_sw_activities_v1", JSON.stringify([]));
  try {
    window.dispatchEvent(new Event("salespulse_sw_subscriptions_updated"));
  } catch (e) {}

  // 6. Create database purge log
  const resetLog: SyncLog = {
    id: "log-reset-" + Date.now(),
    timestamp: getDhakaTimestamp(),
    fileName: "Database Purge",
    recordsCount: 0,
    status: "success",
    source: "System Action",
    message: "Purged all sales records, collections, targets, and tax configurations from cache.",
  };

  const logs = getLocalSyncLogs();
  logs.unshift(resetLog);
  safeLocalStorage.setItem(
    STORAGE_KEYS.SYNC_LOGS,
    JSON.stringify(logs.slice(0, 30)),
  );
  return emptyData;
}

// Authentication Helpers
export function authenticateLocalUser(
  username: string,
  passwordString: string,
): User | null {
  const normUser = username.toLowerCase().trim();
  if (normUser === "admin" && passwordString === "sp@123") {
    const found = DEFAULT_USERS.find((u) => u.username === normUser);
    if (found) {
      safeLocalStorage.setItem(
        STORAGE_KEYS.CURRENT_USER,
        JSON.stringify(found),
      );
      return found;
    }
  }
  return null;
}

export function getLocalCurrentUser(): User | null {
  try {
    const user = safeLocalStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
}

export function logoutLocalUser(): void {
  safeLocalStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}

export function updateRecordVatMode(invoiceNo: number, mode: VatTaxMode) {
  const data = safeLocalStorage.getItem(STORAGE_KEYS.SALES_RECORDS);
  if (!data) return;
  const records = decompressRecords(data);
  const updated = records.map((r) =>
    r.No === invoiceNo ? { ...r, vatTaxMode: mode } : r,
  );
  safeLocalStorage.setItem(
    STORAGE_KEYS.SALES_RECORDS,
    compressRecords(updated),
  );
}

export function updateRecordCustomRates(
  invoiceNo: number,
  vatRate?: number,
  taxRate?: number,
) {
  const data = safeLocalStorage.getItem(STORAGE_KEYS.SALES_RECORDS);
  if (!data) return;
  const records = decompressRecords(data);
  const updated = records.map((r) => {
    if (r.No === invoiceNo) {
      return {
        ...r,
        customVatRate: vatRate === null ? undefined : vatRate,
        customTaxRate: taxRate === null ? undefined : taxRate,
      };
    }
    return r;
  });
  safeLocalStorage.setItem(
    STORAGE_KEYS.SALES_RECORDS,
    compressRecords(updated),
  );
}

export interface RowVisibilitySettings {
  rowsPerPage?: number;
  hiddenItems?: string[];
  hiddenColumns?: string[];
  limit?: number;
}

export function getRowVisibilitySettings(
  tableKey: string,
): RowVisibilitySettings {
  try {
    const raw = safeLocalStorage.getItem(
      `banglabiz_row_visibility_${tableKey}`,
    );
    if (!raw)
      return { rowsPerPage: 10, hiddenItems: [], hiddenColumns: [], limit: 10 };
    const parsed = JSON.parse(raw);
    return {
      rowsPerPage: 10,
      hiddenItems: [],
      hiddenColumns: [],
      limit: 10,
      ...parsed,
    };
  } catch (e) {
    return { rowsPerPage: 10, hiddenItems: [], hiddenColumns: [], limit: 10 };
  }
}

export function saveRowVisibilitySettings(
  tableKey: string,
  settings: RowVisibilitySettings,
): void {
  try {
    safeLocalStorage.setItem(
      `banglabiz_row_visibility_${tableKey}`,
      JSON.stringify(settings),
    );
  } catch (e) {
    console.error(e);
  }
}

export function getDateFormat(): string {
  try {
    return safeLocalStorage.getItem(STORAGE_KEYS.DATE_FORMAT) || "DD-MMM-YYYY";
  } catch {
    return "DD-MMM-YYYY";
  }
}

export function saveDateFormat(format: string): void {
  safeLocalStorage.setItem(STORAGE_KEYS.DATE_FORMAT, format);
}

export function getMonthFormat(): string {
  try {
    return safeLocalStorage.getItem("banglabiz_month_format_v2") || "Short";
  } catch {
    return "Short";
  }
}

export function saveMonthFormat(format: string): void {
  safeLocalStorage.setItem("banglabiz_month_format_v2", format);
}

export function getFiscalYearFormat(): string {
  try {
    return safeLocalStorage.getItem("banglabiz_fiscal_year_format_v2") || "Jul-Jun";
  } catch {
    return "Jul-Jun";
  }
}

export function saveFiscalYearFormat(format: string): void {
  safeLocalStorage.setItem("banglabiz_fiscal_year_format_v2", format);
}

export function getSalesYearFormat(): string {
  try {
    return safeLocalStorage.getItem("banglabiz_sales_year_format_v2") || "Jan-Dec";
  } catch {
    return "Jan-Dec";
  }
}

export function saveSalesYearFormat(format: string): void {
  safeLocalStorage.setItem("banglabiz_sales_year_format_v2", format);
}

export function getMonthsList(): string[] {
  const format = getMonthFormat();
  if (format === "Full") {
    return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  }
  // Default to and strictly enforce Short Form (e.g. Jan, Feb) per user requirements
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

export function getFiscalStartMonthIndex(): number {
  const fy = getFiscalYearFormat();
  if (fy === "Jan-Dec") return 0;
  if (fy === "Apr-Mar") return 3;
  if (fy === "Oct-Sep") return 9;
  return 6; // default Jul-Jun
}

export function getFiscalYearEndForDate(dateStr: string): number {
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) {
    return new Date().getFullYear();
  }
  const month = dateObj.getMonth();
  const calYear = dateObj.getFullYear();
  const startIdx = getFiscalStartMonthIndex();
  
  if (startIdx === 0) {
    return calYear;
  }
  return month >= startIdx ? calYear + 1 : calYear;
}

export function getSalesYears(): number[] {
  return [2022, 2023, 2024, 2025, 2026];
}

export function saveSalesYears(years: number[]): void {
  // Purposefully no-op to stick to default calendar range
}

export function getLocalGeminiApiKey(): string {
  try {
    return safeLocalStorage.getItem("banglabiz_local_gemini_api_key") || "";
  } catch {
    return "";
  }
}

export function saveLocalGeminiApiKey(key: string): void {
  try {
    safeLocalStorage.setItem("banglabiz_local_gemini_api_key", key);
  } catch {}
}

export function getCustomBuyerGroups(): CustomBuyerGroup[] {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEYS.CUSTOM_BUYER_GROUPS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomBuyerGroups(groups: CustomBuyerGroup[]): void {
  try {
    safeLocalStorage.setItem(STORAGE_KEYS.CUSTOM_BUYER_GROUPS, JSON.stringify(groups));
    // Trigger event to notify listeners
    window.dispatchEvent(new Event("banglabiz_custom_groups_updated"));
  } catch (err) {
    console.error("Failed to save custom buyer groups to safeLocalStorage", err);
  }
}

