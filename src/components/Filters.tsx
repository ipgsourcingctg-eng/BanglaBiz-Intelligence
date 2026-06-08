/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Filter, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  MapPin, 
  User, 
  Briefcase, 
  Building2, 
  Tag, 
  Layers, 
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle
} from "lucide-react";
import { DashboardFilters, SalesRecord, DashboardTheme, CollectionRecord, FunnelRecord, CustomBuyerGroup } from "../types";
import { getSalesYears, getCustomBuyerGroups } from "../db/localDb";

interface FiltersProps {
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  allRecords: SalesRecord[];
  filteredRecords: SalesRecord[];
  activeTab: string;
  collectionRecords: CollectionRecord[];
  filteredCollectionRecords: CollectionRecord[];
  funnelRecords: FunnelRecord[];
  filteredFunnelRecords: FunnelRecord[];
  theme: DashboardTheme;
}

export default function Filters({ 
  filters, 
  setFilters, 
  allRecords, 
  filteredRecords, 
  activeTab, 
  collectionRecords, 
  filteredCollectionRecords, 
  funnelRecords, 
  filteredFunnelRecords, 
  theme 
}: FiltersProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [customGroups, setCustomGroups ] = useState<CustomBuyerGroup[]>(() => getCustomBuyerGroups());

  React.useEffect(() => {
    const handleUpdate = () => {
      setCustomGroups(getCustomBuyerGroups());
    };
    window.addEventListener("banglabiz_custom_groups_updated", handleUpdate);
    return () => {
      window.removeEventListener("banglabiz_custom_groups_updated", handleUpdate);
    };
  }, []);

  // Helper to extract unique values from a generic array and key function
  const getUnique = <T,>(arr: T[], extractor: (item: T) => string): string[] => {
    return Array.from(
      new Set(arr.map(extractor).filter((v) => v && v !== "undefined" && v !== "null" && String(v).trim() !== ""))
    ).sort();
  };

  const isCollectionsPage = activeTab === "financials";
  const isFunnelPage = activeTab === "funnel";

  // --- Dynamic Option Narrow-Down Helpers ---
  
  // Define dependency levels for standard slicers
  // Branch(0) -> SalesAccount(1) -> BuyerGroup/CustomGroups(2) -> Buyer(3) -> Brand(4) -> ProductGroup(5) -> PM(6)
  const getStandardOptionsFiltered = (targetField: keyof DashboardFilters | "customBuyerGroups" | "") => {
    let list = allRecords;

    // Level 0: Branch (Root, no parent filters)
    if (targetField === "branch") return list;

    // Level 1: Sales Account (depends on Branch)
    if (filters.branch && filters.branch.length > 0) {
      list = list.filter(r => filters.branch.includes(r.Branch));
    }
    if (targetField === "salesPerson") return list;

    // Level 2: Buyer Class & Custom Buyer Groups (depends on Branch, Sales Account)
    if (filters.salesPerson && filters.salesPerson.length > 0) {
      list = list.filter(r => filters.salesPerson.includes(r["Sales Person"]));
    }
    if (targetField === "buyerGroup" || targetField === "customBuyerGroups") return list;

    // Level 3: Buyer / Customer (depends on Branch, Sales Account, Buyer Group/Custom Groups)
    if (filters.buyerGroup && filters.buyerGroup.length > 0) {
        list = list.filter(r => filters.buyerGroup!.includes(r["Buyer Group"]));
    }
    if (filters.customBuyerGroups && filters.customBuyerGroups.length > 0) {
      const groups = getCustomBuyerGroups();
      const allowedBuyers = groups
        .filter(g => filters.customBuyerGroups!.includes(g.name))
        .flatMap(g => g.buyers);
      list = list.filter(r => allowedBuyers.includes(r.Buyer));
    }
    if (targetField === "buyer") return list;

    // Level 4: Asset Brand (depends on all above)
    if (filters.buyer && filters.buyer.length > 0) {
        list = list.filter(r => filters.buyer!.includes(r.Buyer));
    }
    if (targetField === "brand") return list;

    // Level 5: Product Category (depends on all above)
    if (filters.brand && filters.brand.length > 0) {
        list = list.filter(r => filters.brand!.includes(r.Brand));
    }
    if (targetField === "productGroup") return list;

    // Level 6: Product Manager (depends on all above)
    if (filters.productGroup && filters.productGroup.length > 0) {
        list = list.filter(r => filters.productGroup!.includes(r.Group));
    }
    if (targetField === "productManager") return list;

    return list;
  };

  // 1. Collections Helpers
  const getCollectionSale = (c: CollectionRecord) => {
    return allRecords.find(sale => sale.Invoice === c.invoiceNo || sale.Buyer === c.buyerName);
  };

  const getCollectionsOptionsFiltered = (targetField: keyof DashboardFilters | "") => {
    let list = collectionRecords;

    // Collections Hierarchy: Branch -> Sales Person -> Custom Groups -> Buyer -> Status/Method
    if (targetField === "branch") return list;

    if (filters.branch && filters.branch.length > 0) {
      list = list.filter(c => {
        const s = getCollectionSale(c);
        const br = s ? s.Branch : "Unknown Branch";
        return filters.branch.includes(br);
      });
    }
    if (targetField === "salesPerson") return list;

    if (filters.salesPerson && filters.salesPerson.length > 0) {
      list = list.filter(c => {
        const s = getCollectionSale(c);
        const name = s ? s["Sales Person"] : "Unknown KAM";
        return filters.salesPerson.includes(name);
      });
    }
    if (targetField === "customBuyerGroups") return list;

    if (filters.customBuyerGroups && filters.customBuyerGroups.length > 0) {
      const groups = getCustomBuyerGroups();
      const allowedBuyers = groups
        .filter(g => filters.customBuyerGroups!.includes(g.name))
        .flatMap(g => g.buyers);
      list = list.filter(c => allowedBuyers.includes(c.buyerName));
    }
    if (targetField === "buyer") return list;

    if (filters.buyer && filters.buyer.length > 0) {
      list = list.filter(c => filters.buyer!.includes(c.buyerName));
    }
    if (targetField === "paymentMethod" || targetField === "collectionStatus") return list;

    return list;
  };

  // 2. Funnel Helpers
  const getFunnelSalesmanBranch = (salesmanName: string) => {
    const s = allRecords.find(r => r["Sales Person"] === salesmanName);
    return s ? s.Branch : "Unknown";
  };

  const getFunnelOptionsFiltered = (targetField: keyof DashboardFilters | "") => {
    let list = funnelRecords;

    // Funnel Hierarchy: Sales Account -> Custom Groups -> Buyer -> Brand -> Status/Quarter
    if (targetField === "salesPerson") return list;

    if (filters.salesPerson && filters.salesPerson.length > 0) {
      list = list.filter(f => f.salesman && filters.salesPerson.includes(f.salesman));
    }
    if (targetField === "customBuyerGroups") return list;

    if (filters.customBuyerGroups && filters.customBuyerGroups.length > 0) {
      const groups = getCustomBuyerGroups();
      const allowedBuyers = groups
        .filter(g => filters.customBuyerGroups!.includes(g.name))
        .flatMap(g => g.buyers);
      list = list.filter(f => allowedBuyers.includes(f.partner));
    }
    if (targetField === "buyer") return list;

    if (filters.buyer && filters.buyer.length > 0) {
      list = list.filter(f => filters.buyer!.includes(f.partner));
    }
    if (targetField === "brand") return list;

    if (filters.brand && filters.brand.length > 0) {
      list = list.filter(f => filters.brand!.includes(f.brand));
    }
    if (targetField === "funnelQuarter" || targetField === "funnelStatus") return list;

    return list;
  };

  // ------------------------------------------

  const totalMatchingCount = isCollectionsPage 
    ? filteredCollectionRecords.length 
    : isFunnelPage 
      ? filteredFunnelRecords.length 
      : filteredRecords.length;

  const totalAllCount = isCollectionsPage 
    ? collectionRecords.length 
    : isFunnelPage 
      ? funnelRecords.length 
      : allRecords.length;

  const recordsLabel = isCollectionsPage 
    ? "collection rows" 
    : isFunnelPage 
      ? "funnel deals" 
      : "records";

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const salesYears = getSalesYears();

  const getQuarterCalculatedRange = (quarterNum: number, y: number): [string, string] => {
    if (quarterNum === 1) {
      return [`${y}-01-01`, `${y}-03-31`];
    } else if (quarterNum === 2) {
      return [`${y}-04-01`, `${y}-06-30`];
    } else if (quarterNum === 3) {
      return [`${y}-07-01`, `${y}-09-30`];
    } else {
      return [`${y}-10-01`, `${y}-12-31`];
    }
  };

  const allQuarters = React.useMemo(() => {
    const list: { label: string; value: string; startDate: string; endDate: string }[] = [];
    const sortedYears = [...salesYears].sort((a, b) => b - a); // Newer years first
    for (const y of sortedYears) {
      const yy = String(y).substring(2); // e.g. "26"
      for (let q = 1; q <= 4; q++) {
        const [start, end] = getQuarterCalculatedRange(q, y);
        list.push({
          label: `Q${q}FY${yy}`,
          value: `Q${q}FY${yy}`,
          startDate: start,
          endDate: end
        });
      }
    }
    return list;
  }, [salesYears]);

  const currentSelectedYear = filters.dateRange[0] === '1990-01-01' ? 'all' : new Date(filters.dateRange[0]).getFullYear();

  const currentQuarterValue = React.useMemo(() => {
    const [currStart, currEnd] = filters.dateRange;
    if (
      (currentSelectedYear === 'all' && currStart === '1990-01-01' && currEnd === '2100-12-31') ||
      (currentSelectedYear !== 'all' && currStart === `${currentSelectedYear}-01-01` && currEnd === `${currentSelectedYear}-12-31`)
    ) {
      return "all";
    }
    const matched = allQuarters.find(q => q.startDate === currStart && q.endDate === currEnd);
    return matched ? matched.value : "custom";
  }, [filters.dateRange, allQuarters, currentSelectedYear]);

  const displayedQuarters = React.useMemo(() => {
    if (currentSelectedYear === 'all') {
      return allQuarters;
    }
    const yearStr = String(currentSelectedYear).substring(2); // e.g. "26" for 2026
    return allQuarters.filter(q => q.label.endsWith(`FY${yearStr}`));
  }, [allQuarters, currentSelectedYear]);

  const handleYearChange = (newYear: number | 'all') => {
    if (newYear === 'all') {
      setFilters(prev => ({
        ...prev,
        dateRange: ['1990-01-01', '2100-12-31']
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        dateRange: [`${newYear}-01-01`, `${newYear}-12-31`]
      }));
    }
  };

  const navigateYear = (direction: 'next' | 'prev') => {
    if (currentSelectedYear === 'all') return;
    const sortedYears = [...salesYears].sort((a,b) => a - b);
    const currentIndex = sortedYears.indexOf(Number(currentSelectedYear));
    
    if (direction === 'prev' && currentIndex > 0) {
      handleYearChange(sortedYears[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < sortedYears.length - 1) {
      handleYearChange(sortedYears[currentIndex + 1]);
    }
  };

  const handleSelectAll = (field: keyof DashboardFilters, items: string[]) => {
    setFilters(prev => ({
      ...prev,
      [field]: [...items]
    }));
  };

  const handleClearSection = (field: keyof DashboardFilters) => {
    setFilters(prev => ({
      ...prev,
      [field]: []
    }));
  };

  const handleCheckboxChange = (field: keyof DashboardFilters, value: string) => {
    setFilters(prev => {
      const current = (prev[field] as string[]) || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  const resetAllFilters = () => {
    const runningYear = new Date().getFullYear().toString();
    setFilters({
      dateRange: [`${runningYear}-01-01`, `${runningYear}-12-31`],
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
      customBuyerGroups: []
    });
    setSearchTerms({});
  };

  // Helper to render searchable popovers or inline lists for choices
  const renderFilterPanel = (
    label: string, 
    field: keyof DashboardFilters, 
    items: string[], 
    icon: React.ReactNode, 
    sectionId: string
  ) => {
    const isExpanded = openSection === sectionId;
    const selectedItems = (filters[field] as string[]) || [];
    const searchTerm = searchTerms[sectionId] || "";

    const filteredItems = items.filter(it => 
      it.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="relative">
        {/* Dropdown toggle button */}
        <button
          id={`filter-trigger-btn-${sectionId}`}
          onClick={() => toggleSection(sectionId)}
          className={`w-full sm:w-auto px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-lg border text-[12px] sm:text-[11px] font-semibold flex items-center justify-between sm:justify-start gap-2 cursor-pointer transition select-none ${
            selectedItems.length > 0 
              ? theme.isDark 
                ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-400 font-bold font-sans" 
                : "bg-indigo-50 border-indigo-300 text-indigo-700 font-bold font-sans shadow-sm"
              : theme.isDark 
                ? "bg-[#18181b] border-[#27272a] text-slate-350 hover:text-slate-100 hover:border-slate-700 font-sans"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm font-sans"
          }`}
        >
          <div className="flex items-center gap-2">
            {icon}
            <span>{label}</span>
          </div>
          {selectedItems.length > 0 ? (
            <span className={theme.isDark ? "bg-[#312e81] text-[#fafafa] font-mono text-[10px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none" : "bg-indigo-600 text-white font-mono text-[10px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"}>
              {selectedItems.length}
            </span>
          ) : (
            <ChevronDown size={14} className={`sm:w-3 sm:h-3 ${theme.isDark ? "text-slate-500" : "text-slate-450"}`} />
          )}
        </button>

        {isExpanded && (
          <div className={`absolute top-[calc(100%+6px)] left-0 mt-0 w-full sm:w-64 min-w-[240px] max-h-72 p-3 ${theme.bgCard} border ${theme.border} rounded-xl ${theme.isDark ? "shadow-[0_12px_36px_rgba(0,0,0,0.8)]" : "shadow-[0_12px_36px_rgba(0,0,0,0.15)]"} z-50 flex flex-col select-none animate-fade-in`}>
            {/* Embedded Search filter inside dropdown */}
            {items.length > 5 && (
              <div className="relative mb-2 shrink-0">
                <Search size={11} className="absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  id={`filter-search-input-${sectionId}`}
                  type="text"
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerms(prev => ({ ...prev, [sectionId]: e.target.value }))}
                  className={`w-full text-[10px] pl-7 pr-2 py-1.5 rounded border focus:outline-none font-mono ${
                    theme.isDark 
                      ? "bg-slate-950 border-slate-800 text-slate-300 placeholder-slate-500 focus:border-indigo-500" 
                      : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500"
                  }`}
                />
              </div>
            )}

            {/* Selection Slicer Quick Helpers */}
            {items.length > 0 && (
              <div className={`flex items-center justify-between px-1 pb-1.5 mb-1.5 text-[10px] border-b shrink-0 ${theme.isDark ? "border-slate-800/40" : "border-slate-100"}`}>
                <button
                  type="button"
                  id={`filter-select-all-${sectionId}`}
                  onClick={() => handleSelectAll(field, items)}
                  className={`${theme.isDark ? "text-indigo-450 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-805"} font-semibold transition cursor-pointer text-[9px] uppercase tracking-wider`}
                >
                  ☑ Select All
                </button>
                <button
                  type="button"
                  id={`filter-clear-all-${sectionId}`}
                  onClick={() => handleClearSection(field)}
                  className="text-amber-500 hover:text-amber-400 font-semibold transition cursor-pointer text-[9px] uppercase tracking-wider"
                >
                  ☒ Clear All
                </button>
              </div>
            )}

            {/* Scrollable list item container */}
            <div className="overflow-y-auto space-y-1 pr-1 max-h-48 flex-1">
              {filteredItems.length === 0 ? (
                <div className={`text-[10px] font-mono pl-1 py-1 ${theme.isDark ? "text-slate-500" : "text-slate-400"}`}>No matches found</div>
              ) : (
                filteredItems.map(item => {
                  const isChecked = selectedItems.includes(item);
                  return (
                    <label 
                      key={item} 
                      className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-[11px] transition ${
                        theme.isDark
                          ? "hover:bg-slate-800 hover:text-slate-100" 
                          : "hover:bg-slate-100 hover:text-slate-900"
                      } ${
                        isChecked 
                          ? theme.isDark 
                            ? "text-indigo-450 font-semibold bg-indigo-500/10" 
                            : "text-indigo-700 font-semibold bg-indigo-50" 
                          : theme.isDark 
                            ? "text-slate-400" 
                            : "text-slate-600"
                      }`}
                    >
                      <input
                        id={`filter-checkbox-${sectionId}-${item.toLowerCase().replace(/[^a-z0-str]/g, "-")}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckboxChange(field, item)}
                        className={`rounded focus:ring-0 focus:ring-offset-0 shrink-0 w-3 h-3 ${
                          theme.isDark 
                            ? "border-slate-800 text-indigo-500 bg-slate-950" 
                            : "border-slate-300 text-indigo-600 bg-white"
                        }`}
                      />
                      <span className="truncate" title={item}>{item}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} w-full flex flex-col gap-3 select-none relative z-20`}>
      {/* Click-away backdrop to close open dropdowns */}
      {openSection && (
        <div 
          className="fixed inset-0 z-30 bg-transparent" 
          onClick={() => setOpenSection(null)} 
        />
      )}

      {/* Header element with matching count and Reset controls */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 shrink-0 gap-3 sm:gap-0 ${theme.isDark ? "border-zinc-800/60" : "border-slate-200"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter size={15} className={theme.isDark ? "text-indigo-400" : "text-indigo-600"} />
            <h4 className={`font-bold text-[13px] uppercase tracking-wider font-sans ${theme.isDark ? "text-zinc-100" : "text-slate-800"}`}>
              Global Analysis Slicers
            </h4>
          </div>
          <span className={`text-[11px] font-mono font-medium opacity-80 ${theme.isDark ? "text-indigo-400" : "text-indigo-600"}`}>
            ({totalMatchingCount} of {totalAllCount} {recordsLabel} matching)
          </span>
        </div>
        
        <button
          id="reset-all-filters-btn"
          onClick={resetAllFilters}
          className={`flex items-center justify-center gap-2 text-[11px] font-bold transition cursor-pointer uppercase tracking-wider px-4 py-2 sm:px-3 sm:py-1.5 rounded-md border w-full sm:w-auto shadow-sm ${
            theme.isDark 
              ? "text-amber-500 bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/15" 
              : "text-amber-700 bg-amber-50 border-amber-300 hover:bg-amber-100"
          }`}
          title="Clear all active constraints"
        >
          <RotateCcw size={12} className="shrink-0" />
          <span>Clear Slicers</span>
        </button>
      </div>

      {/* Slicer grid / horizontal row */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 relative z-40">
        
        {/* Date picking section inline */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <div className={`flex items-center justify-between sm:justify-start gap-1.5 px-3 py-2 sm:px-2 sm:py-1.5 rounded-lg border text-[12px] sm:text-[11px] font-mono shadow-sm ${theme.isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-slate-300 text-slate-850"}`}>
            <button 
              onClick={() => navigateYear('prev')}
              className={`p-1.5 sm:p-1 rounded transition text-slate-500 hover:text-slate-800 ${theme.isDark ? "hover:bg-slate-800 hover:text-white" : "hover:bg-slate-100"}`}
              title="Previous Year"
            >
              <ChevronLeft size={16} className="sm:w-3.5 sm:h-3.5" />
            </button>
            
            <select 
              value={currentSelectedYear}
              onChange={(e) => handleYearChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className={`bg-transparent border-none text-[12px] sm:text-[11px] focus:ring-0 cursor-pointer font-bold outline-none font-mono ${theme.isDark ? "text-slate-200" : "text-slate-800"}`}
            >
              <option value="all" className={theme.isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>All Years</option>
              {salesYears.map(y => (
                <option key={y} value={y} className={theme.isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>{y} Sales Year</option>
              ))}
            </select>

            <button 
              onClick={() => navigateYear('next')}
              className={`p-1.5 sm:p-1 rounded transition text-slate-500 hover:text-slate-800 ${theme.isDark ? "hover:bg-slate-800 hover:text-white" : "hover:bg-slate-100"}`}
              title="Next Year"
            >
              <ChevronRight size={16} className="sm:w-3.5 sm:h-3.5" />
            </button>
          </div>

          <div className={`flex items-center justify-between sm:justify-start gap-1.5 px-3 py-2 sm:px-3 sm:py-1.5 rounded-lg border text-[12px] sm:text-[11px] font-mono shadow-sm ${theme.isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-slate-300 text-slate-850"}`}>
            <div className="flex items-center gap-1.5">
              <Calendar size={15} className="text-violet-500 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className={`font-semibold uppercase tracking-wider ${theme.isDark ? "text-zinc-500" : "text-slate-500"}`}>Quarter:</span>
            </div>
            <select
              id="quarter-slicer-select"
              value={currentQuarterValue}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") return;
                if (val === "all") {
                  if (currentSelectedYear === 'all') {
                    setFilters(prev => ({ ...prev, dateRange: ['1990-01-01', '2100-12-31'] }));
                  } else {
                    setFilters(prev => ({ ...prev, dateRange: [`${currentSelectedYear}-01-01`, `${currentSelectedYear}-12-31`] }));
                  }
                  return;
                }
                const matched = allQuarters.find(q => q.value === val);
                if (matched) {
                  setFilters(prev => ({ ...prev, dateRange: [matched.startDate, matched.endDate] }));
                }
              }}
              className={`bg-transparent border-none text-[12px] sm:text-[11px] focus:ring-0 cursor-pointer font-bold outline-none font-mono ${theme.isDark ? "text-slate-200" : "text-slate-800"}`}
            >
              <option value="all" className={theme.isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>All</option>
              {currentQuarterValue === "custom" && (
                <option value="custom" disabled className="hidden">Custom / Range</option>
              )}
              {displayedQuarters.map(q => (
                <option key={q.value} value={q.value} className={theme.isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>{q.label}</option>
              ))}
            </select>
          </div>

          <div className={`flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2 px-3 py-2 sm:px-3 sm:py-1.5 rounded-lg border text-[12px] sm:text-[11px] font-mono shadow-sm w-full sm:w-auto ${theme.isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-slate-300 text-slate-850"}`}>
            <div className="flex items-center gap-1.5">
              <Calendar size={15} className="text-amber-500 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className={`font-semibold uppercase tracking-wider ${theme.isDark ? "text-zinc-500" : "text-slate-500"}`}>Range:</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
              <input
                id="start-date-picker"
                type="date"
                value={filters.dateRange[0]}
                onChange={(e) => setFilters(p => ({ ...p, dateRange: [e.target.value, p.dateRange[1]] }))}
                className={`bg-transparent border-0 focus:outline-none max-w-[110px] sm:max-w-[105px] cursor-pointer font-mono font-medium min-w-0 ${theme.isDark ? "text-zinc-300" : "text-slate-800"}`}
              />
              <span className="text-zinc-400 font-bold shrink-0">→</span>
              <input
                id="end-date-picker"
                type="date"
                value={filters.dateRange[1]}
                onChange={(e) => setFilters(p => ({ ...p, dateRange: [p.dateRange[0], e.target.value] }))}
                className={`bg-transparent border-0 focus:outline-none max-w-[110px] sm:max-w-[105px] cursor-pointer font-mono font-medium min-w-0 ${theme.isDark ? "text-zinc-300" : "text-slate-800"}`}
              />
            </div>
          </div>
        </div>

        {/* Floating popups for dimensions */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-2">
          {isCollectionsPage ? (
            <>
              {renderFilterPanel("Associated Branch", "branch", getUnique(getCollectionsOptionsFiltered("branch"), c => {
                const s = getCollectionSale(c);
                return s ? s.Branch : "Unknown Branch";
              }), <MapPin size={13} className="text-sky-400" />, "branch")}
              {renderFilterPanel("Associated Salesperson", "salesPerson", getUnique(getCollectionsOptionsFiltered("salesPerson"), c => {
                const s = getCollectionSale(c);
                return s ? s["Sales Person"] : "Unknown KAM";
              }), <User size={13} className="text-indigo-400" />, "salesPerson")}
              {customGroups.length > 0 && renderFilterPanel("Group of Companies", "customBuyerGroups", (() => {
                const records = getCollectionsOptionsFiltered("customBuyerGroups");
                const activeBuyers = new Set(records.map(c => c.buyerName));
                return customGroups
                  .filter(g => g.buyers.some(buyer => activeBuyers.has(buyer)))
                  .map(g => g.name);
              })(), <Building2 size={13} className="text-violet-400 font-bold" />, "customBuyerGroupsColl")}
              {renderFilterPanel("Buyer / Customer", "buyer", getUnique(getCollectionsOptionsFiltered("buyer"), c => c.buyerName), <Building2 size={13} className="text-pink-400" />, "buyer")}
              {renderFilterPanel("Payment Method", "paymentMethod", getUnique(getCollectionsOptionsFiltered("paymentMethod"), c => c.paymentMethod), <Layers size={13} className="text-[#6366f1]" />, "paymentMethod")}
              {renderFilterPanel("Payment Status", "collectionStatus", getUnique(getCollectionsOptionsFiltered("collectionStatus"), c => c.status || "Success"), <CheckCircle size={13} className="text-emerald-400" />, "collectionStatus")}
            </>
          ) : isFunnelPage ? (
            <>
              {renderFilterPanel("Salesperson", "salesPerson", getUnique(getFunnelOptionsFiltered("salesPerson"), f => f.salesman), <User size={13} className="text-indigo-400" />, "salesPerson")}
              {customGroups.length > 0 && renderFilterPanel("Group of Companies", "customBuyerGroups", (() => {
                const records = getFunnelOptionsFiltered("customBuyerGroups");
                const activeBuyers = new Set(records.map(f => f.partner));
                return customGroups
                  .filter(g => g.buyers.some(buyer => activeBuyers.has(buyer)))
                  .map(g => g.name);
              })(), <Building2 size={13} className="text-violet-400 font-bold" />, "customBuyerGroupsFunnel")}
              {renderFilterPanel("Buyer / Customer", "buyer", getUnique(getFunnelOptionsFiltered("buyer"), f => f.partner), <Building2 size={13} className="text-pink-400" />, "buyer")}
              {renderFilterPanel("Asset Brand", "brand", getUnique(getFunnelOptionsFiltered("brand"), f => f.brand), <Tag size={13} className="text-amber-405" />, "brand")}
              {renderFilterPanel("Quarter", "funnelQuarter", getUnique(getFunnelOptionsFiltered("funnelQuarter"), f => f.quarter), <Calendar size={13} className="text-violet-400" />, "funnelQuarter")}
              {renderFilterPanel("Funnel Stage / Status", "funnelStatus", getUnique(getFunnelOptionsFiltered("funnelStatus"), f => f.status), <Layers size={13} className="text-teal-400" />, "funnelStatus")}
            </>
          ) : (
            <>
              {renderFilterPanel("Branch Outlet", "branch", getUnique(getStandardOptionsFiltered("branch"), r => r.Branch), <MapPin size={13} className="text-sky-455" />, "branch")}
              {renderFilterPanel("Sales Account", "salesPerson", getUnique(getStandardOptionsFiltered("salesPerson"), r => r["Sales Person"]), <User size={13} className="text-indigo-400" />, "salesPerson")}
              {renderFilterPanel("Buyer Class", "buyerGroup", getUnique(getStandardOptionsFiltered("buyerGroup"), r => r["Buyer Group"]), <Briefcase size={13} className="text-purple-400" />, "buyerGroup")}
              {customGroups.length > 0 && renderFilterPanel("Group of Companies", "customBuyerGroups", (() => {
                const records = getStandardOptionsFiltered("customBuyerGroups");
                const activeBuyers = new Set(records.map(r => r.Buyer));
                return customGroups
                  .filter(g => g.buyers.some(buyer => activeBuyers.has(buyer)))
                  .map(g => g.name);
              })(), <Building2 size={13} className="text-violet-400 font-bold" />, "customBuyerGroupsStd")}
              {renderFilterPanel("Buyer / Customer", "buyer", getUnique(getStandardOptionsFiltered("buyer"), r => r.Buyer), <Building2 size={13} className="text-pink-400" />, "buyer")}
              {renderFilterPanel("Asset Brand", "brand", getUnique(getStandardOptionsFiltered("brand"), r => r.Brand), <Tag size={13} className="text-amber-400" />, "brand")}
              {renderFilterPanel("Product Category", "productGroup", getUnique(getStandardOptionsFiltered("productGroup"), r => r.Group), <Layers size={13} className="text-emerald-400" />, "productGroup")}
              {renderFilterPanel("Product Manager", "productManager", getUnique(getStandardOptionsFiltered("productManager"), r => r["Product Manager"]), <User size={13} className="text-teal-400" />, "pm")}
            </>
          )}
        </div>

      </div>

    </div>
  );
}
