/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Presentation,
  LogOut,
  HelpCircle,
  TrendingUp,
  Award,
} from "lucide-react";
import { User, SalesRecord, SyncLog, ThemeType, DashboardTheme, FunnelRecord, CollectionRecord, LeadAnalysisRecord } from "./types";
import {
  getLocalSalesRecords,
  getLocalSyncLogs,
  saveLocalSalesRecords,
  getLocalCurrentUser,
  logoutLocalUser,
  clearAndResetDb,
  initializeLocalDb,
  safeLocalStorage,
  saveLocalCollectionRecords,
  saveYearlyEntityTargets,
  getLocalFunnelRecords,
  saveLocalFunnelRecords,
  getLocalLeadAnalysisRecords,
  saveLocalLeadAnalysisRecords,
  saveLocalLeadAnalysisSheetRaw,
  reconcileLeadsWithMutations,
  formatToYmd,
  getLocalCollectionRecords,
  getCustomBuyerGroups,
  getYearlyEntityTargets,
} from "./db/localDb";
import { CUSTOM_THEMES } from "./utils/theme";
import { syncGoogleSheets } from "./utils/syncUtils";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import Header from "./components/Header";
import Filters from "./components/Filters";
import KpiSection from "./components/KpiSection";
import AiInsights from "./components/AiInsights";
import { AiAdvisor } from "./components/AiAdvisor";
import Charts from "./components/Charts";
import Login from "./pages/Login";
import { exportDashboardToPdf, exportDashboardToSlides } from "./utils/export";

// Import separate pages
import {
  DashboardOverviewPage,
  SalesAnalyticsPage,
  ProductAnalyticsPage,
  CustomerInsightsPage,
  FinancialAnalyticsPage,
  TargetAnalyticsPage,
  DataTemplatePage,
} from "./pages/DashboardPages";
import SettingsPage from "./pages/SettingsPage";
import KamAnalyticsPage from "./pages/KamAnalyticsPage";
import FunnelPage from "./pages/FunnelPage";
import LeadAnalysisPage from "./pages/LeadAnalysisPage";
import SoftwareBusinessPage from "./pages/SoftwareBusinessPage";
import ForecastingPage from "./pages/ForecastingPage";

export interface DashboardFilters {
  dateRange: [string, string];
  years: number[];
  months?: number[];
  branch: string[];
  salesPerson: string[];
  buyerGroup: string[];
  buyer: string[];
  brand: string[];
  productGroup: string[];
  productManager: string[];
  searchQuery: string;
  paymentMethod?: string[];
  collectionStatus?: string[];
  funnelStatus?: string[];
  funnelQuarter?: string[];
  customBuyerGroups?: string[];
}

