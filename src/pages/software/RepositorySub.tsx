import React, { useState, useMemo } from "react";
import { 
  Search, Filter, SlidersHorizontal, ArrowUpDown, ChevronDown, 
  ChevronRight, ChevronLeft, Download, Plus, Settings, Eye, EyeOff, AlertCircle 
} from "lucide-react";
import { DashboardTheme, SoftwareSubscription } from "../../types";
import * as XLSX from "xlsx";
import { formatDate } from "../../utils/format";

interface RepositorySubProps {
  subscriptions: SoftwareSubscription[];
  theme: DashboardTheme;
  onAddSub: () => void;
  onEditSub: (sub: SoftwareSubscription) => void;
  onDeleteSub: (subId: string) => void;
}

type SortField = 'account_name' | 'brand_oem' | 'local_vendor' | 'product_name' | 'contract_no' | 'expires_on' | 'total_value' | 'renewal_stage';

export default function RepositorySub({ 
  subscriptions, 
  theme, 
  onAddSub, 
  onEditSub, 
  onDeleteSub 
}: RepositorySubProps) {

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("All");
  const [vendorFilter, setVendorFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");

  // Advanced Column & Row Configuration toggles
  const [colVisible, setColVisible] = useState<Record<string, boolean>>({
    account: true,
    brand: true,
    vendor: true,
    product: true,
    contract: false,
    dates: true,
    quantity: true,
    value: true,
    stage: false,
    status: true,
    days: true,
    actions: true,
  });
  const [rowDensity, setRowDensity] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [showConfig, setShowConfig] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('expires_on');
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Derived calculations
  const densityStyles = useMemo(() => {
    switch (rowDensity) {
      case "compact":
        return {
          cell: "p-1.5 text-[11px]",
          btn: "p-0.5 px-1.5 text-[9px] rounded"
        };
      case "spacious":
        return {
          cell: "p-4 text-sm",
          btn: "p-1.5 px-3 text-xs rounded-lg"
        };
      default:
        return {
          cell: "p-3 text-xs",
          btn: "p-1 px-2 text-[10px] rounded"
        };
    }
  }, [rowDensity]);

  const stickyBgClass = useMemo(() => {
    const bg = theme.bgCard
      .split(" ")
      .find((c) => c.startsWith("bg-")) || (theme.isDark ? "bg-slate-900" : "bg-white");
    return bg.includes("/") ? bg.split("/")[0] : bg;
  }, [theme.bgCard, theme.isDark]);

  const getDaysRemaining = (expiryDateStr: string) => {
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusCategory = (days: number) => {
    if (days < 0) return { label: "Expired", class: "bg-red-500/10 text-red-400 border-red-500/20" };
    if (days <= 30) return { label: "Critical", class: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
    if (days <= 60) return { label: "Attention", class: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
    if (days <= 90) return { label: "Upcoming", class: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" };
    return { label: "Healthy", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  };

  // Get filter lists
  const brandsList = useMemo(() => {
    return ["All", ...Array.from(new Set(subscriptions.map(s => s.brand_oem)))];
  }, [subscriptions]);

  const vendorsList = useMemo(() => {
    return ["All", ...Array.from(new Set(subscriptions.map(s => s.local_vendor)))];
  }, [subscriptions]);

  const stagesList = useMemo(() => {
    return ["All", ...Array.from(new Set(subscriptions.map(s => s.renewal_stage)))];
  }, [subscriptions]);

  const ownersList = useMemo(() => {
    return ["All", ...Array.from(new Set(subscriptions.map(s => s.sales_owner)))];
  }, [subscriptions]);

  // Get Priority Score for Sorting
  const getPriorityScore = (days: number) => {
    if (days > 0 && days <= 30) return 1; // Critical (1st)
    if (days > 30 && days <= 60) return 2; // Attention (2nd)
    if (days > 60 && days <= 90) return 3; // Upcoming (3rd)
    if (days > 90) return 4;               // Healthy (4th)
    return 5;                             // Expired (5th)
  };

  // Filtering Logic
  const filteredSubs = useMemo(() => {
    return subscriptions.filter(sub => {
      const matchSearch = 
        sub.account_name.toLowerCase().includes(search.toLowerCase()) ||
        sub.product_name.toLowerCase().includes(search.toLowerCase()) ||
        sub.contract_no.toLowerCase().includes(search.toLowerCase()) ||
        sub.sales_owner.toLowerCase().includes(search.toLowerCase());

      const matchBrand = brandFilter === "All" || sub.brand_oem === brandFilter;
      const matchVendor = vendorFilter === "All" || sub.local_vendor === vendorFilter;
      const matchStage = stageFilter === "All" || sub.renewal_stage === stageFilter;
      const matchOwner = ownerFilter === "All" || sub.sales_owner === ownerFilter;

      let matchStatus = true;
      if (statusFilter !== "All") {
        const days = getDaysRemaining(sub.expires_on);
        const cat = getStatusCategory(days);
        matchStatus = cat.label === statusFilter;
      }

      return matchSearch && matchBrand && matchVendor && matchStage && matchOwner && matchStatus;
    });
  }, [subscriptions, search, brandFilter, vendorFilter, stageFilter, statusFilter, ownerFilter]);

  // Sorting Logic
  const sortedSubs = useMemo(() => {
    return [...filteredSubs].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      // Expiry dates require specialized priority logic based on distance to today
      if (sortField === 'expires_on') {
        const daysA = getDaysRemaining(a.expires_on);
        const daysB = getDaysRemaining(b.expires_on);
        
        const scoreA = getPriorityScore(daysA);
        const scoreB = getPriorityScore(daysB);

        if (scoreA !== scoreB) {
          return sortAsc ? scoreA - scoreB : scoreB - scoreA;
        }
        
        // Secondary sort within same category: sort by actual date
        return sortAsc 
          ? new Date(a.expires_on).getTime() - new Date(b.expires_on).getTime()
          : new Date(b.expires_on).getTime() - new Date(a.expires_on).getTime();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredSubs, sortField, sortAsc]);

  // Paginated records
  const totalPages = Math.ceil(sortedSubs.length / limit) || 1;
  const paginatedSubs = useMemo(() => {
    const startIdx = (page - 1) * limit;
    return sortedSubs.slice(startIdx, startIdx + limit);
  }, [sortedSubs, page, limit]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const dataForExport = sortedSubs.map(sub => {
      const days = getDaysRemaining(sub.expires_on);
      const cat = getStatusCategory(days);
      return {
        "Account Name": sub.account_name,
        "Customer ID": sub.customer_id,
        "Brand/OEM": sub.brand_oem,
        "Vendor (Local)": sub.local_vendor,
        "Product Name": sub.product_name,
        "Part No": sub.part_no,
        "Contract No": sub.contract_no,
        "Tenure": sub.tenure,
        "Activated On": sub.activated_on,
        "Expires On": sub.expires_on,
        "Quantity": sub.quantity,
        "Unit Price": sub.unit_price,
        "Total Value (BDT)": sub.total_value,
        "Renewal Stage": sub.renewal_stage,
        "Probability %": sub.renewal_probability,
        "Status": sub.status,
        "Category": cat.label,
        "Days Remaining": days,
        "Sales Owner": sub.sales_owner,
        "Competitor": sub.competitor || "N/A",
        "Remarks": sub.remarks
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subscriptions");
    XLSX.writeFile(workbook, "SalesPulse_License_Repository.xlsx");
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Account Name", "Brand/OEM", "Vendor (Local)", "Product Name", "Contract No", 
      "Activated On", "Expires On", "Quantity", "Total Value", "Renewal Stage", "Status", "Days Remaining"
    ];
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
    
    sortedSubs.forEach(sub => {
      const days = getDaysRemaining(sub.expires_on);
      const row = [
        `"${sub.account_name}"`,
        `"${sub.brand_oem}"`,
        `"${sub.local_vendor}"`,
        `"${sub.product_name}"`,
        `"${sub.contract_no}"`,
        `"${sub.activated_on}"`,
        `"${sub.expires_on}"`,
        sub.quantity,
        sub.total_value,
        `"${sub.renewal_stage}"`,
        `"${sub.status}"`,
        days
      ];
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "SalesPulse_License_Repository.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleValueFormat = (val: number) => {
    return `৳ ${val.toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      {/* Configuration & Options Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Search account, product, contract owner..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={`w-full text-xs pl-9 pr-4 py-2 rounded-lg border focus:ring-1 focus:outline-none ${
              theme.isDark 
                ? "bg-slate-900 border-slate-800 focus:ring-indigo-500 focus:border-indigo-500" 
                : "bg-white border-slate-200 focus:ring-indigo-600 focus:border-indigo-600"
            }`}
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Add subscription button */}
          <button
            onClick={onAddSub}
            className="px-3 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> Add Contract
          </button>

          {/* Export options */}
          <button 
            onClick={handleExportExcel}
            className={`px-3 py-2 border rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              theme.isDark 
                ? "bg-slate-950 border-slate-800 hover:bg-slate-900 text-slate-300" 
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-750"
            }`}
            title="Download Excel Spreadsheet"
          >
            <Download size={13} /> Excel
          </button>
          
          <button 
            onClick={handleExportCSV}
            className={`px-3 py-2 border rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              theme.isDark 
                ? "bg-slate-950 border-slate-800 hover:bg-slate-900 text-slate-300" 
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-750"
            }`}
            title="Export CSV"
          >
            <Download size={13} /> CSV
          </button>

          {/* Config Visibility toggles */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 border rounded-lg transition text-slate-400 hover:text-slate-250 cursor-pointer ${
              theme.isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
            }`}
            title="Toggle Row & Column Configuration"
          >
            <SlidersHorizontal size={14} />
          </button>

        </div>
      </div>

      {/* Row/Column Toggles dropdown configurator */}
      {showConfig && (
        <div className={`p-5 rounded-xl border ${theme.bgCard} ${theme.border} text-xs space-y-4 shadow-lg transition-all duration-300`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUMN CONFIGURATION */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-indigo-400">
                  <SlidersHorizontal size={14} /> Configure Columns
                </span>
                <div className="flex gap-2 text-[10px]">
                  <button 
                    onClick={() => {
                      const allVisible = Object.keys(colVisible).reduce((acc, k) => ({ ...acc, [k]: true }), {});
                      setColVisible(allVisible);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-white"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => {
                      const noneVisible = Object.keys(colVisible).reduce((acc, k) => ({ ...acc, [k]: false }), {});
                      // Let's keep actions visible for sanity
                      noneVisible['account'] = true;
                      noneVisible['actions'] = true;
                      setColVisible(noneVisible);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-white"
                  >
                    Minimal
                  </button>
                  <button 
                    onClick={() => {
                      setColVisible({
                        account: true,
                        vendor: true,
                        product: true,
                        contract: true,
                        dates: true,
                        quantity: true,
                        value: true,
                        stage: true,
                        status: true,
                        days: true,
                        actions: true,
                      });
                    }}
                    className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-white"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.keys(colVisible).map((key) => (
                  <button
                    key={key}
                    onClick={() => setColVisible(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={`py-1 px-2 rounded border flex items-center justify-between capitalize font-mono text-[10px] transition ${
                      colVisible[key]
                        ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20"
                        : "bg-slate-950/25 border-slate-800/80 text-slate-500 hover:text-slate-400 hover:bg-slate-950/40"
                    }`}
                  >
                    <span>{key}</span>
                    {colVisible[key] ? <Eye size={11} className="shrink-0 ml-1" /> : <EyeOff size={11} className="shrink-0 ml-1" />}
                  </button>
                ))}
              </div>
            </div>

            {/* ROW ROW CONFIGURATION & PAGINATION */}
            <div className="lg:col-span-5 space-y-4 border-t lg:border-t-0 lg:border-l border-slate-800/40 lg:pl-5 pt-4 lg:pt-0">
              {/* Row Density Selection */}
              <div className="space-y-2">
                <span className="font-bold block text-slate-300">Row Layout Density</span>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-950/30 p-1 rounded-lg border border-slate-800/60">
                  {(["compact", "comfortable", "spacious"] as const).map((density) => (
                    <button
                      key={density}
                      onClick={() => setRowDensity(density)}
                      className={`py-1 px-1.5 rounded text-[11px] font-medium transition capitalize ${
                        rowDensity === density
                          ? "bg-indigo-600 font-semibold text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rows Per Page configuration */}
              <div className="space-y-2">
                <span className="font-bold block text-slate-300">Set Page Limit (Rows per viewport)</span>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 10, 15, 20, 30, 50, 100].map((num) => (
                    <button
                      key={num}
                      onClick={() => { setLimit(num); setPage(1); }}
                      className={`px-2.5 py-1 rounded border font-mono text-[10px] transition ${
                        limit === num
                          ? "bg-indigo-650 border-indigo-550 text-white"
                          : "bg-slate-950/35 border-slate-800 text-slate-450 hover:text-white hover:bg-slate-900"
                      }`}
                    >
                      {num} Rows
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Multi-Column Row Filters */}
      <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} grid grid-cols-2 md:grid-cols-5 gap-3.5`}>
        <div>
          <label className={`text-[10px] uppercase font-mono tracking-wider ${theme.textMuted}`}>Brand/OEM</label>
          <select
            value={brandFilter}
            onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
            className={`w-full mt-1.5 text-xs py-1.5 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
              theme.isDark 
                ? "bg-slate-900 border-slate-800 text-slate-300 focus:ring-indigo-500" 
                : "bg-white border-slate-200 text-slate-700 focus:ring-indigo-600"
            }`}
          >
            {brandsList.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className={`text-[10px] uppercase font-mono tracking-wider ${theme.textMuted}`}>Vendor (Local)</label>
          <select
            value={vendorFilter}
            onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
            className={`w-full mt-1.5 text-xs py-1.5 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
              theme.isDark 
                ? "bg-slate-900 border-slate-800 text-slate-300 focus:ring-indigo-500" 
                : "bg-white border-slate-200 text-slate-700 focus:ring-indigo-600"
            }`}
          >
            {vendorsList.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className={`text-[10px] uppercase font-mono tracking-wider ${theme.textMuted}`}>Renewal Stage</label>
          <select
            value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}
            className={`w-full mt-1.5 text-xs py-1.5 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
              theme.isDark 
                ? "bg-slate-900 border-slate-800 text-slate-300 focus:ring-indigo-500" 
                : "bg-white border-slate-200 text-slate-700 focus:ring-indigo-600"
            }`}
          >
            {stagesList.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className={`text-[10px] uppercase font-mono tracking-wider ${theme.textMuted}`}>Alert Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className={`w-full mt-1.5 text-xs py-1.5 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
              theme.isDark 
                ? "bg-slate-900 border-slate-800 text-slate-300 focus:ring-indigo-500" 
                : "bg-white border-slate-200 text-slate-700 focus:ring-indigo-600"
            }`}
          >
            <option value="All">All Statuses</option>
            <option value="Healthy">Healthy (&gt; 90 Days)</option>
            <option value="Upcoming">Upcoming (61-90 Days)</option>
            <option value="Attention">Attention (31-60 Days)</option>
            <option value="Critical">Critical (0-30 Days)</option>
            <option value="Expired">Expired (&lt; 0 Days)</option>
          </select>
        </div>

        <div>
          <label className={`text-[10px] uppercase font-mono tracking-wider ${theme.textMuted}`}>KAM / Sales Owner</label>
          <select
            value={ownerFilter}
            onChange={(e) => { setOwnerFilter(e.target.value); setPage(1); }}
            className={`w-full mt-1.5 text-xs py-1.5 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
              theme.isDark 
                ? "bg-slate-900 border-slate-800 text-slate-300 focus:ring-indigo-500" 
                : "bg-white border-slate-200 text-slate-700 focus:ring-indigo-600"
            }`}
          >
            {ownersList.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>      {/* Grid List Deck */}
      <div className={`rounded-xl border border-slate-850 overflow-hidden ${theme.bgCard} ${theme.border}`}>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left">
            <thead className={`font-mono text-[10px] uppercase border-b border-slate-800/20 tracking-wider bg-slate-900/35`}>
              <tr>
                {colVisible.account && (
                  <th className={`${densityStyles.cell} sticky left-0 z-20 ${stickyBgClass} border-r ${theme.isDark ? "border-slate-800/60" : "border-slate-200/85"} shadow-[2px_0_5px_rgba(0,0,0,0.15)]`}>
                    <button onClick={() => handleSort('account_name')} className="flex items-center gap-1 cursor-pointer hover:text-indigo-400">
                      Account Name <ArrowUpDown size={11} />
                    </button>
                  </th>
                )}
                {colVisible.brand && (
                  <th className={densityStyles.cell}>
                    <button onClick={() => handleSort('brand_oem')} className="flex items-center gap-1 cursor-pointer hover:text-indigo-400">
                      Brand/OEM <ArrowUpDown size={11} />
                    </button>
                  </th>
                )}
                {colVisible.vendor && (
                  <th className={densityStyles.cell}>
                    <button onClick={() => handleSort('local_vendor')} className="flex items-center gap-1 cursor-pointer hover:text-indigo-400">
                      Vendor <ArrowUpDown size={11} />
                    </button>
                  </th>
                )}
                {colVisible.product && (
                  <th className={densityStyles.cell}>
                    <button onClick={() => handleSort('product_name')} className="flex items-center gap-1 cursor-pointer hover:text-indigo-400">
                      Product Name <ArrowUpDown size={11} />
                    </button>
                  </th>
                )}
                {colVisible.contract && <th className={densityStyles.cell}>Contract No</th>}
                {colVisible.dates && (
                  <th className={densityStyles.cell}>
                    <button onClick={() => handleSort('expires_on')} className="flex items-center gap-1 cursor-pointer hover:text-indigo-400">
                      Expires On <ArrowUpDown size={11} />
                    </button>
                  </th>
                )}
                {colVisible.quantity && <th className={densityStyles.cell}>Qty</th>}
                {colVisible.value && (
                  <th className={`${densityStyles.cell} text-right`}>
                    <button onClick={() => handleSort('total_value')} className="flex items-center gap-1 cursor-pointer hover:text-indigo-400 ml-auto">
                      Value <ArrowUpDown size={11} />
                    </button>
                  </th>
                )}
                {colVisible.stage && (
                  <th className={densityStyles.cell}>
                    <button onClick={() => handleSort('renewal_stage')} className="flex items-center gap-1 cursor-pointer hover:text-indigo-400">
                      Renewal Stage <ArrowUpDown size={11} />
                    </button>
                  </th>
                )}
                {colVisible.days && <th className={`${densityStyles.cell} text-center`}>Remaining</th>}
                {colVisible.actions && <th className={`${densityStyles.cell} text-right`}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/10">
              {paginatedSubs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-medium">
                    No matching subscription contracts found in database repository.
                  </td>
                </tr>
              ) : (
                paginatedSubs.map((sub) => {
                  const days = getDaysRemaining(sub.expires_on);
                  const cat = getStatusCategory(days);

                  return (
                    <tr 
                      key={sub.id} 
                      className={`hover:bg-slate-900/10 transition-colors duration-200 group`}
                    >
                      {colVisible.account && (
                        <td className={`${densityStyles.cell} font-semibold text-slate-100 break-words sticky left-0 z-10 ${stickyBgClass} ${theme.isDark ? "group-hover:bg-[#1e293b]" : "group-hover:bg-[#f1f5f9]"} transition-colors border-r ${theme.isDark ? "border-slate-800/60" : "border-slate-200/85"} shadow-[2px_0_5px_rgba(0,0,0,0.12)]`}>
                          {sub.account_name}
                        </td>
                      )}
                      {colVisible.brand && (
                        <td className={densityStyles.cell}>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                            sub.brand_oem === "Microsoft" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            sub.brand_oem === "VMware" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                            sub.brand_oem === "Adobe" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                            sub.brand_oem === "Sophos" ? "bg-teal-500/10 text-teal-400 border-teal-500/20" :
                            "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          }`}>
                            {sub.brand_oem}
                          </span>
                        </td>
                      )}
                      {colVisible.vendor && (
                        <td className={`${densityStyles.cell} font-mono text-[10px] text-slate-400`}>
                          {sub.local_vendor}
                        </td>
                      )}
                      {colVisible.product && (
                        <td className={`${densityStyles.cell} font-mono max-w-[200px] truncate`} title={sub.product_name}>
                          {sub.product_name}
                        </td>
                      )}
                      {colVisible.contract && (
                        <td className={`${densityStyles.cell} font-mono text-slate-400 text-[10px]`}>{sub.contract_no}</td>
                      )}
                      {colVisible.dates && (
                        <td className={`${densityStyles.cell} font-mono text-slate-300`}>
                          {formatDate(sub.expires_on)}
                        </td>
                      )}
                      {colVisible.quantity && <td className={`${densityStyles.cell} text-slate-450`}>{sub.quantity}</td>}
                      {colVisible.value && (
                        <td className={`${densityStyles.cell} font-bold text-right text-slate-100`}>
                          {handleValueFormat(sub.total_value)}
                        </td>
                      )}
                      {colVisible.stage && (
                        <td className={densityStyles.cell}>
                          <span className="text-slate-300">
                            {sub.renewal_stage}
                          </span>
                        </td>
                      )}
                      {colVisible.days && (
                        <td className={`${densityStyles.cell} text-center`}>
                          <div className={`py-1 px-2.5 rounded-full inline-block border text-[10px] font-bold font-mono tracking-wide ${cat.class}`}>
                            {days < 0 ? `${Math.abs(days)}d Overdue` : `${days}d Left`}
                          </div>
                        </td>
                      )}
                      {colVisible.actions && (
                        <td className={`${densityStyles.cell} text-right`}>
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => onEditSub(sub)}
                              className={`${densityStyles.btn} bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 cursor-pointer`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onDeleteSub(sub.id)}
                              className={`${densityStyles.btn} bg-red-500/10 text-red-500 hover:bg-red-500/20 cursor-pointer`}
                            >
                              Del
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSubs.length > 0 && (
              <tfoot className={`border-t-2 border-indigo-500/30 bg-indigo-500/5 font-extrabold`}>
                <tr className="divide-x divide-slate-800/20">
                  {colVisible.account && (
                    <td className={`${densityStyles.cell} py-4 sticky left-0 z-10 ${stickyBgClass} border-r-2 ${theme.isDark ? "border-indigo-500/20" : "border-slate-200/85"} shadow-[2px_0_10px_rgba(0,0,0,0.3)] text-indigo-400 uppercase tracking-wider font-mono`}>
                      GRAND TOTAL ({filteredSubs.length} Records)
                    </td>
                  )}
                  {colVisible.brand && <td className={densityStyles.cell}></td>}
                  {colVisible.vendor && <td className={densityStyles.cell}></td>}
                  {colVisible.product && <td className={densityStyles.cell}></td>}
                  {colVisible.contract && <td className={densityStyles.cell}></td>}
                  {colVisible.dates && <td className={densityStyles.cell}></td>}
                  {colVisible.quantity && (
                    <td className={`${densityStyles.cell} text-indigo-400`}>
                      {filteredSubs.reduce((sum, s) => sum + (s.quantity || 0), 0)}
                    </td>
                  )}
                  {colVisible.value && (
                    <td className={`${densityStyles.cell} text-right text-emerald-400`}>
                      {handleValueFormat(filteredSubs.reduce((sum, s) => sum + (s.total_value || 0), 0))}
                    </td>
                  )}
                  {colVisible.stage && <td className={densityStyles.cell}></td>}
                  {colVisible.days && <td className={densityStyles.cell}></td>}
                  {colVisible.actions && <td className={densityStyles.cell}></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Dynamic Pagination Controls */}
        <div className={`p-4 border-t border-slate-800/15 flex flex-col sm:flex-row gap-3 items-center justify-between`}>
          <div className="flex items-center gap-2 text-xs">
            <span className={`${theme.textMuted}`}>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className={`text-xs py-1 px-2 rounded border ${
                theme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              }`}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span className={`${theme.textMuted} ml-3 font-mono`}>
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, sortedSubs.length)} of {sortedSubs.length} records
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              className={`p-1.5 rounded-lg border transition ${
                page === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-800 cursor-pointer"
              } ${theme.isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-semibold font-mono px-3">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              className={`p-1.5 rounded-lg border transition ${
                page === totalPages ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-800 cursor-pointer"
              } ${theme.isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
