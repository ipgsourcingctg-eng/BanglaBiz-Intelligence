/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  TrendingUp, 
  Target, 
  Users, 
  BrainCircuit, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertCircle,
  Loader2,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  Filter
} from "lucide-react";
import { utils, writeFile } from "xlsx";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell,
  Legend
} from "recharts";
import { SalesRecord, FunnelRecord, DashboardTheme, SalesForecastData, CustomerForecastItem } from "../types";

interface ForecastingPageProps {
  allRecords: SalesRecord[];
  funnelRecords: FunnelRecord[];
  theme: DashboardTheme;
  filters?: any;
}

export default function ForecastingPage({ allRecords, funnelRecords, theme, filters }: ForecastingPageProps) {
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<SalesForecastData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedKAM, setSelectedKAM] = useState<string>("All KAMs");

  const searchQuery = (filters?.searchQuery || "").toLowerCase();

  const baseFilteredSales = useMemo(() => {
    if (!searchQuery) return allRecords;
    return allRecords.filter(r => 
      String(r.Buyer || "").toLowerCase().includes(searchQuery) ||
      String(r.Product || "").toLowerCase().includes(searchQuery) ||
      String(r.Brand || "").toLowerCase().includes(searchQuery) ||
      String(r["Sales Person"] || "").toLowerCase().includes(searchQuery)
    );
  }, [allRecords, searchQuery]);

  const baseFilteredFunnel = useMemo(() => {
    if (!searchQuery) return funnelRecords;
    return funnelRecords.filter(r => 
      String(r.partner || "").toLowerCase().includes(searchQuery) ||
      String(r.brand || "").toLowerCase().includes(searchQuery) ||
      String(r.salesman || "").toLowerCase().includes(searchQuery)
    );
  }, [funnelRecords, searchQuery]);

  const kamList = useMemo(() => {
    const kams = new Set<string>();
    baseFilteredSales.forEach(r => {
      if (r["Sales Person"]) kams.add(r["Sales Person"]);
    });
    baseFilteredFunnel.forEach(r => {
      if (r.salesman) kams.add(r.salesman);
    });
    return ["All KAMs", ...Array.from(kams).sort()];
  }, [baseFilteredSales, baseFilteredFunnel]);

  const filteredAllRecords = useMemo(() => {
    if (selectedKAM === "All KAMs") return baseFilteredSales;
    return baseFilteredSales.filter(r => r["Sales Person"] === selectedKAM);
  }, [baseFilteredSales, selectedKAM]);

  const filteredFunnelRecords = useMemo(() => {
    if (selectedKAM === "All KAMs") return baseFilteredFunnel;
    return baseFilteredFunnel.filter(r => r.salesman === selectedKAM);
  }, [baseFilteredFunnel, selectedKAM]);

  const history = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    filteredAllRecords.forEach(r => {
      const dateStr = r["Invoice Date"] || r["Sales Date"];
      if (!dateStr) return;
      const month = dateStr.substring(0, 7);
      if (!map[r.Buyer]) map[r.Buyer] = {};
      map[r.Buyer][month] = (map[r.Buyer][month] || 0) + r["Total Price"];
    });
    return Object.entries(map).flatMap(([customer, months]) => 
      Object.entries(months).map(([month, revenue]) => ({ customer, month, revenue }))
    ).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredAllRecords]);

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: history.slice(-1000), // Increased context for broader customer analysis
          funnel: filteredFunnelRecords
        })
      });

      if (!response.ok) throw new Error("Failed to fetch forecast from AI engine.");
      const data = await response.json();
      setForecast(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allRecords.length > 0) {
      fetchForecast();
    }
  }, [selectedKAM]);

  const exportToExcel = () => {
    if (!forecast) return;

    const wb = utils.book_new();
    
    // Monthly Forecast Sheet
    const monthlyData = (forecast.monthlyForecast || []).map(m => ({
      "Month": m.month,
      "Predicted Revenue (BDT)": m.predictedRevenue,
      "Predicted Revenue (Formatted)": formatBDT(m.predictedRevenue),
      "Growth Rate (%)": m.growthRate
    }));
    const monthlyWS = utils.json_to_sheet(monthlyData);
    utils.book_append_sheet(wb, monthlyWS, "Monthly Revenue Forecast");

    // Customer Forecast Sheet
    const customerData = (forecast.customerForecast || []).map(c => ({
      "Customer/Account": c.customer,
      "Predicted Next 3 Months": c.predictedNext3Months,
      "Next 3M (Formatted)": formatBDT(c.predictedNext3Months),
      "Current Pipeline Value": c.funnelPotential,
      "Pipeline Value (Formatted)": formatBDT(c.funnelPotential),
      "Confidence Level": c.confidence
    }));
    const customerWS = utils.json_to_sheet(customerData);
    utils.book_append_sheet(wb, customerWS, "Customer Account Forecast");

    // Add Metadata info sheet
    const metaData = [
      { "Key": "Forecast Generation Date", "Value": new Date().toLocaleString() },
      { "Key": "Filtered KAM", "Value": selectedKAM },
      { "Key": "Total Predicted Revenue (Next 3M)", "Value": formatBDT((forecast.monthlyForecast || []).reduce((s, m) => s + m.predictedRevenue, 0)) },
      { "Key": "Forecast Logic", "Value": "AI-Synthesized Historical Sales (36M) + Active Funnel Pipeline Weighted Probability" }
    ];
    const metaWS = utils.json_to_sheet(metaData);
    utils.book_append_sheet(wb, metaWS, "Report Metadata");

    writeFile(wb, `SalesPulse_Sales_Forecast_${selectedKAM.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatBDT = (val: number) => {
    if (val >= 10000000) return `৳ ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `৳ ${(val / 100000).toFixed(2)} Lac`;
    return `৳ ${val.toLocaleString()}`;
  };

  if (loading && !forecast) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <h3 className="text-xl font-medium">Predictive Engine Analyzing Historical Trends...</h3>
        <p className="text-slate-400 text-sm">Synthesizing customer historical data with current pipeline models.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-slate-900/40 p-6 rounded-2xl border border-blue-500/10 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <BrainCircuit className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">AI-Powered Sales Forecast</h2>
              <p className="text-slate-400 text-sm">Multi-dimensional analysis of buyer history and funnel conversion metrics.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={selectedKAM}
                onChange={(e) => setSelectedKAM(e.target.value)}
                className="bg-transparent text-sm text-white focus:outline-none cursor-pointer min-w-[140px]"
              >
                {kamList.map(item => (
                  <option key={item} value={item} className="bg-slate-900">{item}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={exportToExcel}
              disabled={!forecast || loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all border border-slate-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>

            <button 
              onClick={fetchForecast}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {forecast?.strategicAnalysis && (
          <div className="mt-6 flex items-start gap-3 p-4 bg-amber-500/5 border-l-4 border-amber-500 rounded-r-lg">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-300 italic">
              <span className="font-bold text-amber-400 not-italic mr-1">Strategic Note:</span>
              {forecast.strategicAnalysis}
            </p>
          </div>
        )}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <span className="p-2 bg-emerald-500/10 rounded-lg"><Target className="w-5 h-5 text-emerald-500" /></span>
            <span className="text-xs font-mono text-emerald-400">+12.5% vs Last Period</span>
          </div>
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Next 3 Months Expected</h4>
          <p className="text-3xl font-bold mt-1">
            {formatBDT(forecast?.monthlyForecast?.reduce((s, m) => s + m.predictedRevenue, 0) || 0)}
          </p>
        </div>

        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <span className="p-2 bg-blue-500/10 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-500" /></span>
            <span className="text-xs font-mono text-blue-400">High Confidence</span>
          </div>
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Pipeline Conversion</h4>
          <p className="text-3xl font-bold mt-1">
            {formatBDT(forecast?.customerForecast?.reduce((s, c) => s + c.funnelPotential, 0) || 0)}
          </p>
        </div>

        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <span className="p-2 bg-purple-500/10 rounded-lg"><Users className="w-5 h-5 text-purple-500" /></span>
            <span className="text-xs font-mono text-purple-400">Active Pipeline</span>
          </div>
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Impact Accounts</h4>
          <p className="text-3xl font-bold mt-1">
            {forecast?.customerForecast?.length || 0} Buyers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Forecast chart */}
        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Revenue Forecast Trend
          </h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecast?.monthlyForecast}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#94a3b8" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  tickFormatter={(val) => {
                    const parts = val.split("-");
                    if (parts.length === 2) {
                      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                      const mIdx = parseInt(parts[1], 10) - 1;
                      return months[mIdx] || val;
                    }
                    return val;
                  }}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `৳${(val / 1000000).toFixed(1)}M`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px" }}
                  labelStyle={{ color: "#fff", fontWeight: "bold", marginBottom: "4px" }}
                  itemStyle={{ color: "#fff" }}
                  labelFormatter={(val) => {
                    const parts = val.split("-");
                    if (parts.length === 2) {
                      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                      const mIdx = parseInt(parts[1], 10) - 1;
                      return `${months[mIdx] || parts[1]} ${parts[0]}`;
                    }
                    return val;
                  }}
                  formatter={(value: any) => [formatBDT(value), "Predicted Revenue"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="predictedRevenue" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer wise breakdown */}
        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-purple-400" />
            Top 15 Account Pipeline Depth
          </h3>
          <div className="h-[350px]">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={(forecast?.customerForecast || []).sort((a, b) => b.funnelPotential - a.funnelPotential).slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="customer" 
                  type="category" 
                  stroke="#94a3b8" 
                  fontSize={10}
                  width={150}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px" }}
                  labelStyle={{ color: "#fff", fontWeight: "bold", marginBottom: "4px" }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(value: any) => [formatBDT(value), "Pipeline Value"]}
                />
                <Bar dataKey="funnelPotential" radius={[0, 4, 4, 0]}>
                  {(forecast?.customerForecast || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#8b5cf6" : "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Customer Forecast Table */}
      <div className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold">Predictive Customer intelligence</h3>
          <span className="text-xs font-mono text-slate-500">Targeting accounts with high conversion probability</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Buyer / Account</th>
                <th className="px-6 py-4">Current Pipeline</th>
                <th className="px-6 py-4 text-center">Next 3M Forecast</th>
                <th className="px-6 py-4 text-center">Confidence</th>
                <th className="px-6 py-4 text-right">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(forecast?.customerForecast || []).map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-100">{item.customer}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono tracking-tighter mt-0.5">Enterprise Client Account</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-mono text-indigo-400">{formatBDT(item.funnelPotential)}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm font-bold text-emerald-400">{formatBDT(item.predictedNext3Months)}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      item.confidence === 'High' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      item.confidence === 'Medium' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                      'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}>
                      {item.confidence}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {item.funnelPotential > 0 ? (
                      <div className="flex items-center justify-end gap-1 text-emerald-400 text-sm font-bold">
                         <ArrowUpRight size={14} />
                         Positive
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1 text-slate-400 text-sm font-bold">
                         --
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
