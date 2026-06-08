/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  User,
  Search,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Tag,
  Layers,
  Building2,
  Briefcase
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
  ComposedChart
} from "recharts";
import { SalesRecord, DashboardTheme, YearlyEntityTarget, CollectionRecord, DashboardFilters } from "../types";
import { formatBDT } from "../utils/format";
import { getMonthsList, getSalesYears } from "../db/localDb";
import { getRepresentativeTargets } from "./DashboardPages";

interface KamAnalyticsPageProps {
  filteredRecords: SalesRecord[];
  allRecords: SalesRecord[];
  theme: DashboardTheme;
  filteredCollectionRecords?: CollectionRecord[];
  collectionRecords?: CollectionRecord[];
  filters?: DashboardFilters;
}

export default function KamAnalyticsPage({ 
  filteredRecords, 
  allRecords, 
  theme,
  filteredCollectionRecords,
  collectionRecords,
  filters
}: KamAnalyticsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKam, setSelectedKam] = useState<string | null>(null);

  const [kamFilters, setKamFilters] = useState({
    month: String(new Date().getMonth() + 1).padStart(2, '0'),
    year: String(new Date().getFullYear()),
    brand: "",
    product: "",
    category: "",
    pm: "",
    customer: ""
  });
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [benchmarkView, setBenchmarkView] = useState<'annual' | 'month' | 'ytd'>('ytd');

  const baseRecords = useMemo(() => {
    // Start with allRecords and only apply non-date global filters if any, or just start with allRecords
    let list = allRecords;
    if (filters?.branch?.length) list = list.filter(r => filters.branch.includes(r.Branch));
    return list;
  }, [allRecords, filters]);

  const localFilteredRecords = useMemo(() => {
    return baseRecords.filter(r => {
      const dateVal = r["Invoice Date"] || r["Sales Date"] || "";
      const saleDate = new Date(dateVal);
      
      if (kamFilters.month) {
        const m = String(saleDate.getMonth() + 1).padStart(2, '0');
        if (benchmarkView === 'ytd') {
          if (parseInt(m, 10) > parseInt(kamFilters.month, 10)) return false;
        } else {
          if (m !== kamFilters.month) return false;
        }
      }
      if (kamFilters.year) {
        const y = String(new Date(dateVal).getFullYear());
        if (y !== kamFilters.year) return false;
      }
      if (kamFilters.brand && r.Brand !== kamFilters.brand) return false;
      if (kamFilters.product && r.Product !== kamFilters.product) return false;
      if (kamFilters.category && r.Group !== kamFilters.category) return false;
      if (kamFilters.pm && r["Product Manager"] !== kamFilters.pm) return false;
      if (kamFilters.customer && r.Buyer !== kamFilters.customer) return false;
      return true;
    });
  }, [baseRecords, kamFilters, benchmarkView]);

  const localFilteredCollections = useMemo(() => {
    return (collectionRecords || []).filter(c => {
      const payDate = new Date(c.paymentDate);
      
      if (kamFilters.month) {
        const m = String(payDate.getMonth() + 1).padStart(2, '0');
        if (benchmarkView === 'ytd') {
          if (parseInt(m, 10) > parseInt(kamFilters.month, 10)) return false;
        } else {
          if (m !== kamFilters.month) return false;
        }
      }
      if (kamFilters.year) {
        const y = String(payDate.getFullYear());
        if (y !== kamFilters.year) return false;
      }
      
      // We don't have brand/product/category filters for collections directly, 
      // but they are loosely associated via the invoice lookup in getRepresentativeTargets
      return true;
    });
  }, [collectionRecords, kamFilters, benchmarkView]);

  const getFilteredOptions = (targetField: string) => {
    let list = baseRecords;

    // Hierarchy: Year -> Month -> Category -> Brand -> Product -> PM -> Customer
    if (kamFilters.year) {
      list = list.filter(r => String(new Date(r["Invoice Date"] || r["Sales Date"]).getFullYear()) === kamFilters.year);
    }
    
    if (targetField === "month") return list;
    if (kamFilters.month) {
       list = list.filter(r => String(new Date(r["Invoice Date"] || r["Sales Date"]).getMonth() + 1).padStart(2, '0') === kamFilters.month);
    }

    if (targetField === "category") return list;
    if (kamFilters.category) {
      list = list.filter(r => r.Group === kamFilters.category);
    }

    if (targetField === "brand") return list;
    if (kamFilters.brand) {
      list = list.filter(r => r.Brand === kamFilters.brand);
    }

    if (targetField === "product") return list;
    if (kamFilters.product) {
       list = list.filter(r => r.Product === kamFilters.product);
    }

    if (targetField === "pm") return list;
    if (kamFilters.pm) {
      list = list.filter(r => r["Product Manager"] === kamFilters.pm);
    }

    if (targetField === "customer") return list;
    return list;
  };

  const filterLists = useMemo(() => {
    return {
      brands: Array.from(new Set(getFilteredOptions("brand").map(r => r.Brand))).filter(Boolean).sort(),
      products: Array.from(new Set(getFilteredOptions("product").map(r => r.Product))).filter(Boolean).sort(),
      categories: Array.from(new Set(getFilteredOptions("category").map(r => r.Group))).filter(Boolean).sort(),
      pms: Array.from(new Set(getFilteredOptions("pm").map(r => r["Product Manager"]))).filter(Boolean).sort(),
      customers: Array.from(new Set(getFilteredOptions("customer").map(r => r.Buyer))).filter(Boolean).sort(),
      years: Array.from(new Set(baseRecords.map(r => String(new Date(r["Invoice Date"] || r["Sales Date"]).getFullYear())))).filter(Boolean).sort()
    };
  }, [baseRecords, kamFilters, benchmarkView]);

  const kamPerformance = useMemo(() => {
    const syntheticFilters: DashboardFilters = {
      ...filters,
      dateRange: [
        `${kamFilters.year}-01-01`,
        `${kamFilters.year}-12-31`
      ]
    } as any;
    return getRepresentativeTargets(localFilteredRecords, localFilteredCollections, syntheticFilters);
  }, [localFilteredRecords, localFilteredCollections, filters, kamFilters.year]);

  const benchmarkKams = useMemo(() => {
    // Filter records purely based on benchmarkView and kamFilters
    const monthToMatch = kamFilters.month || String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Construct synthetic filters for date-aware target scaling
    const syntheticFilters: DashboardFilters = {
      ...filters,
      dateRange: benchmarkView === 'month' 
        ? [`${kamFilters.year}-${monthToMatch}-01`, `${kamFilters.year}-${monthToMatch}-28`] // Simplified month end
        : benchmarkView === 'ytd'
          ? [`${kamFilters.year}-01-01`, `${kamFilters.year}-${monthToMatch}-28`]
          : [`${kamFilters.year}-01-01`, `${kamFilters.year}-12-31`]
    } as any;

    if (benchmarkView === 'month') {
        const lastDay = new Date(parseInt(kamFilters.year,10), parseInt(monthToMatch, 10), 0).getDate();
        syntheticFilters.dateRange[1] = `${kamFilters.year}-${monthToMatch}-${lastDay}`;
    } else if (benchmarkView === 'ytd') {
        const lastDay = new Date(parseInt(kamFilters.year,10), parseInt(monthToMatch, 10), 0).getDate();
        syntheticFilters.dateRange[1] = `${kamFilters.year}-${monthToMatch}-${lastDay}`;
    }

    const benchmarkTimeRecords = baseRecords.filter(r => {
      const dateVal = r["Invoice Date"] || r["Sales Date"] || "";
      const saleDate = new Date(dateVal);
      const m = String(saleDate.getMonth() + 1).padStart(2, '0');
      const y = String(saleDate.getFullYear());

      if (kamFilters.year && y !== kamFilters.year) return false;
      
      if (benchmarkView === 'month') {
        if (m !== monthToMatch) return false;
      } else if (benchmarkView === 'ytd') {
        const currentMonthInt = parseInt(monthToMatch, 10);
        if (saleDate.getMonth() + 1 > currentMonthInt) return false;
      }

      if (kamFilters.brand && r.Brand !== kamFilters.brand) return false;
      if (kamFilters.product && r.Product !== kamFilters.product) return false;
      if (kamFilters.category && r.Group !== kamFilters.category) return false;
      if (kamFilters.pm && r["Product Manager"] !== kamFilters.pm) return false;
      if (kamFilters.customer && r.Buyer !== kamFilters.customer) return false;
      
      return true;
    });

    const benchmarkTimeCollections = (collectionRecords || []).filter(c => {
      const payDate = new Date(c.paymentDate);
      const m = String(payDate.getMonth() + 1).padStart(2, '0');
      const y = String(payDate.getFullYear());

      if (kamFilters.year && y !== kamFilters.year) return false;

      if (benchmarkView === 'month') {
        if (m !== monthToMatch) return false;
      } else if (benchmarkView === 'ytd') {
        const currentMonthInt = parseInt(monthToMatch, 10);
        if (payDate.getMonth() + 1 > currentMonthInt) return false;
      }
      return true;
    });

    const result = getRepresentativeTargets(benchmarkTimeRecords, benchmarkTimeCollections, syntheticFilters);
    
    // We NO LONGER need to manually scale targets here because calculateScaledTarget (called from getRepresentativeTargets) 
    // now receives the correct dateRange via syntheticFilters.
    return result.sort((a,b) => b.achievementRate - a.achievementRate);
  }, [baseRecords, kamFilters, benchmarkView, collectionRecords, filters]);

  const filteredKams = kamPerformance.filter(k => 
    k.branchOrName.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => b.achievementRate - a.achievementRate);

  const monthNames = getMonthsList();


  const activeKamData = useMemo(() => {
    const kamName = selectedKam || (filteredKams.length > 0 ? filteredKams[0].branchOrName : null);
    if (!kamName) return null;

    const records = localFilteredRecords.filter(r => r["Sales Person"] === kamName);
    const target = kamPerformance.find(k => k.branchOrName === kamName);

    // Monthly Trend
    const monthlyMap: Record<string, { sales: number; collection: number }> = {};
    records.forEach(r => {
      const dateVal = r["Invoice Date"] || r["Sales Date"] || "";
      const date = new Date(dateVal);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { sales: 0, collection: 0 };
      monthlyMap[key].sales += r["Total Price"];
      if (r.Invoice) monthlyMap[key].collection += r["Total Price"];
    });

    const trendData = Object.entries(monthlyMap)
      .map(([month, values]) => ({ month, value: values.sales, collection: values.collection }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Product Category Mix
    const categoryMap: Record<string, number> = {};
    const brandMap: Record<string, number> = {};
    const pmMap: Record<string, number> = {};
    records.forEach(r => {
      const cat = r.Group || "General";
      categoryMap[cat] = (categoryMap[cat] || 0) + r["Total Price"];
      
      const brand = r.Brand || "Unknown";
      brandMap[brand] = (brandMap[brand] || 0) + r["Total Price"];

      const pm = r["Product Manager"] || "Unassigned";
      pmMap[pm] = (pmMap[pm] || 0) + r["Total Price"];
    });

    const categoryData = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const brandData = Object.entries(brandMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const pmData = Object.entries(pmMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Industry Mix
    const industryMap: Record<string, number> = {};
    records.forEach(r => {
      const ind = r["Buyer Group"] || "Others";
      industryMap[ind] = (industryMap[ind] || 0) + r["Total Price"];
    });

    const totalIndustryRevenue = Object.values(industryMap).reduce((sum, val) => sum + val, 0);
    const industryData = Object.entries(industryMap)
      .map(([name, value]) => ({ 
        name, 
        value,
        percent: totalIndustryRevenue > 0 ? (value / totalIndustryRevenue) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    // Performance Ratio to Total Sales
    const totalCompanyRevenue = localFilteredRecords.reduce((sum, r) => sum + r["Total Price"], 0);
    const kamValue = target?.actual || 0;
    const othersValue = Math.max(0, totalCompanyRevenue - kamValue);
    const performanceRatioData = [
      { name: kamName, value: kamValue, percent: totalCompanyRevenue > 0 ? (kamValue / totalCompanyRevenue) * 100 : 0 },
      { name: 'Other KAMs', value: othersValue, percent: totalCompanyRevenue > 0 ? (othersValue / totalCompanyRevenue) * 100 : 0 }
    ];

    // Top Customers for this KAM
    const customerMap: Record<string, { total: number; count: number }> = {};
    records.forEach(r => {
      if (!customerMap[r.Buyer]) customerMap[r.Buyer] = { total: 0, count: 0 };
      customerMap[r.Buyer].total += r["Total Price"];
      customerMap[r.Buyer].count += 1;
    });
    const customerData = Object.entries(customerMap)
      .map(([name, data]) => ({ name, value: data.total, count: data.count }))
      .sort((a, b) => b.value - a.value);

    return {
      name: kamName,
      target: target?.target || 0,
      collectionTarget: target?.collectionTarget || 0,
      actual: target?.actual || 0,
      actualCollection: target?.actualCollection || 0,
      achievement: target?.achievementRate || 0,
      collectionAchievement: target?.collectionAchievementRate || 0,
      trendData,
      categoryData,
      brandData,
      pmData,
      industryData,
      performanceRatioData,
      customerData,
      recordCount: records.length,
      averageTicket: records.length > 0 ? (target?.actual || 0) / records.length : 0
    };
  }, [selectedKam, filteredKams, localFilteredRecords, kamPerformance]);

  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => document.getElementById('kam-performance-bench-section')?.scrollIntoView({ behavior: 'smooth' })}
          className={`p-4 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} cursor-pointer hover:bg-amber-500/5 hover:border-amber-500/30 transition-all active:scale-95 group`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="text-amber-500 group-hover:scale-110 transition-transform" size={16} />
            <span className={`text-[10px] uppercase font-mono font-bold tracking-widest ${theme.textMuted}`}>Top Performer</span>
          </div>
          <div className={`text-lg font-bold truncate ${theme.isDark ? 'text-white' : 'text-slate-900'}`}>
            {filteredKams[0]?.branchOrName || "N/A"}
          </div>
          <div className="text-xs text-amber-500 font-mono mt-1">
            {filteredKams[0]?.achievementRate || 0}% Achievement
          </div>
        </div>

        <div 
          onClick={() => document.getElementById('kam-performance-bench-section')?.scrollIntoView({ behavior: 'smooth' })}
          className={`p-4 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} cursor-pointer hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all active:scale-95 group`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="text-indigo-400 group-hover:scale-110 transition-transform" size={16} />
            <span className={`text-[10px] uppercase font-mono font-bold tracking-widest ${theme.textMuted}`}>Team Avg achievement</span>
          </div>
          <div className={`text-lg font-bold ${theme.isDark ? 'text-white' : 'text-slate-900'}`}>
            {kamPerformance.length > 0 
              ? Math.round(kamPerformance.reduce((s, k) => s + k.achievementRate, 0) / kamPerformance.length)
              : 0}%
          </div>
          <div className={`text-xs font-mono mt-1 ${theme.textMuted}`}>
            Across {kamPerformance.length} KAMs
          </div>
        </div>

        <div 
          onClick={() => document.getElementById('kam-ranking-section')?.scrollIntoView({ behavior: 'smooth' })}
          className={`p-4 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} cursor-pointer hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all active:scale-95 group`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="text-emerald-400 group-hover:scale-110 transition-transform" size={16} />
            <span className={`text-[10px] uppercase font-mono font-bold tracking-widest ${theme.textMuted}`}>Active Accounts</span>
          </div>
          <div className={`text-lg font-bold ${theme.isDark ? 'text-white' : 'text-slate-900'}`}>
            {Array.from(new Set(localFilteredRecords.map(r => r.Buyer))).length}
          </div>
          <div className="text-xs text-emerald-400 font-mono mt-1 flex items-center gap-1">
            <ArrowUpRight size={10} /> 12% vs LY
          </div>
        </div>

        <div 
          onClick={() => document.getElementById('kam-performance-bench-section')?.scrollIntoView({ behavior: 'smooth' })}
          className={`p-4 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} cursor-pointer hover:bg-rose-500/5 hover:border-rose-500/30 transition-all active:scale-95 group`}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-rose-400 group-hover:scale-110 transition-transform" size={16} />
            <span className={`text-[10px] uppercase font-mono font-bold tracking-widest ${theme.textMuted}`}>KAM Pipeline Portfolio</span>
          </div>
          <div className={`text-lg font-bold ${theme.isDark ? 'text-white' : 'text-slate-900'}`}>
            {formatBDT(kamPerformance.reduce((s, k) => s + k.gap, 0))}
          </div>
          <div className="text-xs text-rose-400/70 font-mono mt-1">
            Total Remaining Target Gap
          </div>
        </div>
      </div>

        {/* KAM Analytics Filters positioned after the Benchmark */}
        <div className={`xl:col-span-3 p-4 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-bold text-sm flex items-center gap-2 ${theme.isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              <Filter size={16} className="text-indigo-500" />
              KAM Analytics Filters
            </h3>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition"
            >
              {isFilterOpen ? "Hide Filters" : "Show Filters"}
            </button>
          </div>
          {isFilterOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mt-4">
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-mono w-full min-w-0 ${theme.isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-slate-200"}`}>
                <Calendar size={13} className="text-violet-400 shrink-0" />
                <select
                  value={kamFilters.year}
                  onChange={(e) => setKamFilters(p => ({ ...p, year: e.target.value }))}
                  className={`w-full bg-transparent border-none text-[11px] focus:ring-0 cursor-pointer font-bold outline-none font-mono min-w-0 appearance-none ${theme.isDark ? 'text-slate-200' : 'text-slate-800'}`}
                >
                  <option value="" className={theme.isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>All Years</option>
                  {filterLists.years.map(y => <option key={y} value={y} className={theme.isDark ? "bg-slate-900" : "bg-white"}>{y}</option>)}
                </select>
                <ChevronDown size={13} className="text-slate-500 shrink-0 pointer-events-none" />
              </div>
              
              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-mono w-full min-w-0 ${theme.isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-slate-200"}`}>
                <Calendar size={13} className="text-sky-400 shrink-0" />
                <select
                  value={kamFilters.month}
                  onChange={(e) => setKamFilters(p => ({ ...p, month: e.target.value }))}
                  className={`w-full bg-transparent border-none text-[11px] focus:ring-0 cursor-pointer font-bold outline-none font-mono min-w-0 appearance-none ${theme.isDark ? 'text-slate-200' : 'text-slate-800'}`}
                >
                  <option value="" className={theme.isDark ? "bg-slate-900 text-slate-200" : "bg-white text-slate-800"}>{benchmarkView === 'annual' ? 'All Months' : 'Select Month'}</option>
                  {monthNames.map((m, i) => (
                    <option key={m} value={String(i+1).padStart(2,'0')} className={theme.isDark ? "bg-slate-900" : "bg-white"}>{m}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="text-slate-500 shrink-0 pointer-events-none" />
              </div>

              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-mono w-full min-w-0 ${theme.isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-slate-200"}`}>
                <Layers size={13} className="text-emerald-400 shrink-0" />
                <input
                  list="kam-categories"
                  placeholder="All Categories"
                  value={kamFilters.category}
                  onChange={(e) => setKamFilters(p => ({ ...p, category: e.target.value }))}
                  className={`w-full bg-transparent border-none text-[11px] focus:ring-0 font-bold outline-none font-mono min-w-0 appearance-none placeholder:font-medium placeholder:text-slate-400 ${theme.isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-800'}`}
                />
                <ChevronDown size={13} className="text-slate-500 shrink-0 pointer-events-none" />
                <datalist id="kam-categories">
                  {filterLists.categories.map(x => <option key={x} value={x} />)}
                </datalist>
              </div>

              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-mono w-full min-w-0 ${theme.isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-slate-200"}`}>
                <Tag size={13} className="text-amber-400 shrink-0" />
                <input
                  list="kam-brands"
                  placeholder="All Brands"
                  value={kamFilters.brand}
                  onChange={(e) => setKamFilters(p => ({ ...p, brand: e.target.value }))}
                  className={`w-full bg-transparent border-none text-[11px] focus:ring-0 font-bold outline-none font-mono min-w-0 appearance-none placeholder:font-medium placeholder:text-slate-400 ${theme.isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-800'}`}
                />
                <ChevronDown size={13} className="text-slate-500 shrink-0 pointer-events-none" />
                <datalist id="kam-brands">
                  {filterLists.brands.map(x => <option key={x} value={x} />)}
                </datalist>
              </div>

              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-mono w-full min-w-0 ${theme.isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-slate-200"}`}>
                <Briefcase size={13} className="text-purple-400 shrink-0" />
                <input
                  list="kam-products"
                  placeholder="All Products"
                  value={kamFilters.product}
                  onChange={(e) => setKamFilters(p => ({ ...p, product: e.target.value }))}
                  className={`w-full bg-transparent border-none text-[11px] focus:ring-0 font-bold outline-none font-mono min-w-0 appearance-none placeholder:font-medium placeholder:text-slate-400 ${theme.isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-800'}`}
                />
                <ChevronDown size={13} className="text-slate-500 shrink-0 pointer-events-none" />
                <datalist id="kam-products">
                  {filterLists.products.map(x => <option key={x} value={x} />)}
                </datalist>
              </div>

              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-mono w-full min-w-0 ${theme.isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-slate-200"}`}>
                <User size={13} className="text-teal-400 shrink-0" />
                <input
                  list="kam-pms"
                  placeholder="All PMs"
                  value={kamFilters.pm}
                  onChange={(e) => setKamFilters(p => ({ ...p, pm: e.target.value }))}
                  className={`w-full bg-transparent border-none text-[11px] focus:ring-0 font-bold outline-none font-mono min-w-0 appearance-none placeholder:font-medium placeholder:text-slate-400 ${theme.isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-800'}`}
                />
                <ChevronDown size={13} className="text-slate-500 shrink-0 pointer-events-none" />
                <datalist id="kam-pms">
                  {filterLists.pms.map(x => <option key={x} value={x} />)}
                </datalist>
              </div>

              <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-mono w-full min-w-0 ${theme.isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-slate-200"}`}>
                <Building2 size={13} className="text-pink-400 shrink-0" />
                <input
                  list="kam-customers"
                  placeholder="All Customers"
                  value={kamFilters.customer}
                  onChange={(e) => setKamFilters(p => ({ ...p, customer: e.target.value }))}
                  className={`w-full bg-transparent border-none text-[11px] focus:ring-0 font-bold outline-none font-mono min-w-0 appearance-none placeholder:font-medium placeholder:text-slate-400 ${theme.isDark ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-800'}`}
                />
                <ChevronDown size={13} className="text-slate-500 shrink-0 pointer-events-none" />
                <datalist id="kam-customers">
                  {filterLists.customers.map(x => <option key={x} value={x} />)}
                </datalist>
              </div>
            </div>
          )}
        </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* KAM to KAM Comparison - Full Width Bar Chart */}
        <div id="kam-performance-bench-section" className={`xl:col-span-3 p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} scroll-mt-24`}>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-indigo-400" />
              <div>
                <h3 className={`font-bold text-base ${theme.isDark ? 'text-slate-200' : 'text-slate-900'}`}>KAM Performance Benchmark</h3>
                <p className={`text-[10px] font-mono ${theme.textMuted}`}>
                  {benchmarkView === 'month' 
                    ? `Monthly Performance for ${monthNames[(kamFilters.month ? parseInt(kamFilters.month, 10) : new Date().getMonth() + 1) - 1]}` 
                    : benchmarkView === 'ytd' 
                      ? `Year-to-Date Performance through ${monthNames[(kamFilters.month ? parseInt(kamFilters.month, 10) : new Date().getMonth() + 1) - 1]}` 
                      : 'Annual Performance Overview (Full Year Comparison)'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 w-full xl:w-auto mt-4 xl:mt-0">
              <div className="flex w-full bg-slate-800/80 rounded border border-slate-700/50 p-0.5 text-[10px] font-mono">
                <button 
                  onClick={() => {
                    setBenchmarkView('month');
                    if (!kamFilters.month) {
                      setKamFilters(p => ({ ...p, month: String(new Date().getMonth() + 1).padStart(2, '0') }));
                    }
                  }} 
                  className={`flex-1 text-center px-3 py-1.5 rounded-sm ${benchmarkView === 'month' ? 'bg-indigo-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                >
                  Month
                </button>
                <button 
                  onClick={() => {
                    setBenchmarkView('ytd');
                    if (!kamFilters.month) {
                      setKamFilters(p => ({ ...p, month: String(new Date().getMonth() + 1).padStart(2, '0') }));
                    }
                  }} 
                  className={`flex-1 text-center px-3 py-1.5 rounded-sm ${benchmarkView === 'ytd' ? 'bg-indigo-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                >
                  YTD
                </button>
                <button 
                  onClick={() => {
                    setBenchmarkView('annual');
                    setKamFilters(p => ({ ...p, month: "" }));
                  }} 
                  className={`flex-1 text-center px-3 py-1.5 rounded-sm ${benchmarkView === 'annual' ? 'bg-indigo-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                >
                  Annual
                </button>
              </div>
              {benchmarkView === 'month' && (
                <div className={`flex items-center justify-between w-full px-2 py-1 rounded-lg border ${theme.isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} text-[10px] font-mono`}>
                  <button 
                    onClick={() => {
                      const current = kamFilters.month ? parseInt(kamFilters.month, 10) : new Date().getMonth() + 1;
                      const prev = current === 1 ? 12 : current - 1;
                      setKamFilters(p => ({ ...p, month: String(prev).padStart(2, '0') }));
                    }}
                    className={`p-1 rounded hover:bg-slate-800 transition ${theme.isDark ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className={`font-bold text-center ${theme.isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {monthNames[(kamFilters.month ? parseInt(kamFilters.month, 10) : new Date().getMonth() + 1) - 1]}
                  </span>
                  <button 
                    onClick={() => {
                      const current = kamFilters.month ? parseInt(kamFilters.month, 10) : new Date().getMonth() + 1;
                      const next = current === 12 ? 1 : current + 1;
                      setKamFilters(p => ({ ...p, month: String(next).padStart(2, '0') }));
                    }}
                    className={`p-1 rounded hover:bg-slate-800 transition ${theme.isDark ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] font-mono mt-1">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-indigo-500 rounded-full"/> <span className="text-slate-400">Actual Revenue</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full"/> <span className="text-slate-400">Actual Collection</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-red-500 rounded-full"/> <span className="text-slate-400">Target</span></div>
              </div>
            </div>
          </div>
          <div className="h-80 w-full min-w-0 overflow-x-auto custom-scrollbar">
            <div className="h-full flex justify-start" style={{ minWidth: benchmarkKams.slice(0, 10).length > 5 ? '600px' : '100%', width: benchmarkKams.slice(0, 10).length < 5 ? `${benchmarkKams.slice(0, 10).length * 100}px` : '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={benchmarkKams.slice(0, 10)} margin={{ left: -15, right: 0, top: 10, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="branchOrName" 
                  stroke="#475569" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  interval={0}
                  angle={filteredKams.length > 5 ? -25 : 0}
                  textAnchor={filteredKams.length > 5 ? "end" : "middle"}
                />
                <YAxis 
                  stroke="#475569" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  width={40}
                  tickFormatter={(val) => `${(val / 100000).toFixed(0)}`}
                />
                <Tooltip 
                  content={({ active, label, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className={`p-3 rounded-xl border shadow-xl ${theme.isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className="flex items-center gap-2 mb-1 border-b border-slate-800/20 pb-1">
                            <Calendar size={12} className="text-indigo-400" />
                            <span className={`text-[10px] font-bold ${theme.textMuted}`}>{label} (Fiscal Period)</span>
                          </div>
                          {payload.map((p: any) => (
                            <div key={p.name} className="flex items-center justify-between gap-4 py-1">
                              <span className="text-[11px] text-slate-500">{
                                p.dataKey === 'actual' ? 'Actual Revenue' : 
                                p.dataKey === 'actualCollection' ? 'Actual Collection' : 'Target'
                              }:</span>
                              <span className={`text-[11px] font-bold font-mono ${
                                p.dataKey === 'actual' ? 'text-indigo-400' : 
                                p.dataKey === 'actualCollection' ? 'text-emerald-400' : 'text-slate-500'
                              }`}>{formatBDT(p.value)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ fill: '#6366f1', opacity: 0.1 }}
                />
                <Bar dataKey="actual" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="actualCollection" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="target" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey="achievementRate" stroke="#f59e0b" strokeWidth={2} yAxisId="right" dot={{ r: 4, fill: '#f59e0b' }} hide />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* KAM List & Ranking */}
        <div id="kam-ranking-section" className={`xl:col-span-1 p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col scroll-mt-24`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-indigo-400" />
              <h3 className="font-bold text-slate-200 text-sm">KAM Performance Ranking</h3>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input 
              type="text"
              placeholder="Search KAM name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-all font-mono"
            />
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
            {filteredKams.map((kam, idx) => (
              <div 
                key={kam.branchOrName}
                onClick={() => setSelectedKam(kam.branchOrName)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                  (selectedKam === kam.branchOrName || (!selectedKam && idx === 0))
                    ? "bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20" 
                    : "bg-slate-900/30 border-slate-800/50 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    idx < 3 ? "bg-amber-500/20 text-amber-500 shadow-lg shadow-amber-500/10" : "bg-slate-800 text-slate-400"
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 group-hover:text-white transition">{kam.branchOrName}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBDT(kam.actual)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-bold font-mono ${
                    kam.achievementRate >= 100 ? "text-emerald-400" : 
                    kam.achievementRate >= 80 ? "text-blue-400" : "text-amber-400"
                  }`}>
                    {kam.achievementRate}%
                  </div>
                  <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        kam.achievementRate >= 100 ? "bg-emerald-500" : 
                        kam.achievementRate >= 80 ? "bg-blue-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, kam.achievementRate)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected KAM Deep Dive */}
        <div className="xl:col-span-2 space-y-6">
          {activeKamData ? (
            <>
              {/* KAM Detail Header */}
              <div className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} bg-gradient-to-br from-indigo-600/5 to-transparent`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                      <User size={28} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">{activeKamData.name}</h2>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 uppercase font-mono tracking-wider font-bold">Key Account Manager</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 uppercase font-mono tracking-wider font-bold">Active</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Target Achievement</div>
                      <div className="text-3xl font-black text-indigo-400 font-mono tracking-tighter">
                        {activeKamData.achievement}%
                      </div>
                    </div>
                    <div className="w-px h-10 bg-slate-800 self-center" />
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Total Sales</div>
                      <div className="text-xl font-bold text-white font-mono">
                        {formatBDT(activeKamData.actual)}
                      </div>
                    </div>
                  </div>
                </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-8">
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500 uppercase font-mono">Sales Target Achieved</div>
                      <div className="text-sm font-bold text-indigo-400 font-mono">{activeKamData.achievement}%</div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                        <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(100, activeKamData.achievement)}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500 uppercase font-mono">Collection Achieved</div>
                      <div className="text-sm font-bold text-emerald-400 font-mono">{activeKamData.collectionAchievement}%</div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                        <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, activeKamData.collectionAchievement)}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500 uppercase font-mono">Avg Deal Size</div>
                      <div className="text-sm font-bold text-slate-200 font-mono">{formatBDT(activeKamData.averageTicket)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500 uppercase font-mono">Invoices</div>
                      <div className="text-sm font-bold text-slate-200 font-mono">{activeKamData.recordCount} records</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500 uppercase font-mono">Total Customers</div>
                      <div className="text-sm font-bold text-sky-400 font-mono">{activeKamData.customerData.length} active</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Sales Pie */}
                  <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
                    <h3 className="font-bold text-slate-400 text-[10px] uppercase mb-4 font-mono">Sales Achievement</h3>
                    <div className="h-40 w-full relative min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Achieved', value: activeKamData.actual },
                              { name: 'Remaining', value: Math.max(0, activeKamData.target - activeKamData.actual) }
                            ]}
                            cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={5} dataKey="value"
                          >
                            <Cell fill="#6366f1" stroke="transparent" />
                            <Cell fill="#1e293b" stroke="transparent" />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                            itemStyle={{ color: '#e2e8f0' }}
                            labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                            formatter={(val: number, name: string) => [formatBDT(val), name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-white text-lg">{activeKamData.achievement}%</div>
                    </div>
                  </div>

                  {/* Collection Pie */}
                  <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
                    <h3 className="font-bold text-slate-400 text-[10px] uppercase mb-4 font-mono">Collection Status</h3>
                    <div className="h-40 w-full relative min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Collected', value: activeKamData.actualCollection },
                              { name: 'Due', value: Math.max(0, activeKamData.collectionTarget - activeKamData.actualCollection) }
                            ]}
                            cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={5} dataKey="value"
                          >
                            <Cell fill="#10b981" stroke="transparent" />
                            <Cell fill="#1e293b" stroke="transparent" />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                            itemStyle={{ color: '#e2e8f0' }}
                            labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                            formatter={(val: number, name: string) => [formatBDT(val), name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-white text-lg">{activeKamData.collectionAchievement}%</div>
                    </div>
                  </div>

                  {/* Monthly Revenue Trend */}
                  <div className={`lg:col-span-2 p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
                    <div className="flex items-center gap-2 mb-6">
                      <TrendingUp size={16} className="text-indigo-400" />
                      <h3 className="font-bold text-slate-200 text-xs">Monthly Performance Trend</h3>
                    </div>
                    <div className="h-40 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activeKamData.trendData} margin={{ left: -15, right: 0, top: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorColl" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis 
                            dataKey="month" 
                            stroke="#475569" 
                            fontSize={8} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(val) => {
                              const parts = val.split('-');
                              if (parts.length === 2) {
                                const mIdx = parseInt(parts[1], 10) - 1;
                                const shortMonths = getMonthsList();
                                return shortMonths[mIdx] || parts[1];
                              }
                              return val;
                            }} 
                          />
                          <YAxis width={40} stroke="#475569" fontSize={8} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 100000).toFixed(0)}`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }} 
                            formatter={(val: number) => [formatBDT(val), 'Value']} 
                            labelFormatter={(val) => {
                              const parts = val.split('-');
                              if (parts.length === 2) {
                                const mIdx = parseInt(parts[1], 10) - 1;
                                const mNames = getMonthsList();
                                return `${mNames[mIdx] || parts[1]} ${parts[0]}`;
                              }
                              return val;
                            }}
                          />
                          <Area type="monotone" dataKey="value" name="Sales" stroke="#6366f1" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
                          <Area type="monotone" dataKey="collection" name="Collection" stroke="#10b981" fillOpacity={1} fill="url(#colorColl)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Performance Ratio Chart for this KAM */}
                  <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
                   <div className="flex items-center gap-2 mb-6">
                    <PieChartIcon size={16} className="text-violet-500" />
                    <h3 className="font-bold text-slate-200 text-xs">Performance Ratio to Total Sales</h3>
                  </div>
                  <div className="h-64 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={activeKamData.performanceRatioData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {activeKamData.performanceRatioData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                          itemStyle={{ color: '#e2e8f0' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                          formatter={(val: number, name: string, props: any) => [`${formatBDT(val)} (${props.payload.percent?.toFixed(1) || 0}%)`, 'Revenue']}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Industry Mix Chart */}
                <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
                   <div className="flex items-center gap-2 mb-6">
                    <PieChartIcon size={16} className="text-amber-500" />
                    <h3 className="font-bold text-slate-200 text-xs">Industry & Client Distribution</h3>
                  </div>
                  <div className="h-64 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={activeKamData.industryData.slice(0, 5)}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {activeKamData.industryData.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                          itemStyle={{ color: '#e2e8f0' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                          formatter={(val: number, name: string, props: any) => [`${formatBDT(val)} (${props.payload.percent?.toFixed(1) || 0}%)`, 'Revenue']}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Product Portfolio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
                  <div className="flex items-center gap-2 mb-6">
                    <BarChart3 size={16} className="text-emerald-400" />
                    <h3 className="font-bold text-slate-200 text-xs">Product Category Breakdown</h3>
                  </div>
                  <div className="h-72 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeKamData.categoryData.slice(0, 8)} layout="vertical" margin={{ left: -15, right: 0, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          width={75}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                          itemStyle={{ color: '#e2e8f0' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                          formatter={(val: number) => [formatBDT(val), 'Revenue']}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={15}>
                          {activeKamData.categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Brand Portfolio */}
                <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
                  <div className="flex items-center gap-2 mb-6">
                    <Tag size={16} className="text-amber-400" />
                    <h3 className="font-bold text-slate-200 text-xs">Brand Breakdown</h3>
                  </div>
                  <div className="h-72 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeKamData.brandData.slice(0, 8)} layout="vertical" margin={{ left: -15, right: 0, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          width={75}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                          itemStyle={{ color: '#e2e8f0' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                          formatter={(val: number) => [formatBDT(val), 'Revenue']}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={15}>
                          {activeKamData.brandData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* PM Breakdown */}
                <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
                  <div className="flex items-center gap-2 mb-6">
                    <Briefcase size={16} className="text-purple-400" />
                    <h3 className="font-bold text-slate-200 text-xs">PM Breakdown</h3>
                  </div>
                  <div className="h-72 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeKamData.pmData.slice(0, 8)} layout="vertical" margin={{ left: -15, right: 0, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          width={75}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                          itemStyle={{ color: '#e2e8f0' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                          formatter={(val: number) => [formatBDT(val), 'Revenue']}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={15}>
                          {activeKamData.pmData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Customers Section */}
                <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
                  <div className="flex items-center gap-2 mb-6">
                    <Users size={16} className="text-sky-400" />
                    <h3 className="font-bold text-slate-200 text-xs">Top Active Accounts</h3>
                  </div>
                  <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                    {activeKamData.customerData.slice(0, 25).map((customer, idx) => (
                      <div key={customer.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/30 border border-slate-800/50">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-slate-200 break-all">{customer.name}</div>
                            <div className="text-[9px] text-indigo-400 font-mono">{customer.count} Invoices</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-white font-mono">{formatBDT(customer.value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center p-20 border-2 border-dashed border-slate-800 rounded-3xl">
              <div className="text-center">
                <Users size={48} className="text-slate-700 mx-auto mb-4" />
                <h3 className="text-slate-400 font-bold mb-2">Select a Sales Person</h3>
                <p className="text-slate-600 text-xs max-w-xs mx-auto">Choose an account representative from the ranking list to view their detailed performance analytics.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
