import React, { useMemo, useState } from "react";
import { DashboardTheme, LeadAnalysisRecord, SalesRecord } from "../types";
import { formatBDT, formatDate } from "../utils/format";
import { formatToYmd } from "../db/localDb";
import { Activity, Target, Search, BarChart3, TrendingUp, SlidersHorizontal, ChevronRight, ChevronLeft, Plus, Edit, Trash2, X, Cloud, CloudOff, RefreshCw, HelpCircle, CheckCircle, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { pushLeadsToGoogleSheet } from "../utils/syncUtils";

interface LeadAnalysisPageProps {
  records: LeadAnalysisRecord[];
  allRecords?: SalesRecord[];
  theme: DashboardTheme;
  globalFilters?: any;
  onUpdateRecords?: (records: LeadAnalysisRecord[]) => void;
}

export default function LeadAnalysisPage({ records, allRecords = [], theme, globalFilters, onUpdateRecords }: LeadAnalysisPageProps) {
  const [search, setSearch] = useState("");
  
  // Combine local search with global search query
  const effectiveSearch = useMemo(() => {
    return (globalFilters?.searchQuery || search).toLowerCase();
  }, [globalFilters?.searchQuery, search]);
  
  // Real-Time Google Sheets Cloud Sync State and URL config
  const appsScriptUrl = useMemo(() => localStorage.getItem("googleAppsScriptUrl") || "", []);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncError, setSyncError] = useState("");
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("");

  const triggerCloudSync = async (updatedRecords: LeadAnalysisRecord[]) => {
    if (!appsScriptUrl) return;
    setSyncStatus("syncing");
    setSyncError("");
    try {
      const response = await pushLeadsToGoogleSheet(appsScriptUrl, updatedRecords);
      if (response.success) {
        setSyncStatus("success");
        setLastSyncedTime(new Date().toLocaleTimeString());
      } else {
        setSyncStatus("error");
        setSyncError(response.message);
      }
    } catch (err: any) {
      setSyncStatus("error");
      setSyncError(err.message || "Failed to contact bi-directional write proxy.");
    }
  };

  const fetchCloudLeads = async () => {
    if (!appsScriptUrl || !onUpdateRecords) return;
    setSyncStatus("syncing");
    setSyncError("");
    try {
      const response = await fetch("/api/sheets-write-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: appsScriptUrl.trim(),
          payload: { action: "get_leads", sheet: "Leads" }
        })
      });

      if (!response.ok) {
        throw new Error(`Cloud fetch responded with status code ${response.status}`);
      }

      const data = await response.json();
      if (data && (data.success || data.status === "success") && Array.isArray(data.data)) {
        const parsed: LeadAnalysisRecord[] = data.data.map((r: any, idx: number) => {
          return {
            id: r.id || `lead-${idx}`,
            Quarter: String(r.Quarter || ""),
            SL: (r.SL !== undefined && r.SL !== null && r.SL !== "") ? r.SL : (idx + 1),
            Date: r.Date ? formatToYmd(r.Date) : "",
            "Leads Ref.": String(r["Leads Ref."] || r["Leads Ref"] || ""),
            "Customer Name": String(r["Customer Name"] || r["Customer"] || ""),
            "Type": String(r["RFQ/OTM/LTM"] || r["Type"] || r.type || ""),
            "Lead Value": Number(r["Lead Value"] || r.value || 0),
            OEM: String(r.OEM || r.oem || ""),
            Status: String(r.Status || r.status || "Waiting")
          } as LeadAnalysisRecord;
        }).filter((r: LeadAnalysisRecord) => r["Leads Ref."].trim() !== "");

        onUpdateRecords(parsed);
        setSyncStatus("success");
        setLastSyncedTime(new Date().toLocaleTimeString());
      } else {
        throw new Error(data.error || "Failed to parse remote spreadsheet data.");
      }
    } catch (err: any) {
      console.error("Sheet read sync failed:", err);
      // Wait: do not write to syncError on first automatic sync if there's an error so it doesn't immediately distract unless manual action fails
      setSyncStatus("error");
      setSyncError(err.message || "Could not read remote Google Sheet datasets.");
    }
  };

  React.useEffect(() => {
    fetchCloudLeads();
  }, [appsScriptUrl]);

  // CRUD State
  const uniqueQuarters = useMemo(() => {
    const list = new Set<string>();
    
    // Add existing ones if already present
    records.forEach(r => {
      if (r.Quarter && r.Quarter.trim()) {
        list.add(r.Quarter.trim().toUpperCase());
      }
    });

    // Seed Q1FYXX, Q2FYXX, Q3FYXX, Q4FYXX for recent and upcoming years
    const currentYear = new Date().getFullYear();
    const yearsToSeed = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
    yearsToSeed.forEach(y => {
      const yy = String(y).slice(-2);
      list.add(`Q1FY${yy}`);
      list.add(`Q2FY${yy}`);
      list.add(`Q3FY${yy}`);
      list.add(`Q4FY${yy}`);
    });

    return Array.from(list).sort((a, b) => {
      // Sort Q1/Q2/Q3/Q4 nicely
      return a.localeCompare(b);
    });
  }, [records]);

  const uniqueOEMs = useMemo(() => {
    // Explicit, singular major brands as requested - Do not join them or mix them as a single option
    const baseBrands = [
      "CISCO",
      "SOPHOS",
      "MIKROTIK",
      "YEASTAR",
      "FANVIL",
      "APC",
      "MICROSOFT",
      "VIVANCO"
    ];
    
    const list = new Set<string>(baseBrands);

    // Also include any other singular brands existing in data, keeping them cleanly separated
    records.forEach(r => {
      if (r.OEM) {
        // split by common delimiters to extract single individual brands
        r.OEM.split(/[\s,;&+]+/).forEach(p => {
          const cleanBrand = p.trim().toUpperCase();
          if (cleanBrand && cleanBrand.length > 1) {
            list.add(cleanBrand);
          }
        });
      }
    });

    allRecords.forEach(r => {
      if (r.Brand) {
        r.Brand.split(/[\s,;&+]+/).forEach(p => {
          const cleanBrand = p.trim().toUpperCase();
          if (cleanBrand && cleanBrand.length > 1) {
            list.add(cleanBrand);
          }
        });
      }
    });

    return Array.from(list).sort();
  }, [records, allRecords]);

  const uniqueCustomers = useMemo(() => {
    const list = new Set<string>();
    
    // Customers from Sales Records
    allRecords.forEach(r => {
      if (r.Buyer && r.Buyer.trim()) {
        list.add(r.Buyer.trim());
      }
    });

    // Customers from existing Lead records
    records.forEach(r => {
      if (r["Customer Name"] && r["Customer Name"].trim()) {
        list.add(r["Customer Name"].trim());
      }
    });

    return Array.from(list).sort();
  }, [records, allRecords]);

  const uniqueTypes = useMemo(() => {
    const list = new Set<string>();
    records.forEach(r => {
      const typeVal = r.Type;
      if (typeVal && typeVal.trim()) {
        list.add(typeVal.trim().toUpperCase());
      }
    });
    ["RFQ", "OTM", "LTM"].forEach(t => list.add(t));
    return Array.from(list).sort();
  }, [records]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<LeadAnalysisRecord>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const handleOpenAdd = () => {
    setModalMode("add");
    setFormData({
      Quarter: "",
      SL: records.length + 1,
      Date: new Date().toISOString().split("T")[0],
      "Leads Ref.": "",
      "Customer Name": "",
      "Type": "",
      "Lead Value": 0,
      OEM: "",
      Status: "Waiting"
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: LeadAnalysisRecord) => {
    setModalMode("edit");
    setEditingId(rec.id || null);
    setFormData({ ...rec });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string | undefined) => {
    if (!id || !onUpdateRecords) return;
    const updated = records.filter(r => r.id !== id);
    onUpdateRecords(updated);
    triggerCloudSync(updated);
  };

  const handleSave = () => {
    if (!onUpdateRecords) return;
    
    // Copy and normalize data
    const normalizedData = { ...formData };
    
    if (normalizedData.Quarter) {
      normalizedData.Quarter = normalizedData.Quarter.trim().toUpperCase();
    }

    if (normalizedData["Customer Name"]) {
      normalizedData["Customer Name"] = normalizedData["Customer Name"].trim();
    }
    
    if (normalizedData.OEM) {
      // Split on common separators: space, comma, ampersand, plus, slashes, semicolons
      const parts = normalizedData.OEM.split(/[\s,;&+/\\]+/)
        .map(p => p.trim().toUpperCase())
        .filter(Boolean);
        
      // Ensure "no duplicate single brand for each row"
      const uniqueBrands = parts.filter((val, index, self) => self.indexOf(val) === index);
      
      // Save singular or cleanly comma-separated individual brands without duplicates
      normalizedData.OEM = uniqueBrands.join(", ");
    }
    
    if (normalizedData.Type) {
      normalizedData.Type = normalizedData.Type.trim().toUpperCase();
    }

    if (normalizedData.Date) {
      normalizedData.Date = formatToYmd(normalizedData.Date);
    }

    let updated: LeadAnalysisRecord[] = [];
    if (modalMode === "add") {
      const newRec = { ...normalizedData, id: `lead-${Date.now()}` } as LeadAnalysisRecord;
      updated = [...records, newRec];
    } else {
      updated = records.map(r => r.id === editingId ? { ...r, ...normalizedData } as LeadAnalysisRecord : r);
    }
    onUpdateRecords(updated);
    triggerCloudSync(updated);
    setIsModalOpen(false);
  };
  
  // Row pagination and configuration
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showConfig, setShowConfig] = useState(false);

  // Column visibility
  const [cols, setCols] = useState({
    sl: true,
    quarter: true,
    date: true,
    ref: true,
    customerName: true,
    oem: true,
    type: false,
    status: true,
    value: true
  });

  // Column specific filters
  const [filters, setFilters] = useState({
    sl: "",
    quarter: "",
    ref: "",
    customerName: "",
    oem: "",
    type: "",
    status: "",
    value: ""
  });

  const [sortDate, setSortDate] = useState<"desc" | "asc">("desc");

  const filteredRecords = useMemo(() => {
    const STATUS_ORDER: Record<string, number> = {
      "waiting": 1,
      "postponed": 2,
      "cancelled": 3,
      "lost": 4,
      "won": 5
    };

    const result = records.filter((r) => {
      // Global search
      const qs = effectiveSearch;
      if (qs && !(
        (r["Leads Ref."] || "").toLowerCase().includes(qs) ||
        (r["Customer Name"] || "").toLowerCase().includes(qs) ||
        (r.Quarter || "").toLowerCase().includes(qs) ||
        (r.OEM || "").toLowerCase().includes(qs)
      )) {
        return false;
      }
      
      // Column filters
      if (filters.sl && !(r.SL || "").toString().toLowerCase().includes(filters.sl.toLowerCase())) return false;
      if (filters.quarter && !(r.Quarter || "").toLowerCase().includes(filters.quarter.toLowerCase())) return false;
      if (filters.ref && !(r["Leads Ref."] || "").toLowerCase().includes(filters.ref.toLowerCase())) return false;
      if (filters.customerName && !(r["Customer Name"] || "").toLowerCase().includes(filters.customerName.toLowerCase())) return false;
      if (filters.oem && !(r.OEM || "").toLowerCase().includes(filters.oem.toLowerCase())) return false;
      if (filters.type && !(r.Type || "").toLowerCase().includes(filters.type.toLowerCase())) return false;
      if (filters.status && !(r.Status || "").toLowerCase().includes(filters.status.toLowerCase())) return false;
      if (filters.value && !(r["Lead Value"] || "").toString().toLowerCase().includes(filters.value.toLowerCase())) return false;
      
      return true;
    });

    result.sort((a, b) => {
      const sA = (a.Status || "waiting").toLowerCase();
      const sB = (b.Status || "waiting").toLowerCase();
      
      const orderA = STATUS_ORDER[sA] || 99;
      const orderB = STATUS_ORDER[sB] || 99;

      if (orderA !== orderB) {
         return orderA - orderB;
      }

      const dateA = new Date(a.Date).getTime();
      const dateB = new Date(b.Date).getTime();
      
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return sortDate === "desc" ? dateB - dateA : dateA - dateB;
      }
      return 0;
    });

    return result;
  }, [records, search, filters, sortDate]);

  // Pagination bounds
  const totalLeads = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalLeads / rowsPerPage));
  const pageIndex = Math.min(Math.max(currentPage - 1, 0), totalPages - 1);
  const paginatedRecords = filteredRecords.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);

  const totalValue = filteredRecords.reduce((acc, r) => acc + (r["Lead Value"] || 0), 0);

  const totalSalesRevenue = useMemo(() => {
    return allRecords.reduce((acc, r) => {
      const v = r["Total Price"] || 0;
      return acc + v;
    }, 0);
  }, [allRecords]);

  const statusSummary = useMemo(() => {
    const summary = {
      waiting: { count: 0, value: 0 },
      postponed: { count: 0, value: 0 },
      cancelled: { count: 0, value: 0 },
      lost: { count: 0, value: 0 },
      won: { count: 0, value: 0 },
    };
    filteredRecords.forEach(r => {
      const s = (r.Status || "waiting").toLowerCase();
      if (summary[s as keyof typeof summary] !== undefined) {
        summary[s as keyof typeof summary].count++;
        summary[s as keyof typeof summary].value += (r["Lead Value"] || 0);
      }
    });
    return summary;
  }, [filteredRecords]);

  const statusChartData = useMemo(() => [
    { name: "Waiting", count: statusSummary.waiting.count, value: statusSummary.waiting.value, color: "#fbbf24" },
    { name: "Postponed", count: statusSummary.postponed.count, value: statusSummary.postponed.value, color: "#fb923c" },
    { name: "Cancelled", count: statusSummary.cancelled.count, value: statusSummary.cancelled.value, color: "#a1a1aa" },
    { name: "Lost", count: statusSummary.lost.count, value: statusSummary.lost.value, color: "#fb7185" },
    { name: "Won", count: statusSummary.won.count, value: statusSummary.won.value, color: "#34d399" },
  ], [statusSummary]);

  const wonLeadsValue = statusSummary.won.value;
  const lostLeadsValue = statusSummary.lost.value;
  const wonLostTotalValue = wonLeadsValue + lostLeadsValue;
  const achievementRatio = wonLostTotalValue > 0 ? (wonLeadsValue / wonLostTotalValue) * 100 : 0;
  const winRateCount = totalLeads > 0 ? (statusSummary.won.count / totalLeads) * 100 : 0;

  const topOem = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const oem = r.OEM?.trim() || "Unknown";
      if (!map[oem]) map[oem] = 0;
      map[oem] += (r["Lead Value"] || 0);
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? { name: sorted[0][0], value: sorted[0][1] } : null;
  }, [filteredRecords]);

  return (
    <div className="space-y-6">
      {/* Configuration Header Panel */}
      <div className={`p-4 md:p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${theme.isDark ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-100 text-indigo-600"}`}>
              <Activity size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={`text-lg font-bold ${theme.textMain} whitespace-nowrap`}>Sales Lead Analysis</h2>
                {!appsScriptUrl ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/10 whitespace-nowrap">
                    <CloudOff size={10} /> Local Cache
                  </span>
                ) : syncStatus === "syncing" ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse whitespace-nowrap">
                    <RefreshCw size={10} className="animate-spin" /> Syncing...
                  </span>
                ) : syncStatus === "success" ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap" title={`Last synced: ${lastSyncedTime}`}>
                    <CheckCircle size={10} /> Cloud Synced
                  </span>
                ) : syncStatus === "error" ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap" title={syncError}>
                    <AlertCircle size={10} /> Sync Error
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                    <Cloud size={10} /> Cloud Connected
                  </span>
                )}
              </div>
              
              {/* Line 2 */}
              <p className={`text-xs ${theme.textMuted} mt-1.5`}>
                Track and analyze lead submissions and achievements
              </p>
              
              {/* Line 3 */}
              <div className="mt-1 flex items-center">
                {appsScriptUrl && syncStatus === "success" && (
                  <span className="text-[10px] text-emerald-400 font-mono tracking-wide flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-emerald-400" />
                    • Last Cloud Sync: {lastSyncedTime || "Connected"}
                  </span>
                )}
                {appsScriptUrl && syncStatus === "syncing" && (
                  <span className="text-[10px] text-amber-400 font-mono tracking-wide flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    • Syncing data...
                  </span>
                )}
                {appsScriptUrl && syncStatus === "error" && (
                  <span className="text-[10px] text-rose-400 font-mono tracking-wide flex items-center gap-1 animate-pulse">
                    • Error: {syncError || "Failed to sync"}
                  </span>
                )}
                {!appsScriptUrl && (
                  <span className="text-[10px] text-slate-500 font-mono tracking-wide flex items-center gap-1">
                    • Saving changes locally (Offline)
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {onUpdateRecords && (
              <button 
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Plus size={14} /> Add Lead
              </button>
            )}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${theme.border} ${theme.bgCard} w-full sm:w-64`}>
              <Search size={16} className={theme.textMuted} />
              <input
                type="text"
                placeholder="Global search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className={`w-full bg-transparent border-none text-sm ${theme.textMain} outline-none placeholder:${theme.textMuted}`}
              />
            </div>
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className={`px-3 py-2 rounded-xl border ${theme.border} font-bold text-xs flex items-center justify-center gap-2 transition hover:bg-indigo-500/10 hover:text-indigo-400 ${showConfig ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" : theme.textMuted}`}
            >
              <SlidersHorizontal size={14} /> View Config
            </button>
          </div>
        </div>

        {/* View Configuration Panel */}
        {showConfig && (
          <div className={`mb-6 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 grid grid-cols-1 md:grid-cols-2 gap-6`}>
             <div className="space-y-3">
               <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Column Visibility</h4>
               <div className="flex flex-wrap gap-2">
                 {Object.entries(cols).map(([key, isVis]) => (
                   <label key={key} className={`flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/50 border border-slate-800 text-[10px] uppercase font-bold tracking-wider cursor-pointer select-none transition ${isVis ? "text-indigo-400 border-indigo-500/30" : "text-slate-500 hover:text-slate-300"}`}>
                     <input type="checkbox" className="hidden" checked={isVis} onChange={() => setCols(prev => ({...prev, [key]: !prev[key as keyof typeof prev]}))} />
                     {key} {isVis ? "✓" : ""}
                   </label>
                 ))}
               </div>
             </div>
             <div className="space-y-3">
               <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Row Configuration</h4>
               <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-400 font-mono">Row Density:</span>
                  {[25, 50, 100, 200].map(val => (
                    <button 
                      key={val}
                      onClick={() => { setRowsPerPage(val); setCurrentPage(1); }}
                      className={`px-3 py-1 font-mono text-xs rounded border ${rowsPerPage === val ? "bg-indigo-600 text-white border-indigo-500" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"}`}
                    >
                      {val}
                    </button>
                  ))}
               </div>
             </div>
          </div>
        )}

        <div className="flex flex-col gap-4 mb-4 md:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
            <div className={`p-4 rounded-xl border ${theme.border} bg-slate-900/50`}>
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className="text-teal-400" />
                <p className="text-xs font-semibold text-slate-300 uppercase">Filtered Submissions</p>
              </div>
              <p className="text-xl font-bold font-mono text-slate-100">{totalLeads}</p>
            </div>
            <div className={`p-4 rounded-xl border ${theme.border} bg-slate-900/50`}>
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-amber-400" />
                <p className="text-xs font-semibold text-slate-300 uppercase">Filtered Lead Value</p>
              </div>
              <p className="text-xl font-bold font-mono text-emerald-400">{formatBDT(totalValue, true, true)}</p>
            </div>
            <div className={`p-4 rounded-xl border ${theme.border} bg-slate-900/50`}>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={16} className="text-emerald-400" />
                <p className="text-xs font-semibold text-slate-300 uppercase">Total Won Value</p>
              </div>
              <p className="text-xl font-bold font-mono text-emerald-400">{formatBDT(wonLeadsValue, true, true)}</p>
            </div>
            <div className={`p-4 rounded-xl border ${theme.border} bg-slate-900/50`}>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={16} className="text-violet-400" />
                <p className="text-xs font-semibold text-slate-300 uppercase">Top OEM Value</p>
              </div>
              <p className="text-xl font-bold font-mono text-violet-400">{topOem ? formatBDT(topOem.value, true, true) : "-"}</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{topOem ? topOem.name : "N/A"}</p>
            </div>
            <div className={`p-4 rounded-xl border ${theme.border} bg-slate-900/50`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-pink-400" />
                <p className="text-xs font-semibold text-slate-300 uppercase">Win Rate (Qty)</p>
              </div>
              <p className="text-xl font-bold font-mono text-pink-400">{winRateCount.toFixed(1)}%</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Won Leads vs Total</p>
            </div>
            <div className={`p-4 rounded-xl border ${theme.border} bg-slate-900/50`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-rose-400" />
                <p className="text-xs font-semibold text-slate-300 uppercase">Achievement Ratio</p>
              </div>
              <p className="text-xl font-bold font-mono text-rose-400">{achievementRatio.toFixed(1)}%</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Sales vs Lead Value</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            <div className={`p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between`}>
               <div>
                 <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Waiting</p>
                 <div className="flex items-baseline gap-2">
                   <p className="text-lg font-bold font-mono text-amber-400">{statusSummary.waiting.count}</p>
                   <p className="text-[11px] font-bold font-mono text-amber-500/80">{formatBDT(statusSummary.waiting.value, true, true)}</p>
                 </div>
               </div>
               <Activity size={24} className="text-amber-500/20" />
            </div>
            <div className={`p-3 rounded-xl border border-orange-500/20 bg-orange-500/5 flex items-center justify-between`}>
               <div>
                 <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-1">Postponed</p>
                 <div className="flex items-baseline gap-2">
                   <p className="text-lg font-bold font-mono text-orange-400">{statusSummary.postponed.count}</p>
                   <p className="text-[11px] font-bold font-mono text-orange-500/80">{formatBDT(statusSummary.postponed.value, true, true)}</p>
                 </div>
               </div>
               <Target size={24} className="text-orange-500/20" />
            </div>
            <div className={`p-3 rounded-xl border border-zinc-500/20 bg-zinc-500/5 flex items-center justify-between`}>
               <div>
                 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Cancelled</p>
                 <div className="flex items-baseline gap-2">
                   <p className="text-lg font-bold font-mono text-zinc-300">{statusSummary.cancelled.count}</p>
                   <p className="text-[11px] font-bold font-mono text-zinc-400/80">{formatBDT(statusSummary.cancelled.value, true, true)}</p>
                 </div>
               </div>
               <BarChart3 size={24} className="text-zinc-500/20" />
            </div>
            <div className={`p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-center justify-between`}>
               <div>
                 <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Lost</p>
                 <div className="flex items-baseline gap-2">
                   <p className="text-lg font-bold font-mono text-rose-400">{statusSummary.lost.count}</p>
                   <p className="text-[11px] font-bold font-mono text-rose-500/80">{formatBDT(statusSummary.lost.value, true, true)}</p>
                 </div>
               </div>
               <TrendingUp size={24} className="text-rose-500/20 mt-1" />
            </div>
            <div className={`p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between col-span-2 md:col-span-1`}>
               <div>
                 <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Won</p>
                 <div className="flex items-baseline gap-2">
                   <p className="text-lg font-bold font-mono text-emerald-400">{statusSummary.won.count}</p>
                   <p className="text-[11px] font-bold font-mono text-emerald-500/80">{formatBDT(statusSummary.won.value, true, true)}</p>
                 </div>
               </div>
               <Target size={24} className="text-emerald-500/20" />
            </div>
          </div>
        </div>

        {/* Premium Chart */}
        <div className={`p-5 rounded-2xl border ${theme.border} bg-slate-900 shadow-xl mb-4 md:mb-8`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <BarChart3 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Status Pipeline Distribution</h3>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">Volume & Value Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              <div className="px-3 py-1.5 rounded-full bg-slate-800 text-slate-300">Total Leads: <span className="font-bold text-white">{totalLeads}</span></div>
            </div>
          </div>
          
          <div className="h-[280px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barSize={40}>
                <defs>
                  {statusChartData.map((entry, index) => (
                    <linearGradient key={`grad-${index}`} id={`grad-${index}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                      <stop offset="100%" stopColor={entry.color} stopOpacity={0.4} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={12}
                  fontWeight={600}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => Math.floor(val).toString()} 
                  allowDecimals={false} 
                />
                <Tooltip
                  cursor={{ fill: '#1e293b', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)", padding: "12px" }}
                  formatter={(value: any, name: string, props: any) => [
                    <span className="font-bold text-white ml-2">{name === 'count' ? `${value} Leads` : formatBDT(value, true, true)}</span>,
                    <span className="text-slate-400 uppercase tracking-wider text-[10px]">{name === 'count' ? 'Volume' : 'Value'}</span>
                  ]}
                  labelStyle={{ color: "#94a3b8", fontWeight: "bold", marginBottom: "8px", fontSize: "12px" }}
                />
                <Bar yAxisId="left" dataKey="count" radius={[6, 6, 0, 0]}>
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#grad-${index})`} style={{ filter: `drop-shadow(0px 4px 6px ${entry.color}33)` }} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Data list and grids */}
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs whitespace-nowrap min-w-[800px]">
               <thead className="bg-slate-900 text-slate-400 uppercase font-semibold">
                <tr>
                  {cols.sl && <th className="py-3 px-4">SL</th>}
                  {cols.quarter && <th className="py-3 px-4">Quarter</th>}
                  {cols.date && (
                    <th className="py-3 px-4 cursor-pointer hover:text-white transition-colors" onClick={() => setSortDate(prev => prev === 'desc' ? 'asc' : 'desc')}>
                      <div className="flex items-center gap-1 select-none">
                        Date {sortDate === "desc" ? "↓" : "↑"}
                      </div>
                    </th>
                  )}
                  {cols.ref && <th className="py-3 px-4">Leads Ref.</th>}
                  {cols.customerName && <th className="py-3 px-4">Customer Name</th>}
                  {cols.oem && <th className="py-3 px-4">OEM</th>}
                  {cols.type && <th className="py-3 px-4">Type</th>}
                  {cols.status && <th className="py-3 px-4 text-center">Status</th>}
                  {cols.value && <th className="py-3 px-4 text-right">Lead Value</th>}
                  {onUpdateRecords && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
                {/* Column Filters Row */}
                <tr className="bg-slate-950/60 border-t border-slate-800">
                  {cols.sl && (
                    <th className="py-2 px-2">
                      <input type="text" placeholder="SL..." value={filters.sl} onChange={e => { setFilters({...filters, sl: e.target.value}); setCurrentPage(1); }} className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
                    </th>
                  )}
                  {cols.quarter && (
                    <th className="py-2 px-2">
                      <input type="text" placeholder="Filter..." value={filters.quarter} onChange={e => { setFilters({...filters, quarter: e.target.value}); setCurrentPage(1); }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
                    </th>
                  )}
                  {cols.date && <th className="py-2 px-2"></th>}
                  {cols.ref && (
                    <th className="py-2 px-2">
                      <input type="text" placeholder="Ref..." value={filters.ref} onChange={e => { setFilters({...filters, ref: e.target.value}); setCurrentPage(1); }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
                    </th>
                  )}
                  {cols.customerName && (
                    <th className="py-2 px-2">
                      <input type="text" placeholder="Customer..." value={filters.customerName} onChange={e => { setFilters({...filters, customerName: e.target.value}); setCurrentPage(1); }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
                    </th>
                  )}
                  {cols.oem && (
                    <th className="py-2 px-2">
                      <input type="text" placeholder="OEM..." value={filters.oem} onChange={e => { setFilters({...filters, oem: e.target.value}); setCurrentPage(1); }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
                    </th>
                  )}
                  {cols.type && (
                    <th className="py-2 px-2">
                      <input type="text" placeholder="Type..." value={filters.type} onChange={e => { setFilters({...filters, type: e.target.value}); setCurrentPage(1); }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
                    </th>
                  )}
                  {cols.status && (
                    <th className="py-2 px-2">
                      <input type="text" placeholder="Status..." value={filters.status} onChange={e => { setFilters({...filters, status: e.target.value}); setCurrentPage(1); }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
                    </th>
                  )}
                  {cols.value && (
                    <th className="py-2 px-2">
                      <input type="text" placeholder="Value..." value={filters.value} onChange={e => { setFilters({...filters, value: e.target.value}); setCurrentPage(1); }} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500" />
                    </th>
                  )}
                  {onUpdateRecords && <th className="py-2 px-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/50">
                {paginatedRecords.map((r, i) => {
                  const s = r.Status?.toLowerCase() || '';
                  let formatColor = 'text-slate-300 bg-slate-500/10 border-slate-500/20';
                  if (s === 'won') formatColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                  else if (s === 'lost') formatColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                  else if (s === 'waiting') formatColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                  else if (s === 'postponed') formatColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
                  else if (s === 'cancelled') formatColor = 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
                    
                  return (
                    <tr key={r.id || i} className="hover:bg-slate-900/50 transition-colors">
                      {cols.sl && <td className="py-3 px-4 text-slate-300">{r.SL}</td>}
                      {cols.quarter && <td className="py-3 px-4 text-indigo-400 font-bold">{r.Quarter}</td>}
                      {cols.date && <td className="py-3 px-4 text-slate-300">{formatDate(r.Date)}</td>}
                      {cols.ref && <td className="py-3 px-4 text-slate-200 font-medium">{r["Leads Ref."]}</td>}
                      {cols.customerName && <td className="py-3 px-4 text-slate-200 font-medium">{r["Customer Name"]}</td>}
                      {cols.oem && (
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-[80px]">
                            {r.OEM ? r.OEM.split(',').map((b, bi) => (
                              <span key={bi} className="font-bold text-[9px] uppercase tracking-wider text-teal-400 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded break-all">
                                {b.trim()}
                              </span>
                            )) : "-"}
                          </div>
                        </td>
                      )}
                      {cols.type && <td className="py-3 px-4 text-amber-400">{r.Type}</td>}
                      {cols.status && (
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${formatColor}`}>
                            {r.Status || "Pending"}
                          </span>
                        </td>
                      )}
                      {cols.value && (
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-1.5 rounded-lg border font-mono font-bold whitespace-nowrap ${formatColor}`}>
                            {formatBDT(r["Lead Value"] || 0)}
                          </span>
                        </td>
                      )}
                      {onUpdateRecords && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleOpenEdit(r)} 
                              className="p-1 hover:bg-slate-800/30 rounded text-slate-400 hover:text-indigo-400 transition"
                              title="Edit Lead"
                            >
                              <Edit size={14} />
                            </button>
                            {confirmDeleteId === r.id ? (
                              <div className="flex items-center gap-1.5">
                                <button 
                                  onClick={() => {
                                    handleDelete(r.id);
                                    setConfirmDeleteId(null);
                                  }} 
                                  className="px-2 py-0.5 text-[9px] font-bold text-white bg-rose-600 hover:bg-rose-500 rounded transition uppercase tracking-wider"
                                >
                                  Confirm
                                </button>
                                <button 
                                  onClick={() => setConfirmDeleteId(null)} 
                                  className="px-2 py-0.5 text-[9px] font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 rounded transition uppercase tracking-wider"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setConfirmDeleteId(r.id || null)} 
                                className="p-1 hover:bg-slate-800/30 rounded text-slate-400 hover:text-rose-400 transition"
                                title="Delete Lead"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {paginatedRecords.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500 font-mono">
                      No lead records matching current filters
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-900/80 border-t-2 border-slate-700">
                <tr className="font-bold text-slate-100">
                  {cols.sl && <td className="py-3 px-4"></td>}
                  {cols.quarter && <td className="py-3 px-4"></td>}
                  {cols.date && <td className="py-3 px-4"></td>}
                  {cols.ref && <td className="py-3 px-4"></td>}
                  {cols.customerName && <td className="py-3 px-4 text-right sm:text-left">TOTAL</td>}
                  {cols.oem && <td className="py-3 px-4 hidden sm:table-cell"></td>}
                  {cols.type && <td className="py-3 px-4"></td>}
                  {cols.status && <td className="py-3 px-4"></td>}
                  {cols.value && (
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex flex-col items-end">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Sum Filtered</span>
                        <span className="text-sm font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-lg">
                          {formatBDT(totalValue)}
                        </span>
                      </div>
                    </td>
                  )}
                  {onUpdateRecords && <td className="py-3 px-4"></td>}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Optimized Mobile Card List View (For screens < 768px) */}
          <div className="block md:hidden space-y-3.5">
            {paginatedRecords.map((r, i) => {
              const s = r.Status?.toLowerCase() || '';
              let formatColor = 'text-slate-300 bg-slate-500/10 border-slate-500/20';
              if (s === 'won') formatColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
              else if (s === 'lost') formatColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
              else if (s === 'waiting') formatColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
              else if (s === 'postponed') formatColor = 'text-orange-400 bg-orange-500/10 border-orange-500/25';
              else if (s === 'cancelled') formatColor = 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';

              return (
                <div 
                  key={r.id || i} 
                  className={`p-4 rounded-xl border ${theme.border} bg-slate-900/40 space-y-3 hover:bg-slate-900 transition-all`}
                >
                  {/* Header Row: SL, Date, Status */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">SL:</span>
                      <span className="text-xs font-mono font-black text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">#{r.SL}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">{formatDate(r.Date)}</span>
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${formatColor}`}>
                        {r.Status || "Pending"}
                      </span>
                    </div>
                  </div>

                  {/* Main Row: Lead Reference & Quarter */}
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-100 leading-snug break-words">
                        {r["Leads Ref."] || "No Reference"}
                      </h4>
                      <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/15 whitespace-nowrap">
                        {r.Quarter}
                      </span>
                    </div>
                  </div>

                  {/* Technical details: brands / types */}
                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 uppercase font-black pr-0.5">OEM/Brands:</span>
                      {r.OEM ? r.OEM.split(',').map((b, bi) => (
                        <span key={bi} className="font-bold text-[9px] uppercase tracking-wider text-teal-400 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded">
                          {b.trim()}
                        </span>
                      )) : <span className="text-[10px] text-slate-650 font-mono">-</span>}
                    </div>
                    
                    {r.Type && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span className="text-[10px] text-slate-500 uppercase font-black">Proposal Type:</span>
                        <span className="text-amber-400 font-extrabold uppercase text-[10px]">{r.Type}</span>
                      </div>
                    )}
                  </div>

                  {/* Valuation & actions */}
                  <div className="flex items-center justify-between gap-4 pt-2.5 border-t border-slate-800/60">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block font-semibold mb-0.5">Lead Value</span>
                      <span className={`px-2.5 py-1 rounded-lg border font-mono font-extrabold text-xs inline-block ${formatColor}`}>
                        {formatBDT(r["Lead Value"] || 0)}
                      </span>
                    </div>

                    {onUpdateRecords && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleOpenEdit(r)} 
                          className="p-2.5 bg-slate-800/60 hover:bg-slate-850 rounded-lg text-slate-300 hover:text-indigo-400 transition"
                          title="Edit Lead"
                        >
                          <Edit size={14} />
                        </button>
                        {confirmDeleteId === r.id ? (
                          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-rose-500/20">
                            <button 
                              onClick={() => {
                                handleDelete(r.id);
                                setConfirmDeleteId(null);
                              }} 
                              className="px-2 py-1 text-[9px] font-bold text-white bg-rose-600 hover:bg-rose-500 rounded transition uppercase tracking-wider"
                            >
                              Yes
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteId(null)} 
                              className="px-2 py-1 text-[9px] font-bold text-slate-400 bg-slate-800 hover:bg-slate-750 rounded transition uppercase tracking-wider"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setConfirmDeleteId(r.id || null)} 
                            className="p-2.5 bg-slate-800/60 hover:bg-slate-850 rounded-lg text-slate-300 hover:text-rose-400 transition"
                            title="Delete Lead"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {paginatedRecords.length === 0 && (
              <div className="p-12 text-center text-slate-550 font-mono rounded-xl border border-dashed border-slate-800 bg-slate-950/20">
                No lead records matching current filters
              </div>
            )}
          </div>

          {/* Unified Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400 font-mono text-center sm:text-left">
                Showing {pageIndex * rowsPerPage + 1} - {Math.min((pageIndex + 1) * rowsPerPage, totalLeads)} of {totalLeads} rows
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); }}
                  disabled={currentPage === 1}
                  className="p-1.5 px-3 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center justify-center animate-none"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-mono font-bold text-slate-200 px-3 py-1 bg-slate-950 rounded-lg border border-slate-850">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                  disabled={currentPage === totalPages}
                  className="p-1.5 px-3 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center justify-center animate-none"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                {modalMode === "add" ? <Plus className="text-indigo-400" /> : <Edit className="text-indigo-400" />}
                {modalMode === "add" ? "Add Lead" : "Edit Lead"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">SL Number</label>
                  <input
                    type="number"
                    value={formData.SL || ""}
                    onChange={e => setFormData({ ...formData, SL: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Date</label>
                  <input
                    type="text"
                    value={formData.Date || ""}
                    placeholder="e.g., 21-Jun-2026"
                    onChange={e => setFormData({ ...formData, Date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Quarter</label>
                    <span className="text-[9px] text-emerald-400 font-mono tracking-wider font-semibold">Sheet Dropdown</span>
                  </div>
                  <input
                    type="text"
                    list="quarter-options"
                    value={formData.Quarter || ""}
                    placeholder="Q1, Q2..."
                    onChange={e => setFormData({ ...formData, Quarter: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                  />
                  <datalist id="quarter-options">
                    {uniqueQuarters.map(q => (
                      <option key={q} value={q} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status</label>
                  <select
                    value={formData.Status || "Waiting"}
                    onChange={e => setFormData({ ...formData, Status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                  >
                    <option value="Waiting">Waiting</option>
                    <option value="Postponed">Postponed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Lost">Lost</option>
                    <option value="Won">Won</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lead Reference</label>
                <input
                  type="text"
                  value={formData["Leads Ref."] || ""}
                  onChange={e => setFormData({ ...formData, "Leads Ref.": e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                  placeholder="E.g., Web Inquiry, Client XYZ"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Customer Name</label>
                  <span className="text-[9px] text-emerald-400 font-mono tracking-wider font-semibold">Sheet Dropdown</span>
                </div>
                <input
                  type="text"
                  list="customer-options"
                  value={formData["Customer Name"] || ""}
                  onChange={e => setFormData({ ...formData, "Customer Name": e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                  placeholder="E.g., Bangladesh Bank"
                />
                <datalist id="customer-options">
                  {uniqueCustomers.map((c, i) => (
                    <option key={i} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">OEM / Brand</label>
                  <span className="text-[9px] text-emerald-400 font-mono tracking-wider font-semibold">Sheet Dropdown</span>
                </div>
                <input
                  type="text"
                  list="oem-options"
                  value={formData.OEM || ""}
                  onChange={e => setFormData({ ...formData, OEM: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                  placeholder="Select/type brand (Cisco, Fortinet, etc.)"
                />
                <datalist id="oem-options">
                  {uniqueOEMs.map(oem => (
                    <option key={oem} value={oem} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Type</label>
                    <span className="text-[9px] text-emerald-400 font-mono tracking-wider font-semibold">Sheet Dropdown</span>
                  </div>
                  <input
                    type="text"
                    list="type-options"
                    value={formData.Type || ""}
                    onChange={e => setFormData({ ...formData, Type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                    placeholder="RFQ, OTM..."
                  />
                  <datalist id="type-options">
                    {uniqueTypes.map(t => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lead Value (৳)</label>
                  <input
                    type="number"
                    value={formData["Lead Value"] || 0}
                    onChange={e => setFormData({ ...formData, "Lead Value": Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold text-sm hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-900/20"
              >
                {modalMode === "add" ? "Save Lead" : "Update Lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