const getDefaultFilters = (records: SalesRecord[]): DashboardFilters => {
  const currentYear = new Date().getFullYear();

  return {
    dateRange: [`${currentYear}-01-01`, `${currentYear}-12-31`],
    years: [currentYear],
    months: [],
    branch: [],
    salesPerson: [],
    buyerGroup: [],
    buyer: [],
    brand: [],
    productGroup: [],
    productManager: [],
    searchQuery: "",
    paymentMethod: [],
    collectionStatus: [],
    funnelStatus: [],
    funnelQuarter: [],
  };
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allRecords, setAllRecords] = useState<SalesRecord[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<CollectionRecord[]>([]);
  const [funnelRecords, setFunnelRecords] = useState<FunnelRecord[]>([]);
  const [leadRecords, setLeadRecords] = useState<LeadAnalysisRecord[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Theme state
  const [themeVariant, setThemeVariant] =
    useState<ThemeType>("sophisticated-dark");
  const theme = CUSTOM_THEMES[themeVariant];

  // Synchronize document class for Tailwind dark selector and Webkit date pickers
  useEffect(() => {
    if (theme.isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme.isDark]);

  // Global filters
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    try {
      const records = getLocalSalesRecords();
      return getDefaultFilters(records);
    } catch {
      const runningYear = new Date().getFullYear();
      return {
        dateRange: [`${runningYear}-01-01`, `${runningYear}-12-31`],
        years: [runningYear],
        branch: [],
        salesPerson: [],
        buyerGroup: [],
        buyer: [],
        brand: [],
        productGroup: [],
        productManager: [],
        searchQuery: "",
        paymentMethod: [],
        collectionStatus: [],
        funnelStatus: [],
        funnelQuarter: [],
      };
    }
  });

  // On mount: initialize DB caches and check sessions
  useEffect(() => {
    initializeLocalDb();
    const records = getLocalSalesRecords();
    setAllRecords(records);
    setCollectionRecords(getLocalCollectionRecords());
    setFilters(getDefaultFilters(records));
    setSyncLogs(getLocalSyncLogs());
    setFunnelRecords(getLocalFunnelRecords());
    setLeadRecords(getLocalLeadAnalysisRecords());

    const userSession = getLocalCurrentUser();
    if (userSession) {
      setCurrentUser(userSession);
    }

    // Check saved theme preference
    const savedTheme = safeLocalStorage.getItem(
      "banglabiz_theme_preference_v1",
    ) as ThemeType;
    if (savedTheme && CUSTOM_THEMES[savedTheme]) {
      setThemeVariant(savedTheme);
    }

    const handleVatTaxUpdate = () => {
      const refreshedRecords = getLocalSalesRecords();
      setAllRecords(refreshedRecords);
    };
    window.addEventListener("banglabiz_vat_tax_updated", handleVatTaxUpdate);

    return () => {
      window.removeEventListener(
        "banglabiz_vat_tax_updated",
        handleVatTaxUpdate,
      );
    };
  }, []);

  // Sync state helpers
  const handleImportRecords = (
    newRecords: SalesRecord[],
    source: SyncLog["source"],
    name: string,
    customLogMessage?: string
  ) => {
    // Enforce existing KAM names for Sales Records
    const existingKams = getYearlyEntityTargets("KAM").map(t => t.entityName);
    const defaultKam = existingKams.length > 0 ? existingKams[0] : "Unassigned";

    const normalizedRecords = newRecords.map(r => {
      let salesman = String(r["Sales Person"] || "").trim();
      
      // Specific hardcoded mapping requested by user
      const upperSalesman = salesman.toUpperCase();
      if (upperSalesman === "M. A. RAHMAN" || upperSalesman === "M A RAHMAN") {
        salesman = "Md. Mahbub Alam";
      }

      if (existingKams.length > 0) {
        const match = existingKams.find(k => k.toLowerCase() === salesman.toLowerCase());
        if (match) {
          r["Sales Person"] = match;
        } else {
          // If no match found, assign to the default (first) KAM to avoid creating new names
          r["Sales Person"] = defaultKam;
        }
      } else {
        r["Sales Person"] = salesman;
      }
      return r;
    });

    const success = saveLocalSalesRecords(normalizedRecords, source, name, customLogMessage);
    if (success) {
      const refreshedRecords = getLocalSalesRecords();
      setAllRecords(refreshedRecords);
      setFilters(getDefaultFilters(refreshedRecords));
      setSyncLogs(getLocalSyncLogs());
    }
  };

  const handleResetDb = () => {
    clearAndResetDb();
    const refreshedRecords = getLocalSalesRecords();
    setAllRecords(refreshedRecords);
    setCollectionRecords([]);
    setFilters(getDefaultFilters(refreshedRecords));
    setSyncLogs(getLocalSyncLogs());
    setFunnelRecords(getLocalFunnelRecords());
    setLeadRecords(getLocalLeadAnalysisRecords());
  };

  const handleImportCollections = (records: any[]) => {
    const cleaned = records.filter(r => {
      const values = Object.values(r).map(v => String(v || "").trim());
      return values.some(v => v !== "");
    });
    saveLocalCollectionRecords(cleaned);
    setCollectionRecords(getLocalCollectionRecords());
  };

  const handleImportFunnels = (records: any[]) => {
    const cleaned = records.filter(r => {
      const values = Object.values(r).map(v => String(v || "").trim());
      return values.some(v => v !== "");
    });

    // Get existing KAMs to validate salesman names
    const existingKams = getYearlyEntityTargets("KAM").map(t => t.entityName);
    const defaultKam = existingKams.length > 0 ? existingKams[0] : "Unassigned";

    const parsed = cleaned.map((r, idx) => {
      const keys = Object.keys(r);
      const findVal = (possibleNames: string[], defaultVal: any = "") => {
        const foundKey = keys.find(k => 
          possibleNames.some(p => k.trim().toLowerCase() === p.toLowerCase())
        );
        return foundKey !== undefined ? r[foundKey] : defaultVal;
      };

      const partner = findVal(["Partners", "Partner", "Client", "Customer", "Buyer"], "Unknown");
      let salesman = String(findVal(["Salesman", "Sales Person", "SalesPerson", "KAM", "Representative"], "Unknown")).trim();
      
      // Specific hardcoded mapping requested by user
      const upperSalesman = salesman.toUpperCase();
      if (upperSalesman === "M. A. RAHMAN" || upperSalesman === "M A RAHMAN") {
        salesman = "Md. Mahbub Alam";
      }

      // Enforce existing KAM names: if not found, assign to defaultKam
      if (existingKams.length > 0) {
        const match = existingKams.find(k => k.toLowerCase() === salesman.toLowerCase());
        if (match) {
          salesman = match;
        } else {
          salesman = defaultKam;
        }
      }

      const quarter = findVal(["Quarter", "Qtr"], "2026 Q2");
      const startDate = formatToYmd(findVal(["Start Date", "StartDate", "Date"], "2026-05-21"));
      const endDate = formatToYmd(findVal(["End Date", "EndDate"], "2026-06-05"));
      const brand = findVal(["Brand", "Manufacturer"], "General");
      
      const rawAmt = findVal(["Amount", "Value", "Expected Volume"], 0);
      let amount = 0;
      if (typeof rawAmt === "number") {
        amount = rawAmt;
      } else if (rawAmt) {
        amount = Number(String(rawAmt).replace(/,/g, "").trim()) || 0;
      }

      const status = findVal(["Status", "Stage"], "New");
      const slVal = findVal(["SL", "Serial Number", "Serial", "No", "S.No", "SNo"], null);
      const sl = slVal !== null && !isNaN(Number(slVal)) ? Number(slVal) : (idx + 1);

      return {
        id: `funnel-rec-${idx}-${Date.now()}`,
        partner,
        salesman,
        quarter,
        startDate,
        endDate,
        brand,
        amount,
        status,
        SL: sl
      } as FunnelRecord;
    });

    saveLocalFunnelRecords(parsed);
    setFunnelRecords(parsed);
  };

  const handleImportLeads = (records: any[]) => {
    const cleaned = records.filter(r => {
      const values = Object.values(r).map(v => String(v || "").trim());
      return values.some(v => v !== "");
    });
    const parsed: LeadAnalysisRecord[] = cleaned.map((r, idx) => {
      const qs = Object.keys(r);
      const findVal = (possibleNames: string[], defaultVal: any = "") => {
        const foundKey = qs.find(k => 
          possibleNames.some(p => k.trim().toLowerCase() === p.toLowerCase())
        );
        return foundKey !== undefined ? r[foundKey] : defaultVal;
      };

      const quarter = String(findVal(["Quarter", "Qtr"], "Unassigned"));
      const slVal = findVal(["SL", "Serial Number", "Serial", "No", "S.No", "SNo"], null);
      const sl = slVal !== undefined && slVal !== null && slVal !== "" ? slVal : (idx + 1);
      const date = formatToYmd(findVal(["Date", "Creation Date"], new Date().toLocaleDateString('en-CA')));
      const leadsRef = String(findVal(["Leads Ref.", "Leads Ref", "Ref", "Reference"], ""));
      const customerName = String(findVal(["Customer Name", "Customer", "Account", "Client"], ""));
      const type = String(findVal(["RFQ/OTM/LTM", "Type", "Category"], "RFQ"));
      const rawVal = String(findVal(["Lead Value", "Value", "Amount"], "0")).replace(/,/g, "").trim();
      const val = Number(rawVal) || 0;
      const oem = String(findVal(["oem", "brand", "vendor"], "Unknown"));
      const status = String(findVal(["status", "state", "stage"], "Pending"));

      return {
        id: `lead-${idx}`,
        Quarter: quarter,
        SL: sl,
        Date: date,
        "Leads Ref.": leadsRef,
        "Customer Name": customerName,
        "Type": type,
        "Lead Value": val,
        OEM: oem,
        Status: status
      } as LeadAnalysisRecord;
    }).filter(r => r["Leads Ref."].trim() !== "");

    // 1. Save Excel/Spreadsheet raw leads
    saveLocalLeadAnalysisSheetRaw(parsed);

    // 2. Reconcile raw sheet leads with user manual edits/mutations
    const reconciled = reconcileLeadsWithMutations(parsed);

    // 3. Save finalized array for fast UI load and update local state
    safeLocalStorage.setItem("banglabiz_lead_analysis_v1", JSON.stringify(reconciled));
    setLeadRecords(reconciled);
  };

  const handleImportTargets = (records: any[]) => {
    const branchMap = new Map<string, any>();
    const kamMap = new Map<string, any>();

    // Group records into YearlyEntityTarget structures
    records.forEach((r) => {
      const year = Number(r.Year || 2026);
      const salesTarget = Number(r["Annual Sales Target"] || r["Sales Target"] || 0);
      const collectionTarget = Number(r["Annual Collection Target"] || r["Collection Target"] || 0);

      if (r.Branch) {
        const key = `${r.Branch}-${year}`;
        if (!branchMap.has(key)) {
          branchMap.set(key, {
            year,
            entityName: r.Branch,
            totalTarget: 0,
            totalCollectionTarget: 0,
          });
        }
        const target = branchMap.get(key)!;
        target.totalTarget += salesTarget;
        target.totalCollectionTarget += collectionTarget;
      }

      const kamName = r.KAM || r["Sales Person"];
      if (kamName) {
        const key = `${kamName}-${year}`;
        if (!kamMap.has(key)) {
          kamMap.set(key, {
            year,
            entityName: kamName,
            totalTarget: 0,
            totalCollectionTarget: 0,
          });
        }
        const target = kamMap.get(key)!;
        target.totalTarget += salesTarget;
        target.totalCollectionTarget += collectionTarget;
      }
    });

    const branchTargets = Array.from(branchMap.values());
    const kamTargets = Array.from(kamMap.values());

    if (branchTargets.length > 0)
      saveYearlyEntityTargets("Branch", branchTargets);
    if (kamTargets.length > 0) saveYearlyEntityTargets("KAM", kamTargets);
  };

  const handleLoginSuccess = (userObj: User) => {
    setCurrentUser(userObj);
  };

  const handleLogout = () => {
    logoutLocalUser();
    setCurrentUser(null);
  };

  // Safe theme switcher helper
  const handleThemeVariantChange = (variant: ThemeType) => {
    setThemeVariant(variant);
    safeLocalStorage.setItem("banglabiz_theme_preference_v1", variant);
  };

  const handleImportSoftwareSubscriptions = (records: any[]) => {
    safeLocalStorage.setItem("salespulse_sw_subscriptions_v1", JSON.stringify(records));
    window.dispatchEvent(new Event("salespulse_sw_subscriptions_updated"));
  };

  const handleRefresh = async () => {
    const googleSheetUrl = localStorage.getItem("googleSheetUrl");
    if (googleSheetUrl) {
      setIsRefreshing(true);
      try {
        await syncGoogleSheets(
          googleSheetUrl,
          handleImportRecords,
          handleImportCollections,
          handleImportTargets,
          handleImportFunnels,
          handleImportSoftwareSubscriptions,
          handleImportLeads
        );
      } catch (e) {
        console.error("Refresh failed:", e);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    // 1. Migrate Sales Records
    const salesRaw = safeLocalStorage.getItem("salespulse_sales_records_v1");
    if (salesRaw) {
      try {
        const sales = JSON.parse(salesRaw);
        let changed = false;
        const migrated = sales.map((r: any) => {
          const owner = String(r["Sales Person"] || "").toUpperCase();
          if (owner === "M. A. RAHMAN" || owner === "M A RAHMAN") {
            r["Sales Person"] = "Md. Mahbub Alam";
            changed = true;
          }
          return r;
        });
        if (changed) {
          safeLocalStorage.setItem("salespulse_sales_records_v1", JSON.stringify(migrated));
          setAllRecords(migrated);
        }
      } catch (e) {
        console.error("Sales migration failed", e);
      }
    }

    // 2. Migrate Funnel Records
    const funnelRaw = safeLocalStorage.getItem("salespulse_funnel_records_v1");
    if (funnelRaw) {
      try {
        const funnels = JSON.parse(funnelRaw);
        let changed = false;
        const migrated = funnels.map((r: any) => {
          const owner = String(r.salesman || "").toUpperCase();
          if (owner === "M. A. RAHMAN" || owner === "M A RAHMAN") {
            r.salesman = "Md. Mahbub Alam";
            changed = true;
          }
          return r;
        });
        if (changed) {
          safeLocalStorage.setItem("salespulse_funnel_records_v1", JSON.stringify(migrated));
        }
      } catch (e) {
        console.error("Funnel migration failed", e);
      }
    }

    // 3. Migrate Software Subscriptions
    const swRaw = safeLocalStorage.getItem("salespulse_sw_subscriptions_v1");
    if (swRaw) {
      try {
        const subs = JSON.parse(swRaw);
        let changed = false;
        const migrated = subs.map((r: any) => {
          const owner = String(r.sales_owner || "").toUpperCase();
          if (owner === "M. A. RAHMAN" || owner === "M A RAHMAN") {
            r.sales_owner = "Md. Mahbub Alam";
            changed = true;
          }
          return r;
        });
        if (changed) {
          safeLocalStorage.setItem("salespulse_sw_subscriptions_v1", JSON.stringify(migrated));
          window.dispatchEvent(new Event("salespulse_sw_subscriptions_updated"));
        }
      } catch (e) {
        console.error("Software migration failed", e);
      }
    }
  }, []);

  useEffect(() => {
    // Auto-sync
    const googleSheetUrl = localStorage.getItem("googleSheetUrl");
    if (googleSheetUrl) {
      syncGoogleSheets(
        googleSheetUrl,
        handleImportRecords,
        handleImportCollections,
        handleImportTargets,
        handleImportFunnels,
        handleImportSoftwareSubscriptions,
        handleImportLeads
      ).catch(e => console.error("Auto-sync failed:", e));
    }
  }, []);

  // 1. Memoized high-speed lookup maps to avoid O(N * M) nested find searches in collection records
  const salesByInvoiceMap = useMemo(() => {
    const map = new Map<string, SalesRecord>();
    for (const r of allRecords) {
      if (r.Invoice) {
        map.set(r.Invoice, r);
      }
    }
    return map;
  }, [allRecords]);

  const salesByBuyerMap = useMemo(() => {
    const map = new Map<string, SalesRecord>();
    for (const r of allRecords) {
      if (r.Buyer) {
        if (!map.has(r.Buyer)) {
          map.set(r.Buyer, r);
        }
      }
    }
    return map;
  }, [allRecords]);

  const salesBySalesmanMap = useMemo(() => {
    const map = new Map<string, SalesRecord>();
    for (const r of allRecords) {
      if (r["Sales Person"]) {
        if (!map.has(r["Sales Person"])) {
          map.set(r["Sales Person"], r);
        }
      }
    }
    return map;
  }, [allRecords]);

  // 2. High performance memoized filters (Updated only when source data or filters actually change)
  const filteredRecords = useMemo(() => {
    return allRecords.filter((r) => {
      // 1. Global Slicer query matching
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesQuery =
          String(r.Buyer || '').toLowerCase().includes(query) ||
          String(r["Sales Order"] || '').toLowerCase().includes(query) ||
          String(r.Invoice || '').toLowerCase().includes(query) ||
          String(r.Brand || '').toLowerCase().includes(query) ||
          String(r.Product || '').toLowerCase().includes(query) ||
          String(r["Sales Person"] || '').toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // 2. Direct branch selectors
      if (filters.branch && filters.branch.length > 0 && !filters.branch.includes(r.Branch)) return false;

      // 3. Salesperson matching
      if (
        filters.salesPerson &&
        filters.salesPerson.length > 0 &&
        !filters.salesPerson.includes(r["Sales Person"])
      )
        return false;

      // 4. Buyer industry dimension
      if (filters.buyerGroup && filters.buyerGroup.length > 0 && !filters.buyerGroup.includes(r["Buyer Group"]))
        return false;

      // Custom Buyer Groups Filter
      if (filters.customBuyerGroups && filters.customBuyerGroups.length > 0) {
        const groups = getCustomBuyerGroups();
        const allowedBuyers = groups
          .filter(g => filters.customBuyerGroups!.includes(g.name))
          .flatMap(g => g.buyers);
        if (!allowedBuyers.includes(r.Buyer)) {
          return false;
        }
      }

      // 5. Exact customer account
      if (filters.buyer && filters.buyer.length > 0 && !filters.buyer.includes(r.Buyer)) return false;

      // 6. Brand vendor
      if (filters.brand && filters.brand.length > 0 && !filters.brand.includes(r.Brand)) return false;

      // 7. Product categorizer
      if (filters.productGroup && filters.productGroup.length > 0 && !filters.productGroup.includes(r.Group))
        return false;

      // 8. Line manager tag
      if (
        filters.productManager &&
        filters.productManager.length > 0 &&
        !filters.productManager.includes(r["Product Manager"])
      )
        return false;

      // 9. Chronological Date boundaries / Years
      const rowDate = (r["Invoice Date"] || r["Sales Date"]) ? (r["Invoice Date"] || r["Sales Date"]).substring(0, 10) : "";
      
      if (filters.years && filters.years.length > 0) {
        if (rowDate) {
          const rowYear = new Date(rowDate).getFullYear();
          if (!filters.years.includes(rowYear)) return false;
        } else {
          return false;
        }
      }

      if (filters.months && filters.months.length > 0) {
        if (rowDate) {
          const rowMonth = new Date(rowDate).getMonth() + 1;
          if (!filters.months.includes(rowMonth)) return false;
        } else {
          return false;
        }
      }

      if (filters.dateRange[0]) {
        if (rowDate && rowDate < filters.dateRange[0]) return false;
      }
      if (filters.dateRange[1]) {
        if (rowDate && rowDate > filters.dateRange[1]) return false;
      }

      return true;
    });
  }, [allRecords, filters]);

  const filteredCollectionRecords = useMemo(() => {
    return collectionRecords.filter(coll => {
      // Find associated sale
      const sale = coll.invoiceNo 
        ? salesByInvoiceMap.get(coll.invoiceNo) 
        : (coll.buyerName ? salesByBuyerMap.get(coll.buyerName) : undefined);

      // Apply search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesQuery =
          String(coll.buyerName || '').toLowerCase().includes(query) ||
          String(coll.invoiceNo || '').toLowerCase().includes(query) ||
          String(coll.transactionNo || '').toLowerCase().includes(query) ||
          String(coll.remarks || '').toLowerCase().includes(query) ||
          (sale && (
            String(sale.Branch || '').toLowerCase().includes(query) ||
            String(sale["Sales Person"] || '').toLowerCase().includes(query) ||
            String(sale.Brand || '').toLowerCase().includes(query) ||
            String(sale.Product || '').toLowerCase().includes(query)
          ));
        if (!matchesQuery) return false;
      }

      // Check date range / Years
      const rowDate = coll.paymentDate;
      if (filters.years && filters.years.length > 0) {
        if (rowDate) {
          const rowYear = new Date(rowDate).getFullYear();
          if (!filters.years.includes(rowYear)) return false;
        } else {
          return false;
        }
      }

      if (filters.months && filters.months.length > 0) {
        if (rowDate) {
          const rowMonth = new Date(rowDate).getMonth() + 1;
          if (!filters.months.includes(rowMonth)) return false;
        } else {
          return false;
        }
      }

      if (filters.dateRange[0]) {
        if (rowDate && rowDate < filters.dateRange[0]) return false;
      }
      if (filters.dateRange[1]) {
        if (rowDate && rowDate > filters.dateRange[1]) return false;
      }

      // Re-use standard filters for associated sales record
      if (filters.branch && filters.branch.length > 0) {
        const branch = sale ? sale.Branch : "Unknown";
        if (!filters.branch.includes(branch)) return false;
      }
      if (filters.salesPerson && filters.salesPerson.length > 0) {
        const sp = sale ? sale["Sales Person"] : "Unknown";
        if (!filters.salesPerson.includes(sp)) return false;
      }
      if (filters.buyerGroup && filters.buyerGroup.length > 0) {
        const bg = sale ? sale["Buyer Group"] : "Unknown";
        if (!filters.buyerGroup.includes(bg)) return false;
      }
      // Custom Buyer Groups Filter for Collections
      if (filters.customBuyerGroups && filters.customBuyerGroups.length > 0) {
        const groups = getCustomBuyerGroups();
        const allowedBuyers = groups
          .filter(g => filters.customBuyerGroups!.includes(g.name))
          .flatMap(g => g.buyers);
        if (!allowedBuyers.includes(coll.buyerName)) {
          return false;
        }
      }

      if (filters.buyer && filters.buyer.length > 0) {
        if (!filters.buyer.includes(coll.buyerName)) return false;
      }
      if (filters.brand && filters.brand.length > 0) {
        const b = sale ? sale.Brand : "Unknown";
        if (!filters.brand.includes(b)) return false;
      }
      if (filters.productGroup && filters.productGroup.length > 0) {
        const g = sale ? sale.Group : "Unknown";
        if (!filters.productGroup.includes(g)) return false;
      }
      if (filters.productManager && filters.productManager.length > 0) {
        const pm = sale ? sale["Product Manager"] : "Unknown";
        if (!filters.productManager.includes(pm)) return false;
      }

      // Slicer-specific filters:
      if (filters.paymentMethod && filters.paymentMethod.length > 0) {
        if (!filters.paymentMethod.includes(coll.paymentMethod)) return false;
      }
      if (filters.collectionStatus && filters.collectionStatus.length > 0) {
        const status = coll.status || "Success";
        if (!filters.collectionStatus.includes(status)) return false;
      }

      return true;
    });
  }, [collectionRecords, filters, salesByInvoiceMap, salesByBuyerMap]);

  const filteredFunnelRecords = useMemo(() => {
    return funnelRecords.filter(f => {
      // Apply search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesQuery =
          String(f.partner || '').toLowerCase().includes(query) ||
          String(f.salesman || '').toLowerCase().includes(query) ||
          String(f.brand || '').toLowerCase().includes(query) ||
          String(f.quarter || '').toLowerCase().includes(query) ||
          String(f.status || '').toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // Check date range / Years
      if (filters.years && filters.years.length > 0) {
        const startYear = new Date(f.startDate).getFullYear();
        const endYear = new Date(f.endDate).getFullYear();
        if (!filters.years.includes(startYear) && !filters.years.includes(endYear)) return false;
      }

      if (filters.months && filters.months.length > 0) {
        const startMonth = new Date(f.startDate).getMonth() + 1;
        const endMonth = new Date(f.endDate).getMonth() + 1;
        
        // Simple check: does startMonth or endMonth fall in selected months?
        // For longer durations this might miss mid-months, but for most funnel records this is sufficient.
        const startMatch = filters.months.includes(startMonth);
        const endMatch = filters.months.includes(endMonth);
        if (!startMatch && !endMatch) return false;
      }

      if (filters.dateRange[0]) {
        if (f.startDate < filters.dateRange[0] && f.endDate < filters.dateRange[0]) return false;
      }
      if (filters.dateRange[1]) {
        if (f.startDate > filters.dateRange[1] && f.endDate > filters.dateRange[1]) return false;
      }

      // Filter options
      if (filters.branch && filters.branch.length > 0) {
        const sale = f.salesman ? salesBySalesmanMap.get(f.salesman) : undefined;
        const branch = sale ? sale.Branch : "Unknown";
        if (!filters.branch.includes(branch)) return false;
      }
      if (filters.salesPerson && filters.salesPerson.length > 0) {
        if (!filters.salesPerson.includes(f.salesman)) return false;
      }
      // Custom Buyer Groups Filter for Funnel
      if (filters.customBuyerGroups && filters.customBuyerGroups.length > 0) {
        const groups = getCustomBuyerGroups();
        const allowedBuyers = groups
          .filter(g => filters.customBuyerGroups!.includes(g.name))
          .flatMap(g => g.buyers);
        if (!allowedBuyers.includes(f.partner)) {
          return false;
        }
      }

      if (filters.buyer && filters.buyer.length > 0) {
        if (!filters.buyer.includes(f.partner)) return false;
      }
      if (filters.brand && filters.brand.length > 0) {
        if (!filters.brand.includes(f.brand)) return false;
      }
      if (filters.funnelStatus && filters.funnelStatus.length > 0) {
        if (!filters.funnelStatus.includes(f.status)) return false;
      }
      if (filters.funnelQuarter && filters.funnelQuarter.length > 0) {
        if (!filters.funnelQuarter.includes(f.quarter)) return false;
      }

      return true;
    });
  }, [funnelRecords, filters, salesBySalesmanMap]);

  const summaryData = useMemo(() => {
    const totalRevenue = filteredRecords.reduce((s, r) => s + (r["Total Price"] || 0), 0);
    const totalNetSales = filteredRecords.reduce((s, r) => s + (r["Exclude Vat Tax"] || 0), 0);
    const totalQty = filteredRecords.reduce((s, r) => s + (r.Quantity || 0), 0);
    const totalVatTax = filteredRecords.reduce((s, r) => s + (r["Vat & Tax"] || 0), 0);
    
    return {
      revenue: totalRevenue,
      netSales: totalNetSales,
      orders: filteredRecords.length,
      quantity: totalQty,
      vatTax: totalVatTax,
      activeBuyers: new Set(filteredRecords.map(s => s.Buyer)).size
    };
  }, [filteredRecords]);

  const handleDrillDown = (type: keyof DashboardFilters, value: string) => {
    setFilters(prev => {
      const currentValues = prev[type] as string[] || [];
      if (currentValues.includes(value)) return prev;
      return {
        ...prev,
        [type]: [...currentValues, value]
      };
    });
  };

  const getExportData = () => {
    const totals = {
      revenue: filteredRecords.reduce((sum, r) => sum + r["Total Price"], 0),
      netSales: filteredRecords.reduce((sum, r) => sum + r["Exclude Vat Tax"], 0),
      orders: filteredRecords.length,
      quantity: filteredRecords.reduce((sum, r) => sum + r.Quantity, 0),
      vatTax: filteredRecords.reduce((sum, r) => sum + r["Vat & Tax"], 0),
      activeBuyers: new Set(filteredRecords.map((r) => r.Buyer)).size,
    };

    const branchMap: Record<string, number> = {};
    filteredRecords.forEach((r) => {
      branchMap[r.Branch] = (branchMap[r.Branch] || 0) + r["Total Price"];
    });
    const grandSal = Object.values(branchMap).reduce((s, v) => s + v, 0) || 1;
    const branchBreakdown = Object.entries(branchMap)
      .map(([name, sales]) => ({ name, sales, percent: (sales / grandSal) * 100 }))
      .sort((a, b) => b.sales - a.sales);

    const prodMap: Record<string, { qty: number; sales: number }> = {};
    filteredRecords.forEach((r) => {
      const curr = prodMap[r.Product] || { qty: 0, sales: 0 };
      prodMap[r.Product] = {
        qty: curr.qty + r.Quantity,
        sales: curr.sales + r["Total Price"],
      };
    });
    const topProducts = Object.entries(prodMap)
      .map(([name, meta]) => ({ name, sales: meta.sales, quantity: meta.qty }))
      .sort((a, b) => b.sales - a.sales);

    return { totals, branchBreakdown, topProducts };
  };

  // Export handlers
  const handleDownloadPdfReport = async () => {
    const { totals, branchBreakdown, topProducts } = getExportData();
    const mainDashboardId = "executive-reporting-boundaries";
    await exportDashboardToPdf(mainDashboardId, "SalesPulse_CFO_Audit_Report", filteredRecords, totals, branchBreakdown, topProducts);
  };

  const handleDownloadPresentationSlides = () => {
    const { totals, branchBreakdown, topProducts } = getExportData();
    exportDashboardToSlides(
      filteredRecords,
      totals,
      branchBreakdown,
      topProducts,
    );
  };

  // If no user session is valid, prevent layout infiltration
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const tabTitles: Record<string, string> = {
    overview: "Dashboard Overview",
    software_business: "Software Business Management",
    sales: "Sales Analytics",
    products: "Product Analytics",
    customers: "Customer Intelligence",
    financials: "Collections",
    pipeline: "Pipeline & Targets",
    kam_performance: "KAM Analytics",
    funnel: "Sales Funnel",
    forecasting: "Sales Forecasting Intelligence",
    settings: "System Settings",
    lead_analysis: "Lead Analysis",
  };

  const pageTitle = tabTitles[activeTab] || "Insights";

  // Choose the page layout view module depending on menu selector
  const renderTabContent = () => {
    const props = { 
      filteredRecords, 
      allRecords, 
      theme, 
      filteredCollectionRecords, 
      filters,
      setFilters,
      activeTab,
      collectionRecords,
      funnelRecords,
      filteredFunnelRecords
    };
    switch (activeTab) {
      case "overview":
        return (
          <DashboardOverviewPage 
            {...props} 
            filteredCollectionRecords={filteredCollectionRecords} 
          />
        );
      case "software_business":
        return <SoftwareBusinessPage theme={theme} filters={filters} />;
      case "forecasting":
        return (
          <ForecastingPage 
            allRecords={allRecords} 
            funnelRecords={funnelRecords} 
            theme={theme} 
            filters={filters}
          />
        );
      case "sales":
        return <SalesAnalyticsPage {...props} />;
      case "products":
        return <ProductAnalyticsPage {...props} />;
      case "customers":
        return <CustomerInsightsPage {...props} />;
      case "financials":
        return (
          <FinancialAnalyticsPage
            {...props}
            collectionRecords={collectionRecords}
            filteredCollectionRecords={filteredCollectionRecords}
          />
        );
      case "pipeline":
        return <TargetAnalyticsPage {...props} filteredCollectionRecords={filteredCollectionRecords} />;
      case "kam_performance":
        return <KamAnalyticsPage {...props} collectionRecords={collectionRecords} filteredCollectionRecords={filteredCollectionRecords} />;
      case "funnel":
        return (
          <FunnelPage
            funnelRecords={funnelRecords}
            filteredFunnelRecords={filteredFunnelRecords}
            onUpdateFunnelRecords={setFunnelRecords}
            theme={theme}
          />
        );
      case "lead_analysis":
        return (
          <LeadAnalysisPage
            records={leadRecords}
            allRecords={allRecords}
            theme={theme}
            globalFilters={filters}
            onUpdateRecords={(records) => {
              setLeadRecords(records);
              saveLocalLeadAnalysisRecords(records);
            }}
          />
        );
      case "settings":
        return (
          <SettingsPage
            allRecords={allRecords}
            theme={theme}
            syncLogs={syncLogs}
            onImportRecords={handleImportRecords}
            onImportCollections={handleImportCollections}
            onImportTargets={handleImportTargets}
            onImportFunnels={handleImportFunnels}
            onImportSoftwareSubscriptions={handleImportSoftwareSubscriptions}
            onImportLeads={handleImportLeads}
            onResetDb={handleResetDb}
          />
        );
      default:
        return <DashboardOverviewPage {...props} />;
    }
  };

  return (
    <div
      className={`min-h-screen w-full flex font-sans ${theme.bgMain} ${theme.textMain} transition-all duration-300 overflow-x-hidden relative`}
    >
      {/* Left Collapsible Menu Panel */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={currentUser}
        onLogout={handleLogout}
        theme={theme}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      {!collapsed && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden"
          onClick={() => setCollapsed(true)}
        ></div>
      )}

      {/* Main content grid */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header navbar with search, profiles, reset triggers and importers */}
        <Header
          theme={theme}
          setThemeVariant={handleThemeVariantChange}
          searchQuery={filters.searchQuery}
          setSearchQuery={(q) => setFilters((p) => ({ ...p, searchQuery: q }))}
          syncLogs={syncLogs}
          totalRecords={allRecords.length}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Global CFO Export Toolbars & Presentation actions */}
        <div
          className={`px-4 md:px-6 pt-4 md:pt-5 pb-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-indigo-950/20`}
        >
          {!(activeTab === "lead_analysis" || activeTab === "software_business") && (
            <div>
              <h1 className={`text-xl lg:text-3xl font-bold font-sans tracking-tight flex items-center gap-2 ${theme.isDark ? "text-white" : "text-slate-900"}`}>
                {pageTitle}
              </h1>
              <p className="text-xs text-[#94A3B8] font-mono mt-1">
                Precision Sales. Unrestricted Growth.
              </p>
            </div>
          )}

          {!(["settings", "data_schema", "funnel", "software_business", "lead_analysis"].includes(activeTab)) && (

            <div
              id="cfo-presentation-export-controls"
              className="flex items-center gap-2 flex-wrap"
            >
              <button
                id="export-to-slide-presentation-btn"
                onClick={handleDownloadPresentationSlides}
                disabled={filteredRecords.length === 0}
                className="px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow transition cursor-pointer disabled:opacity-50"
                title="Generate PowerPoint executive deck"
              >
                <Presentation size={13} />
                <span>Export slides Presentation</span>
              </button>

              <button
                id="export-to-pdf-audit-report-btn"
                onClick={handleDownloadPdfReport}
                disabled={filteredRecords.length === 0}
                className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow transition cursor-pointer disabled:opacity-50"
                title="Generate full dashboard landscape PDF"
              >
                <FileText size={13} />
                <span>Export PDF Report</span>
              </button>
            </div>
          )}
        </div>

        {/* Main analytical container boundaries */}
        <main
          id="executive-reporting-boundaries"
          className="flex-1 p-2 md:p-6 pb-24 md:pb-6 space-y-4 md:space-y-6 overflow-y-auto max-w-none w-full"
        >
            {!(activeTab === "settings" || activeTab === "kam_performance" || activeTab === "pipeline") ? (
              <>
                {/* Elite KPI metrics deck */}
                {!(["products", "customers", "financials", "funnel", "data_schema", "software_business", "lead_analysis", "forecasting"].includes(activeTab)) && (
                  <div id="kpi-reporting-section">
                    <KpiSection
                      filteredRecords={filteredRecords}
                      allRecords={allRecords}
                      theme={theme}
                      filteredCollectionRecords={filteredCollectionRecords}
                      filters={filters}
                      onNavigate={setActiveTab}
                    />
                  </div>
                )}

                {/* Global Slicers positioned horizontally above views (inc. Audit Transaction Stream) */}
                {!(["funnel", "data_schema", "software_business", "lead_analysis", "products", "customers", "financials", "forecasting"].includes(activeTab)) && (
                  <div className="w-full">
                    <Filters
                      filters={filters}
                      setFilters={setFilters}
                      allRecords={allRecords}
                      filteredRecords={filteredRecords}
                      activeTab={activeTab}
                      collectionRecords={collectionRecords}
                      filteredCollectionRecords={filteredCollectionRecords}
                      funnelRecords={funnelRecords}
                      filteredFunnelRecords={filteredFunnelRecords}
                      theme={theme}
                    />
                  </div>
                )}

                {/* Full-width Selected Analytical analytical render views */}
                <div className="w-full space-y-6 min-w-0">
                  {renderTabContent()}
                </div>

                {/* Interactive vector charts suite */}
                {!(["funnel", "customers", "products", "financials", "data_schema", "software_business", "lead_analysis", "forecasting"].includes(activeTab)) && (
                  <div className="border-t border-slate-900 pt-6">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] font-mono mb-4 flex items-center gap-2 select-none">
                      <TrendingUp size={14} className="text-amber-500" />
                      Dynamic Interactive Data Visualizations
                    </h4>

                    <div
                      id="analytical-charts-suite"
                      className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start scroll-mt-24"
                    >
                      <div className="xl:col-span-3">
                        <Charts
                          filteredRecords={filteredRecords}
                          allRecords={allRecords}
                          theme={theme}
                          onDrillDown={handleDrillDown}
                        />
                      </div>
                      <div className="xl:col-span-1 h-full">
                        <AiInsights
                          filteredRecords={filteredRecords}
                          allRecords={allRecords}
                          theme={theme}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full min-w-0">{renderTabContent()}</div>
            )}
          </main>
      </div>
      {/* Mobile Navigation Deck */}
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} />

      {/* AI Financial Advisor Chat Interface */}
      <AiAdvisor 
        dataSummary={summaryData} 
        allRecords={allRecords}
        funnelRecords={funnelRecords}
        theme={theme} 
      />
    </div>
  );
}
