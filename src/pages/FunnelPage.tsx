/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from "react";
import { 
  Filter as FunnelIcon, 
  Search, 
  Plus, 
  Download, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  DollarSign, 
  CheckCircle, 
  Users, 
  AlertTriangle, 
  X,
  FileSpreadsheet,
  ChevronRight,
  TrendingDown,
  Activity,
  Zap,
  Target,
  Trophy,
  Calendar,
  Settings2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { FunnelRecord, DashboardTheme } from "../types";
import { formatBDT } from "../utils/format";
import { saveLocalFunnelRecords } from "../db/localDb";

interface FunnelPageProps {
  funnelRecords: FunnelRecord[];
  filteredFunnelRecords?: FunnelRecord[];
  onUpdateFunnelRecords: (records: FunnelRecord[]) => void;
  theme: DashboardTheme;
}

const STATUS_OPTIONS = [
  "New",
  "Ongoing",
  "Submitted",
  "Re-Tender[Revised Price",
  "Opportunity (50%-60 %)",
  "Commit",
  "Achieved",
  "Strategic Account",
  "Challenge",
  "Cancelled",
  "Lost"
].sort();

const QUARTER_OPTIONS = [
  "All Quarters",
  "2026 Q1",
  "2026 Q2",
  "2026 Q3",
  "2026 Q4",
];

export default function FunnelPage({
  funnelRecords,
  filteredFunnelRecords,
  onUpdateFunnelRecords,
  theme
}: FunnelPageProps) {
  const displayRecords = filteredFunnelRecords || funnelRecords;

  // Filters
  const [search, setSearch] = useState("");
  const [selectedSalesman, setSelectedSalesman] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedQuarter, setSelectedQuarter] = useState("All");

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [targetRecord, setTargetRecord] = useState<FunnelRecord | null>(null);

  // Form states (Add/Edit)
  const [partner, setPartner] = useState("");
  const [salesman, setSalesman] = useState("");
  const [quarter, setQuarter] = useState("2026 Q2");
  const [startDate, setStartDate] = useState("2026-05-21");
  const [endDate, setEndDate] = useState("2026-06-05");
  const [brand, setBrand] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("New");

  // Table configuration
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [visibleColumns, setVisibleColumns] = useState({
    sl: true,
    partner: true,
    brand: true,
    amount: true,
    kam: true,
    timeline: true,
    status: true,
    actions: true
  });
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Table pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Extract unique salesmen and brands from records for standard filter dropdown arrays
  const uniqueSalesmen = useMemo(() => {
    const set = new Set<string>();
    displayRecords.forEach(r => {
      if (r.salesman) set.add(r.salesman.trim());
    });
    return ["All", ...Array.from(set)];
  }, [displayRecords]);

  // Recognizes brands separated by commas, newlines, carriage returns, semicolons, or HTML line-break tags
  const parseBrands = useCallback((brandStr: any) => {
    if (!brandStr) return [];
    const str = String(brandStr);
    const cleaned = str.replace(/<br\s*\/?>/gi, "\n");
    return cleaned
      .split(/[,\r\n;]+/)
      .map((b) => b.trim())
      .filter(Boolean);
  }, []);

  const uniqueBrands = useMemo(() => {
    const set = new Set<string>();
    displayRecords.forEach(r => {
      if (r.brand) {
        parseBrands(r.brand).forEach(b => {
          set.add(b);
        });
      }
    });
    return ["All", ...Array.from(set).sort()];
  }, [displayRecords, parseBrands]);

  // Handle delete
  const handleDelete = (id: string) => {
    const updated = funnelRecords.filter(r => r.id !== id);
    onUpdateFunnelRecords(updated);
    saveLocalFunnelRecords(updated);
  };

  // Open add Modal
  const openAddModal = () => {
    setPartner("");
    setSalesman("");
    setQuarter("2026 Q2");
    setStartDate("2026-05-21");
    setEndDate("2026-06-05");
    setBrand("");
    setAmount("");
    setStatus("New");
    setIsAddOpen(true);
  };

  // Handle Add Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner || !salesman || !brand || !amount) {
      alert("Please fill all required fields");
      return;
    }

    const newRec: FunnelRecord = {
      id: `funnel-user-${Date.now()}`,
      partner,
      salesman,
      quarter,
      startDate,
      endDate,
      brand,
      amount: Number(amount.replace(/,/g, "")) || 0,
      status
    };

    const updated = [newRec, ...funnelRecords];
    onUpdateFunnelRecords(updated);
    saveLocalFunnelRecords(updated);
    setIsAddOpen(false);
  };

  // Open edit Modal
  const openEditModal = (rec: FunnelRecord) => {
    setTargetRecord(rec);
    setPartner(rec.partner);
    setSalesman(rec.salesman);
    setQuarter(rec.quarter);
    setStartDate(rec.startDate);
    setEndDate(rec.endDate);
    setBrand(rec.brand);
    setAmount(String(rec.amount));
    setStatus(rec.status);
    setIsEditOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRecord) return;

    const updated = funnelRecords.map(r => {
      if (r.id === targetRecord.id) {
        return {
          ...r,
          partner,
          salesman,
          quarter,
          startDate,
          endDate,
          brand,
          amount: Number(String(amount).replace(/,/g, "")) || 0,
          status
        };
      }
      return r;
    });

    onUpdateFunnelRecords(updated);
    saveLocalFunnelRecords(updated);
    setIsEditOpen(false);
    setTargetRecord(null);
  };

  // Exporters
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;
    
    // Headers matching the "google import format" supported by handleImportFunnels in App.tsx
    const worksheetData = filteredRecords.map((r, index) => ({
      "SL": r.SL !== undefined ? r.SL : (index + 1),
      "Partner": r.partner,
      "Salesman": r.salesman,
      "Quarter": r.quarter,
      "Start Date": r.startDate,
      "End Date": r.endDate,
      "Brand": r.brand,
      "Amount": r.amount,
      "Status": r.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Funnel");
    
    XLSX.writeFile(workbook, "Sales_Funnel_Export.xlsx");
  };

  // Base filtering logic (excluding status & stage filters for overall visual fidelity)
  const baseFilteredRecords = useMemo(() => {
    return displayRecords.filter(r => {
      // 1. Text Search
      const searchStr = `${r.partner || ''} ${r.salesman || ''} ${r.brand || ''} ${r.status || ''}`.toLowerCase();
      if (search && !searchStr.includes(search.toLowerCase())) return false;

      // 2. Salesman Filter
      if (selectedSalesman !== "All" && r.salesman !== selectedSalesman) return false;

      // 3. Quarter Filter
      if (selectedQuarter !== "All") {
        const trQtr = selectedQuarter === "All Quarters" ? "All" : selectedQuarter;
        if (trQtr !== "All" && r.quarter !== trQtr) return false;
      }

      // 4. Brand Filter
      if (selectedBrand !== "All") {
        if (!r.brand) return false;
        const brandNames = parseBrands(r.brand).map(b => b.toLowerCase());
        const target = selectedBrand.toLowerCase();
        if (!brandNames.some(b => b.includes(target) || target.includes(b))) return false;
      }

      return true;
    });
  }, [displayRecords, search, selectedSalesman, selectedBrand, selectedQuarter]);

  // Grouped stages for tapered funnel viz based on baseFilteredRecords
  const visualFunnelStages = useMemo(() => {
    // 5 cohesive brackets with premium colors
    const brackets = [
      { 
        name: "1. New / Cold Leads", 
        statuses: ["New"], 
        color: "from-blue-600/80 to-blue-900/40", 
        borderColor: "border-blue-500/50",
        glow: "shadow-blue-500/20",
        amount: 0, 
        count: 0, 
        width: "sm:w-full w-full" 
      },
      { 
        name: "2. Active Evaluation / Ongoing", 
        statuses: ["Ongoing", "Strategic Account"], 
        color: "from-cyan-600/80 to-cyan-900/40", 
        borderColor: "border-cyan-500/50",
        glow: "shadow-cyan-500/20",
        amount: 0, 
        count: 0, 
        width: "sm:w-11/12 w-full" 
      },
      { 
        name: "3. Submitted Proposals / Tender", 
        statuses: ["Submitted", "Re-Tender[Revised Price", "Opportunity (50%-60 %)"], 
        color: "from-amber-500/80 to-amber-900/40", 
        borderColor: "border-amber-400/50",
        glow: "shadow-amber-500/20",
        amount: 0, 
        count: 0, 
        width: "sm:w-9/12 w-full" 
      },
      { 
        name: "4. Committed / Decision Call", 
        statuses: ["Commit", "Challenge"], 
        color: "from-purple-600/80 to-purple-900/40", 
        borderColor: "border-purple-500/50",
        glow: "shadow-purple-500/20",
        amount: 0, 
        count: 0, 
        width: "sm:w-7/12 w-full" 
      },
      { 
        name: "5. Closed - Won / Achieved", 
        statuses: ["Achieved"], 
        color: "from-emerald-600/80 to-emerald-900/40", 
        borderColor: "border-emerald-500/50",
        glow: "shadow-emerald-500/20",
        amount: 0, 
        count: 0, 
        width: "sm:w-5/12 w-full" 
      }
    ];

    baseFilteredRecords.forEach(r => {
      brackets.forEach(b => {
        if (b.statuses.includes(r.status)) {
          b.amount += r.amount;
          b.count++;
        }
      });
    });

    return brackets;
  }, [baseFilteredRecords]);

  // Base overall pipeline statistics for non-distortion percent widths
  const baseStats = useMemo(() => {
    let totalValue = 0;
    let totalAchieved = 0;
    let activeValue = 0;
    let activeDealsCount = 0;
    let totalClosedValue = 0; // Achieved, Cancelled, Lost

    baseFilteredRecords.forEach(r => {
      totalValue += r.amount;

      if (r.status === "Achieved") {
        totalAchieved += r.amount;
        totalClosedValue += r.amount;
      } else if (r.status === "Lost" || r.status === "Cancelled") {
        totalClosedValue += r.amount;
      } else {
        // active pipeline stage deals
        activeValue += r.amount;
        activeDealsCount++;
      }
    });

    const averageDeal = baseFilteredRecords.length > 0 ? totalValue / baseFilteredRecords.length : 0;
    const winRatio = totalClosedValue > 0 ? (totalAchieved / totalClosedValue) * 100 : 0;

    return {
      totalValue,
      totalAchieved,
      activeValue,
      activeDealsCount,
      averageDeal,
      winRatio
    };
  }, [baseFilteredRecords]);

  // Now apply the stage and status filters to get filteredRecords
  const filteredRecords = useMemo(() => {
    return baseFilteredRecords.filter(r => {
      // Apply stage filter
      if (selectedStage) {
        const matchingStage = visualFunnelStages.find(s => s.name === selectedStage);
        if (matchingStage && !matchingStage.statuses.includes(r.status)) {
          return false;
        }
      }

      // Apply status filter
      if (selectedStatus !== "All" && r.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [baseFilteredRecords, selectedStage, selectedStatus, visualFunnelStages]);

  // Totals calculations specifically for the currently filtered/viewed ledger deals
  const stats = useMemo(() => {
    let totalValue = 0;
    let totalAchieved = 0;
    let activeValue = 0;
    let activeDealsCount = 0;
    let totalClosedValue = 0; // Achieved, Cancelled, Lost

    filteredRecords.forEach(r => {
      totalValue += r.amount;

      if (r.status === "Achieved") {
        totalAchieved += r.amount;
        totalClosedValue += r.amount;
      } else if (r.status === "Lost" || r.status === "Cancelled") {
        totalClosedValue += r.amount;
      } else {
        // active pipeline stage deals
        activeValue += r.amount;
        activeDealsCount++;
      }
    });

    const averageDeal = filteredRecords.length > 0 ? totalValue / filteredRecords.length : 0;
    const winRatio = totalClosedValue > 0 ? (totalAchieved / totalClosedValue) * 100 : 0;

    return {
      totalValue,
      totalAchieved,
      activeValue,
      activeDealsCount,
      averageDeal,
      winRatio
    };
  }, [filteredRecords]);

  // Status badge utility
  const getStatusBadgeClass = (st: string) => {
    const base = "px-2.5 py-1 text-[11px] font-bold rounded-full border tracking-wide inline-flex items-center gap-1 shrink-0 font-mono";
    switch (st) {
      case "Achieved":
      case "Strategic Account":
        return `${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`;
      case "Commit":
        return `${base} bg-teal-500/10 text-teal-300 border-teal-500/20`;
      case "Opportunity (50%-60 %)":
      case "Ongoing":
        return `${base} bg-indigo-500/10 text-indigo-300 border-indigo-500/20`;
      case "Submitted":
      case "New":
        return `${base} bg-blue-500/10 text-blue-300 border-blue-500/20`;
      case "Re-Tender[Revised Price":
        return `${base} bg-yellow-500/10 text-yellow-300 border-yellow-500/20`;
      case "Challenge":
        return `${base} bg-amber-500/10 text-amber-300 border-amber-500/20`;
      case "Cancelled":
      case "Lost":
        return `${base} bg-red-500/10 text-red-400 border-red-500/10`;
      default:
        return `${base} bg-slate-500/10 text-slate-300 border-slate-500/10`;
    }
  };

  // Pagination bounds
  const totalPages = Math.ceil(filteredRecords.length / rowsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, currentPage, rowsPerPage]);

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-1 sm:p-6 space-y-4 sm:space-y-6">
      
      {/* 1. VIEW HEADER ELEMENT */}
      <div className="relative p-6 sm:p-10 rounded-2xl border border-indigo-500/10 bg-gradient-to-br from-indigo-950/20 via-slate-900/40 to-slate-950/60 overflow-hidden shadow-2xl mb-4">
        {/* Abstract background glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full" />
        
        <div className="relative flex flex-col items-center text-center gap-4">
          <div className="flex flex-col items-center">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-4 drop-shadow-2xl">
              <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                <FunnelIcon size={32} className="text-amber-400 animate-pulse" />
              </div>
              Sales Funnel
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-mono mt-4 max-w-2xl font-medium leading-relaxed">
              Realtime monitoring of opportunities, active sales threads, hit ratios, and strategic brand pipelines
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 w-full max-w-lg">
            <button
              onClick={openAddModal}
              className="flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-black rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xl hover:shadow-indigo-500/20 cursor-pointer uppercase tracking-widest whitespace-nowrap"
            >
              <Plus size={18} /> Add Deal Record
            </button>
            
            <button
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
              className="flex items-center justify-center gap-2 px-6 py-3.5 text-xs font-black rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition-all disabled:opacity-50 uppercase tracking-widest backdrop-blur-sm whitespace-nowrap"
            >
              <FileSpreadsheet size={18} className="text-emerald-400" /> Export Excel
            </button>
          </div>
        </div>
      </div>



      {/* 2. OPTIMIZED UNIFIED DISCOVERY BAR */}
      <div className={`p-5 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30 shadow-2xl transition-all duration-300`}>
        <div className="space-y-4">
          {/* Main Search Engine */}
          <div className="w-full relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search Partners, Brands, or KAMs..."
              className="w-full bg-black/40 border border-slate-800 focus:border-indigo-500/50 rounded-xl pl-12 pr-4 py-3 text-[13px] text-white placeholder:text-slate-600 focus:outline-none transition-all font-mono"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-center">
             {/* KAM Selector */}
             <div className="flex items-center gap-3 bg-black/40 border border-slate-800/80 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/30 transition-all w-full">
                <Users size={16} className="text-slate-500 shrink-0" />
                <select
                  value={selectedSalesman}
                  onChange={(e) => {
                    setSelectedSalesman(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs font-bold font-mono text-slate-200 focus:outline-none appearance-none cursor-pointer w-full outline-none"
                >
                  <option value="All" className="bg-[#0B0F19] text-white">All Key Account Managers (KAMs)</option>
                  {uniqueSalesmen.filter(s => s !== "All").map(s => (
                    <option key={s} value={s} className="bg-[#0B0F19] text-white">{s}</option>
                  ))}
                </select>
             </div>

             {/* Brand Selector */}
             <div className="flex items-center gap-3 bg-black/40 border border-slate-800/80 rounded-xl px-4 py-2.5 focus-within:border-amber-500/30 transition-all w-full">
                <div className="w-2 h-2 rounded-full bg-amber-500/40 shrink-0" />
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs font-bold font-mono text-slate-200 focus:outline-none appearance-none cursor-pointer w-full outline-none"
                >
                  <option value="All" className="bg-[#0B0F19] text-white">All Active Brands Focus</option>
                  {uniqueBrands.filter(b => b !== "All").map(b => (
                    <option key={b} value={b} className="bg-[#0B0F19] text-white">{b}</option>
                  ))}
                </select>
             </div>

             {/* Status Selector */}
             <div className="flex items-center gap-3 bg-black/40 border border-slate-800/80 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/30 transition-all w-full">
                <div className="w-2 h-2 rounded-full bg-indigo-500/40 shrink-0" />
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setSelectedStage(null);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs font-bold font-mono text-slate-200 focus:outline-none appearance-none cursor-pointer w-full outline-none"
                >
                  <option value="All" className="bg-[#0B0F19] text-white">All Pipeline Deal Statuses</option>
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt} value={opt} className="bg-[#0B0F19] text-white">{opt}</option>
                  ))}
                </select>
             </div>

             {/* Quarter Selector */}
             <div className="flex items-center gap-3 bg-black/40 border border-slate-800/80 rounded-xl px-4 py-2.5 focus-within:border-slate-500/30 transition-all w-full relative">
                <Calendar size={16} className="text-slate-500 shrink-0" />
                <select
                  value={selectedQuarter}
                  onChange={(e) => {
                    setSelectedQuarter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs font-bold font-mono text-slate-200 focus:outline-none appearance-none cursor-pointer w-full outline-none"
                >
                  {QUARTER_OPTIONS.map(opt => (
                    <option key={opt} value={opt} className="bg-[#0B0F19] text-white">{opt}</option>
                  ))}
                </select>
                
                <button 
                  className="absolute right-3 w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all border border-slate-800 bg-black/20"
                  title="Reset All Filters"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch("");
                    setSelectedSalesman("All");
                    setSelectedStatus("All");
                    setSelectedStage(null);
                    setSelectedBrand("All");
                    setSelectedQuarter("All");
                    setCurrentPage(1);
                  }}
                >
                  <X size={14} />
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* 4. VISUAL TAPERED FUNNEL VISUALIZER BAR */}
      <div className={`p-4 sm:p-8 rounded-xl sm:rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} relative overflow-hidden group`}>
        {/* Animated background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[120px] rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[120px] rounded-full -ml-32 -mb-32" />

        <div className="flex flex-col items-center text-center bg-gradient-to-r from-indigo-950/60 via-indigo-900/40 to-indigo-950/60 p-6 sm:p-8 rounded-t-2xl border-b border-white/5 relative overflow-hidden group-hover:from-indigo-900/60 transition-all duration-500">
          {/* Subtle light streak */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
          
          <div className="flex flex-col items-center gap-3 relative z-10">
            <div className="bg-indigo-500/20 p-3 rounded-2xl border border-indigo-400/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <Zap size={24} className="text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-widest text-white uppercase font-sans drop-shadow-md">
                Conversion Pipeline Velocity
              </h2>
              <p className="text-[11px] font-mono font-bold text-indigo-300/70 mt-1 uppercase tracking-tighter">
                Live visualization of deal flow maturity and weighted probability
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-8 mt-6 w-full">
             <div className="flex flex-col items-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Total Pipeline</div>
                <div className="text-lg font-black text-white">{formatBDT(baseStats.totalValue)}</div>
             </div>
             <div className="h-10 w-px bg-slate-800 shrink-0" />
             <div className="flex flex-col items-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Active Deals</div>
                <div className="text-lg font-black text-indigo-400">{baseStats.activeDealsCount}</div>
             </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 sm:gap-4 py-2 sm:py-4 w-full relative">
          <AnimatePresence>
            {visualFunnelStages.map((stage, idx) => {
              const hasData = baseStats.totalValue > 0;
              const percentWidth = hasData ? (stage.amount / baseStats.totalValue) * 100 : 0;
              const isSelected = selectedStage === stage.name;

              return (
                <motion.div 
                  key={stage.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedStage(null);
                    } else {
                      setSelectedStage(stage.name);
                      setSelectedStatus("All");
                    }
                    setCurrentPage(1);
                  }}
                  className={`flex items-center justify-between ${stage.width} group rounded-xl transition-all duration-500 ${
                    isSelected 
                      ? "ring-1 ring-white/10 shadow-2xl scale-[1.02]" 
                      : "cursor-pointer hover:scale-[1.01]"
                  }`}
                >
                  <div className={`w-full relative py-3 px-3 sm:px-6 rounded-xl border bg-[#0B0F19]/60 backdrop-blur-md transition-all flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6 overflow-hidden ${
                    isSelected ? `${stage.borderColor} ${stage.glow}` : "border-white/5 hover:border-white/20"
                  }`}>
                    
                    {/* Premium Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${stage.color} opacity-[0.03] group-hover:opacity-[0.08] transition-opacity`} />
                    
                    {/* Animated Stage Indicator */}
                    <div className="z-10 flex flex-col gap-2 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${stage.color} flex items-center justify-center text-[11px] font-bold text-white shadow-lg shrink-0`}>
                          {idx + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-[13px] font-bold tracking-wide transition-colors ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                            {stage.name.split('. ')[1]}
                          </span>
                          {isSelected && (
                            <motion.span 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-[9px] text-indigo-400 font-mono font-bold uppercase tracking-tighter"
                            >
                              Focused Segment Only
                            </motion.span>
                          )}
                        </div>
                      </div>

                      {/* Quick Status Filters inside Stage */}
                      <div className="flex flex-wrap items-center gap-1.5 ml-11">
                        {stage.statuses.map((st) => {
                          const isCurrentStatus = selectedStatus === st;
                          return (
                            <button
                              key={st}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isCurrentStatus) {
                                  setSelectedStatus("All");
                                } else {
                                  setSelectedStatus(st);
                                  setSelectedStage(null);
                                }
                                setCurrentPage(1);
                              }}
                              className={`px-3 py-1 text-[9px] font-mono rounded-full border transition-all duration-300 ${
                                isCurrentStatus
                                  ? "bg-white text-black border-white font-bold shadow-lg shadow-white/10"
                                  : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Info Section */}
                    <div className="z-10 flex items-center gap-6 lg:ml-auto">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Volume</span>
                        <div className="flex items-center gap-2">
                           <Users size={12} className="text-slate-600" />
                           <span className="text-sm font-bold text-white">{stage.count}</span>
                        </div>
                      </div>
                      
                      <div className="h-10 w-px bg-white/5" />

                      <div className="flex flex-col items-end min-w-[100px]">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Value</span>
                        <span className={`text-sm font-bold bg-gradient-to-r ${stage.color} bg-clip-text text-transparent`}>
                          {formatBDT(stage.amount)}
                        </span>
                      </div>

                      <div className="hidden lg:flex flex-col items-end w-12">
                         <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Mix</span>
                         <span className="text-xs font-mono text-slate-400">{percentWidth.toFixed(0)}%</span>
                      </div>

                      <ChevronRight size={16} className={`text-slate-700 transition-transform ${isSelected ? 'rotate-90 text-indigo-500' : 'group-hover:translate-x-1'}`} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* 5. LIVE TRANS-DEAL RECORDS TABLE */}
      <div className={`rounded-xl border border-slate-800 bg-[#0B0F19]/80 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]`}>
        <div className="p-8 border-b border-indigo-500/20 flex items-center justify-center bg-gradient-to-br from-[#12182b] via-[#0e1322] to-[#0a0d16] relative overflow-hidden">
          {/* Header shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
          
          <div className="flex flex-col items-center justify-center text-center gap-2 px-16 sm:px-36 max-w-full relative z-10 w-full shrink-0">
            <h3 className="text-base sm:text-lg font-black text-white uppercase font-mono tracking-wider drop-shadow-xl whitespace-nowrap flex items-center gap-3">
              <span className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)] shrink-0">📂</span> 
              <span className="shrink-0">Funnel Opportunity Ledger</span>
            </h3>
            <div className="flex items-center gap-3 whitespace-nowrap">
              <div className="h-px w-6 sm:w-12 bg-indigo-500/30 shrink-0" />
              <span className="text-[11px] text-indigo-400 font-black font-mono uppercase tracking-widest shrink-0">
                (Viewing {filteredRecords.length} deals)
              </span>
              <div className="h-px w-6 sm:w-12 bg-indigo-500/30 shrink-0" />
            </div>
            <p className="text-[9px] text-slate-500 font-bold font-mono tracking-[0.2em] uppercase opacity-70 mt-2 bg-slate-950/50 px-4 py-1.5 rounded-full border border-slate-800 whitespace-nowrap shrink-0">
              Sort: Newest additions loaded first
            </p>
          </div>

          <div className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20">
            <button 
              onClick={() => setIsConfigOpen(true)}
              className="p-3 rounded-2xl border border-indigo-500/20 hover:border-indigo-500 bg-indigo-950/30 hover:bg-indigo-500/10 text-indigo-400 transition-all cursor-pointer shadow-2xl backdrop-blur-xl group"
              title="Configure Rows & Columns"
            >
              <Settings2 size={20} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs font-mono">
              <AlertTriangle className="mx-auto text-amber-500 mb-2" size={20} />
              No matching funnel deal rows detected inside storage.
              <br />
              <button 
                onClick={openAddModal} 
                className="mt-3 text-indigo-400 hover:underline text-xs"
              >
                Add some manually
              </button> or publish a sheet with "Partner, Salesman, Status..." columns.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300 font-mono">
              <thead className="bg-[#111827] text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                <tr className="bg-gradient-to-r from-indigo-950/20 via-transparent to-indigo-950/20">
                  {visibleColumns.sl && <th className="py-3 px-3 font-black text-indigo-500 border-b-2 border-indigo-500/30">SL</th>}
                  {visibleColumns.partner && <th className="py-3 px-3 font-black border-b-2 border-slate-800/50">Partner</th>}
                  {visibleColumns.brand && <th className="py-3 px-3 font-black border-b-2 border-slate-800/50">Brand</th>}
                  {visibleColumns.amount && <th className="py-3 px-3 font-black text-right text-emerald-500 border-b-2 border-emerald-500/20">Amount</th>}
                  {visibleColumns.kam && <th className="py-3 px-3 font-black border-b-2 border-slate-800/50">KAM</th>}
                  {visibleColumns.timeline && <th className="py-3 px-3 font-black border-b-2 border-slate-800/50">Timeline</th>}
                  {visibleColumns.status && <th className="py-3 px-3 font-black text-center text-amber-500 border-b-2 border-amber-500/20">Status</th>}
                  {visibleColumns.actions && <th className="py-3 px-3 font-black text-right border-b-2 border-slate-800/50">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paginatedRecords.map((rec, index) => (
                  <tr key={rec.id} className="hover:bg-slate-900/40 transition">
                    {visibleColumns.sl && (
                      <td className="py-2 px-2 text-slate-500 font-mono text-[10px]">
                        #{rec.SL !== undefined ? rec.SL : (index + 1 + (currentPage - 1) * rowsPerPage)}
                      </td>
                    )}
                    {visibleColumns.partner && (
                      <td className="py-2 px-2">
                        <div className="font-bold text-slate-100 uppercase text-[11px] whitespace-nowrap">
                          {rec.partner}
                        </div>
                      </td>
                    )}
                    {visibleColumns.brand && (
                      <td className="py-2 px-2 text-slate-300">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {rec.brand ? (
                            parseBrands(rec.brand).map((b, idx) => (
                              <span 
                                key={idx} 
                                className="px-1.5 py-0.5 text-[9px] bg-indigo-950/40 text-indigo-300 rounded border border-indigo-800/50 font-mono tracking-tight whitespace-nowrap"
                              >
                                {b}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 font-mono text-[10px]">-</span>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.amount && (
                      <td className="py-2 px-2 font-bold text-indigo-300 text-[11px] text-right">
                        {formatBDT(rec.amount)}
                      </td>
                    )}
                    {visibleColumns.kam && (
                      <td className="py-2 px-2 text-slate-200 text-[11px] whitespace-nowrap">
                        {rec.salesman}
                      </td>
                    )}
                    {visibleColumns.timeline && (
                      <td className="py-2 px-2 text-slate-400 font-mono text-[10px]">
                        <div className="text-white font-semibold">{rec.quarter}</div>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="py-2 px-2 text-center">
                        <span className={getStatusBadgeClass(rec.status)}>
                          {rec.status}
                        </span>
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(rec)}
                            className="p-1 px-1.5 rounded border border-slate-700 hover:border-indigo-500 hover:text-indigo-400 cursor-pointer"
                            title="Modify Record"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove pipeline deal with ${rec.partner}?`)) {
                                handleDelete(rec.id);
                              }
                            }}
                            className="p-1 px-1.5 rounded border border-slate-700 hover:border-red-500 hover:text-red-400 cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION PANEL FOOTER */}
        {filteredRecords.length > 0 && (
          <div className="p-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-6 bg-[#111827]/40">
            <span className="text-xs text-slate-400 font-mono text-center">
              Showing <span className="text-white font-bold">{(currentPage - 1) * rowsPerPage + 1}</span> - <span className="text-white font-bold">{Math.min(currentPage * rowsPerPage, filteredRecords.length)}</span> of <span className="text-white font-bold">{filteredRecords.length}</span> rows
            </span>
            <div className="flex items-center justify-center gap-1.5">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition disabled:opacity-40 font-mono border border-slate-700"
              >
                Prev
              </button>
              <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-none no-scrollbar px-2">
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`min-w-[28px] h-7 rounded-lg flex items-center justify-center text-[11px] font-black font-mono transition shadow-sm ${
                      p === currentPage 
                        ? "bg-indigo-600 text-white shadow-indigo-500/20" 
                        : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition disabled:opacity-40 font-mono border border-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== 6. MODALS OVERLAYS ==================== */}

      {/* ADD MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e131f] border border-slate-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#111827]">
              <h2 className="text-sm font-bold text-white uppercase font-mono flex items-center gap-1">
                ➕ Add Funnel Deal Entry
              </h2>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Partner / Client Co. *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KARNAPHULI SPORTSWEAR IND. LTD."
                    value={partner}
                    onChange={(e) => setPartner(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Sales Person (KAM) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Md. Mahbub Alam"
                    value={salesman}
                    onChange={(e) => setSalesman(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Quarter *</label>
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  >
                    <option value="2026 Q1">2026 Q1</option>
                    <option value="2026 Q2">2026 Q2</option>
                    <option value="2026 Q3">2026 Q3</option>
                    <option value="2026 Q4">2026 Q4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">End Date / Expected Close</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Brand Involved * <span className="text-indigo-400 font-normal normal-case">(separate by comma or newline)</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cisco, Fortinet (separated by commas or lines)"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Amount (BDT) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 239979"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Deal Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 hover:bg-slate-800 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded"
                >
                  Save Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditOpen && targetRecord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e131f] border border-slate-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#111827]">
              <h2 className="text-sm font-bold text-white uppercase font-mono flex items-center gap-1">
                ✏️ Edit Funnel Deal Entry
              </h2>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Partner / Client Co. *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KARNAPHULI SPORTSWEAR IND. LTD."
                    value={partner}
                    onChange={(e) => setPartner(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Sales Person (KAM) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Md. Mahbub Alam"
                    value={salesman}
                    onChange={(e) => setSalesman(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Quarter *</label>
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  >
                    <option value="2026 Q1">2026 Q1</option>
                    <option value="2026 Q2">2026 Q2</option>
                    <option value="2026 Q3">2026 Q3</option>
                    <option value="2026 Q4">2026 Q4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">End Date / Expected Close</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Brand Involved * <span className="text-indigo-400 font-normal normal-case">(separate by comma or newline)</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cisco, Fortinet (separated by commas or lines)"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Amount (BDT) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 239979"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1">Deal Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 hover:bg-slate-800 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded"
                >
                  Apply Edits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIG MODAL (ROWS & COLUMNS) */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e131f] border border-slate-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#111827]">
              <h2 className="text-sm font-bold text-white uppercase font-mono flex items-center gap-2">
                <Settings2 size={16} className="text-indigo-400" />
                Configure Ledger View
              </h2>
              <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Rows configuration */}
              <div>
                <label className="block text-[11px] text-slate-400 font-mono uppercase mb-3 flex items-center gap-2">
                  <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                  Rows Per Page
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[5, 10, 15, 25, 50].map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        setRowsPerPage(num);
                        setCurrentPage(1);
                      }}
                      className={`py-2 text-[10px] font-bold font-mono rounded border transition-all ${
                        rowsPerPage === num
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                          : "bg-[#111827] border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Columns configuration */}
              <div>
                <label className="block text-[11px] text-slate-400 font-mono uppercase mb-3 flex items-center gap-2">
                  <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                  Visible Columns
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(visibleColumns).map((col) => (
                    <label key={col} className="flex items-center gap-3 group cursor-pointer">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={(visibleColumns as any)[col]}
                          onChange={() => {
                            setVisibleColumns(prev => ({
                              ...prev,
                              [col]: !(prev as any)[col]
                            }));
                          }}
                          className="peer h-4 w-4 opacity-0 absolute cursor-pointer"
                        />
                        <div className="h-4 w-4 border border-slate-700 rounded bg-[#111827] peer-checked:bg-emerald-600 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 group-hover:text-slate-200 uppercase transition-colors">
                        {col === 'sl' ? 'Serial (SL)' : col}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#111827] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsConfigOpen(false)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded shadow-lg transition-all uppercase tracking-widest"
              >
                Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
