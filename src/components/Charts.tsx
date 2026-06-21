/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  TrendingUp, 
  Map, 
  ShoppingBag, 
  LayoutGrid, 
  Gauge, 
  Workflow, 
  Trophy,
  Calendar
} from "lucide-react";
import { SalesRecord, DashboardTheme, DashboardFilters } from "../types";
import { formatBDT } from "../utils/format";
import { getMonthsList } from "../db/localDb";

interface ChartsProps {
  filteredRecords: SalesRecord[];
  allRecords: SalesRecord[];
  theme: DashboardTheme;
  onDrillDown?: (filterType: keyof DashboardFilters, value: string) => void;
}

export default function Charts({ filteredRecords, allRecords, theme, onDrillDown }: ChartsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredDonutSlice, setHoveredDonutSlice] = useState<number | null>(null);

  const handleDrillDown = (type: keyof DashboardFilters, value: string) => {
    if (onDrillDown) {
      onDrillDown(type, value);
    }
  };

  // 1. CHRONOLOGICAL REVENUE TREND (Line + Area)
  const getPrimaryYear = () => {
    if (filteredRecords.length === 0) return new Date().getFullYear().toString();
    const yearCounts: Record<string, number> = {};
    filteredRecords.forEach(r => {
      const dateVal = r["Invoice Date"] || r["Sales Date"] || "";
      if (dateVal) {
        const year = dateVal.split("-")[0];
        if (year) yearCounts[year] = (yearCounts[year] || 0) + 1;
      }
    });
    let maxYear = new Date().getFullYear().toString();
    let maxCount = 0;
    for (const [y, count] of Object.entries(yearCounts)) {
      if (count > maxCount) {
        maxCount = count;
        maxYear = y;
      }
    }
    return maxYear;
  };

  const displayYear = getPrimaryYear();
  
  const getMonthlyRevenue = () => {
    const monthsData = new Array(12).fill(0);
    filteredRecords.forEach(r => {
      const dateVal = r["Invoice Date"] || r["Sales Date"] || "";
      if (dateVal.startsWith(displayYear)) {
        const parts = dateVal.split("-");
        if (parts.length >= 2) {
          const monthNum = parseInt(parts[1], 10);
          if (monthNum >= 1 && monthNum <= 12) {
            monthsData[monthNum - 1] += r["Total Price"];
          }
        }
      }
    });
    return monthsData;
  };

  const rawValues = getMonthlyRevenue();
  
  // Determine how many months to display based on data or current year
  let lastMonthIdx = 11;
  const currentYearStr = new Date().getFullYear().toString();
  if (displayYear === currentYearStr) {
    lastMonthIdx = new Date().getMonth();
  } else {
    for (let i = 11; i >= 0; i--) {
      if (rawValues[i] > 0) {
        lastMonthIdx = i;
        break;
      }
    }
  }
  // Ensure we show at least 4 months for visual continuity
  lastMonthIdx = Math.max(lastMonthIdx, 4);

  const monthsList = getMonthsList().slice(0, lastMonthIdx + 1);
  const monthlyValues = rawValues.slice(0, lastMonthIdx + 1);
  
  const maxVal = Math.max(...monthlyValues) || 100000;
  
  // Create coordinates for the SVG Area
  const chartHeight = 120;
  const chartWidth = 360;
  const paddingX = 40;
  const paddingY = 20;
  
  const points = monthlyValues.map((val, idx) => {
    const x = paddingX + (idx / (monthsList.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (val / maxVal) * (chartHeight - paddingY * 2);
    return { x, y, value: val, month: monthsList[idx] };
  });

  const linePath = points.length > 0 ? "M " + points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ") : "";
  const areaPath = points.length > 0 ? `${linePath} L ${points[points.length-1].x.toFixed(1)},${chartHeight - paddingY} L ${points[0].x.toFixed(1)},${chartHeight - paddingY} Z` : "";

  // 2. REGIONAL DONUT BREAKDOWN
  // Map branch shares
  const getBranchBreakdown = () => {
    const map: Record<string, number> = {};
    filteredRecords.forEach(r => {
      map[r.Branch] = (map[r.Branch] || 0) + r["Total Price"];
    });
    const total = Object.values(map).reduce((sum, v) => sum + v, 0) || 1;
    return Object.entries(map).map(([name, sales]) => ({
      name,
      sales,
      percentage: (sales / total) * 100
    })).sort((a,b) => b.sales - a.sales);
  };

  const branchesBreakdown = getBranchBreakdown();
  
  // Draw an SVG Donut
  const donutCenter = 100;
  const donutRadius = 65;
  const strokeWidth = 14;
  let accumulatedAngle = -90; // Start top
  const colorsList = ["#fbbf24", "#38bdf8", "#34d399", "#a78bfa", "#f472b6"];

  const donutSlices = branchesBreakdown.map((item, idx) => {
    const angle = (item.percentage / 100) * 360;
    const color = colorsList[idx % colorsList.length];
    
    // Calculate polar coordinates
    const startRad = (accumulatedAngle * Math.PI) / 180;
    const endRad = ((accumulatedAngle + angle) * Math.PI) / 180;

    const x1 = donutCenter + donutRadius * Math.cos(startRad);
    const y1 = donutCenter + donutRadius * Math.sin(startRad);
    const x2 = donutCenter + donutRadius * Math.cos(endRad);
    const y2 = donutCenter + donutRadius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;
    const pathD = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${donutRadius} ${donutRadius} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    
    accumulatedAngle += angle;
    return { ...item, pathD, color };
  });

  const grandTotalSales = branchesBreakdown.reduce((sum, b) => sum + b.sales, 0);

  // 3. TOP TECHNOLOGY ASSETS (Horizontal chart)
  const getTopProducts = () => {
    const map: Record<string, { qty: number; sales: number }> = {};
    filteredRecords.forEach(r => {
      const curr = map[r.Product] || { qty: 0, sales: 0 };
      map[r.Product] = { qty: curr.qty + r.Quantity, sales: curr.sales + r["Total Price"] };
    });
    return Object.entries(map).map(([name, meta]) => ({
      name,
      quantity: meta.qty,
      sales: meta.sales
    })).sort((a,b) => b.sales - a.sales).slice(0, 5);
  };

  const topProducts = getTopProducts();
  const topProductMaxVal = topProducts[0]?.sales || 1;

  // 4. SALESPERSON TARGET ACHIEVEMENT (Gauge structure)
  const quotaTarget = allRecords.length > 0 ? 265000000 : 0; // 26.5 Crores
  const quotaActual = filteredRecords.reduce((sum, r) => sum + r["Total Price"], 0);
  const quotaPercentage = quotaTarget > 0 ? Math.min(100, (quotaActual / quotaTarget) * 100) : 0;

  // Semi-circle gauge math
  const gaugeRadius = 60;
  const gaugeCircumference = Math.PI * gaugeRadius; // Semi circle arc length
  const strokeDashoffset = gaugeCircumference - (quotaPercentage / 100) * gaugeCircumference;

  // 5. TRANSACTION STAGE FUNNEL
  const funnelStages = [
    { name: "Total Ingestion", val: filteredRecords.length, desc: "Raw corporate purchase requisitions" },
    { name: "Validation Cleared", val: filteredRecords.filter(r => r["Unit Price"] > 0).length, desc: "Passed regulatory unit pricing integrity check" },
    { name: "VAT/Tax Audit Completed", val: filteredRecords.filter(r => r["Vat & Tax"] > 0).length, desc: "Computed and mapped NBR codes" },
    { name: "Invoice Billed", val: filteredRecords.filter(r => r.Invoice).length, desc: "Final accounting settlement triggered" }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

      {/* CHART 1: CHRONOLOGICAL REVENUE TREND */}
      <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} transform hover:-translate-y-0.5 transition duration-300 relative`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={15} className="text-amber-500" />
            <h5 className={`font-bold text-[11px] sm:text-xs uppercase tracking-wide leading-relaxed ${theme.textMain}`}>
              Revenue Movement Trend ({displayYear})
            </h5>
          </div>
          <span className={`font-mono text-[9px] px-2 py-0.5 rounded border ${theme.isDark ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
            Monthly aggregate
          </span>
        </div>

        {/* SVG Chronological Plotter */}
        <div className="relative h-32 w-full mt-2">
          <svg className="w-full h-full select-none" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
            {/* Gradients */}
            <defs>
              <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Grid Line rules */}
            <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="#1e293b" strokeDasharray="3,3" />
            <line x1={paddingX} y1={chartHeight - paddingY - (chartHeight - paddingY * 2)/2} x2={chartWidth - paddingX} y2={chartHeight - paddingY - (chartHeight - paddingY * 2)/2} stroke="#1e293b" strokeDasharray="3,3" />
            <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="#334155" strokeWidth="1" />

            {/* Filled Area */}
            {points.length > 0 && (
              <path d={areaPath} fill="url(#areaGlow)" />
            )}

            {/* Solid Stroke Line */}
            {points.length > 0 && (
              <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Key Data Node points */}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIndex === idx ? 6 : 3.5}
                  fill="#f59e0b"
                  stroke="#020617"
                  strokeWidth="1.5"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
                
                {/* Horizontal point month text */}
                <text
                  x={p.x}
                  y={chartHeight - 4}
                  fontSize="8px"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fill="#94a3b8"
                >
                  {p.month}
                </text>
              </g>
            ))}
          </svg>

          {/* Interactive HTML popover/tooltip overlay */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <div 
              className={`absolute border p-2 rounded-lg text-[10px] shadow-xl z-10 pointer-events-none ${theme.isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}
              style={{
                left: `${(points[hoveredIndex].x / chartWidth) * 100}%`,
                top: `${(points[hoveredIndex].y / chartHeight) * 100 - 30}%`
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Calendar size={10} className="text-slate-500" />
                <span className={`font-semibold block ${theme.textMuted}`}>Month: {points[hoveredIndex].month}</span>
              </div>
              <span className="text-amber-500 font-bold font-mono text-[11px] block">
                {formatBDT(points[hoveredIndex].value)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CHART 2: REGIONAL CONTRIBUTION INNER DONUT */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} transform hover:-translate-y-0.5 transition duration-300 relative`}>
        <div className="flex flex-col mb-4 gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Map size={15} className="text-sky-400 shrink-0" />
            <h5 className={`font-bold text-[11px] sm:text-xs uppercase tracking-wide leading-relaxed ${theme.textMain}`}>
              National Branch Share
            </h5>
          </div>
          <span className={`font-mono text-[9px] ${theme.textMuted}`}>
            National BDT Distribution
          </span>
        </div>

        <div className="flex flex-col items-center justify-center gap-6">
          <div className="relative w-40 h-40 sm:w-44 sm:h-44 shrink-0 select-none">
            <svg className="w-full h-full transform hover:scale-105 transition-transform duration-500" viewBox="0 0 200 200">
              {donutSlices.map((slice, idx) => (
                <path
                  key={idx}
                  d={slice.pathD}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={hoveredDonutSlice === idx ? strokeWidth + 4 : strokeWidth}
                  strokeLinecap="round"
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoveredDonutSlice(idx)}
                  onMouseLeave={() => setHoveredDonutSlice(null)}
                  onClick={() => handleDrillDown("branch", slice.name)}
                />
              ))}

              {/* Center textual metrics block */}
              <text x={donutCenter} y={donutCenter - 4} textAnchor="middle" fontSize="10px" fontWeight="medium" fill={theme.isDark ? "#94a3b8" : "#64748b"} fontFamily="monospace">
                CUMULATIVE
              </text>
              <text x={donutCenter} y={donutCenter + 12} textAnchor="middle" fontSize="12px" fontWeight="bold" fill={theme.isDark ? "#f8fafc" : "#0f172a"} fontFamily="monospace">
                {formatBDT(grandTotalSales)}
              </text>
            </svg>
          </div>

          {/* Simple right contextual legend labels */}
          <div className="flex-1 space-y-1.5 w-full min-w-0">
            {donutSlices.slice(0, 4).map((b, idx) => (
              <div 
                key={b.name} 
                className={`flex items-center justify-between p-1.5 rounded-md transition cursor-pointer ${
                  hoveredDonutSlice === idx 
                    ? theme.isDark ? "bg-slate-800 border-l-2" : "bg-slate-100 border-l-2" 
                    : "hover:bg-slate-800/10"
                }`}
                style={{ borderLeftColor: hoveredDonutSlice === idx ? b.color : "transparent" }}
                onMouseEnter={() => setHoveredDonutSlice(idx)}
                onMouseLeave={() => setHoveredDonutSlice(null)}
                onClick={() => handleDrillDown("branch", b.name)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                  <span className={`text-[11px] truncate font-semibold block ${theme.isDark ? "text-slate-300" : "text-slate-700"}`}>
                    {b.name}
                  </span>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <span className={`text-[11px] font-bold font-mono block ${theme.isDark ? "text-slate-100" : "text-slate-900"}`}>
                    {b.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CHART 3: TOP PRODUCTS AT A GLANCE (Horizontal Bar) */}
      <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} transform hover:-translate-y-0.5 transition duration-300`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <ShoppingBag size={15} className="text-[#a855f7]" />
            <h5 className={`font-bold text-[11px] sm:text-xs uppercase tracking-wide leading-relaxed ${theme.textMain}`}>
              Top Assets Portfolio
            </h5>
          </div>
          <span className={`font-mono text-[9px] ${theme.textMuted}`}>
            Lakhs/Crores metric
          </span>
        </div>

        <div className="space-y-3.5 select-none">
          {topProducts.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">No products configured</div>
          ) : (
            topProducts.map((p) => {
              const rectWidthPct = Math.min(100, Math.max(8, (p.sales / topProductMaxVal) * 100));
              return (
                <div 
                  key={p.name} 
                  className="space-y-1.5 cursor-pointer group/item"
                  onClick={() => handleDrillDown("productGroup", p.name)}
                >
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-200 font-semibold truncate max-w-[190px] group-hover/item:text-indigo-400 transition-colors" title={p.name}>
                      {p.name}
                    </span>
                    <span className="text-slate-400 font-mono shrink-0">
                      {p.quantity} Units | <strong>{formatBDT(p.sales)}</strong>
                    </span>
                  </div>

                  {/* Horizontal visual progress meter */}
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-900">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${rectWidthPct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CHART 4: TARGET ACHIEVEMENT QUOTA GAUGE */}
      <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} transform hover:-translate-y-0.5 transition duration-300`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Gauge size={15} className="text-emerald-400" />
            <h5 className={`font-bold text-[11px] sm:text-xs uppercase tracking-wide leading-relaxed ${theme.textMain}`}>
              Annual Quota Target status
            </h5>
          </div>
        </div>

        <div className="flex items-center justify-around py-3">
          <div className="relative w-36 h-28 shrink-0 overflow-hidden flex items-center justify-center">
            {/* SVG Arc Gauge */}
            <svg className="w-full h-full overflow-visible" viewBox="0 0 156 120">
              {/* Background Grey track */}
              <path
                d="M 18 95 A 60 60 0 0 1 138 95"
                fill="none"
                stroke="#1b1d28"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Highlight Actual achievement path */}
              <path
                d="M 18 95 A 60 60 0 0 1 138 95"
                fill="none"
                stroke="#10b981"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={gaugeCircumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000"
              />
              
              {/* Center percentage label */}
              <text x="78" y="78" textAnchor="middle" className="text-xl font-black font-mono" fill={theme.isDark ? "#f8fafc" : "#0f172a"}>
                {quotaPercentage.toFixed(1)}%
              </text>
              <text x="78" y="94" textAnchor="middle" className="text-[9px] font-mono font-bold tracking-tight" fill={theme.isDark ? "#64748b" : "#94a3b8"}>
                {quotaTarget > 0 ? "26.5 Crores Goal" : "No Target Setup"}
              </text>
            </svg>
          </div>

          <div className="space-y-3 text-xs min-w-0">
            <div className="leading-tight">
              <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-tight mb-1">Company Target</span>
              <span className="font-bold text-slate-100 block font-mono text-[11px]">{quotaTarget > 0 ? "৳ 26.50 Crores BDT" : "N/A"}</span>
            </div>
            <div className="leading-tight">
              <span className="text-[10px] text-emerald-400 block uppercase font-mono tracking-tight mb-1">Cumulative Sales</span>
              <span className="font-bold text-[#10b981] block font-mono text-[11px]">{formatBDT(quotaActual)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHART 5: TRANSACTION STEPS INTEGRITY FUNNEL */}
      <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} transform hover:-translate-y-0.5 transition duration-300`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <Workflow size={15} className="text-pink-400" />
            <h5 className={`font-bold text-[11px] sm:text-xs uppercase tracking-wide leading-relaxed ${theme.textMain}`}>
              Transaction Steps Funnel
            </h5>
          </div>
          <span className={`font-mono text-[9px] ${theme.textMuted}`}>
            Database Integrity
          </span>
        </div>

        <div className="space-y-3.5 select-none">
          {funnelStages.map((stage, idx) => {
            const widthPct = Math.max(30, 100 - idx * 20);
            return (
              <div key={stage.name} className="flex items-center gap-3">
                <div className="w-24 text-[10px] text-slate-400 font-semibold truncate" title={stage.desc}>
                  {stage.name}
                </div>
                
                {/* Visual Funnel Step block */}
                <div className="flex-1">
                  <div 
                    className="h-6 rounded bg-gradient-to-r from-pink-500/20 to-rose-500/30 border-l-4 border-rose-500 flex items-center px-2 shadow-sm transition-all hover:scale-102"
                    style={{ width: `${widthPct}%` }}
                  >
                    <span className="text-[10px] text-slate-200 font-mono font-bold">
                      {stage.val} Rows
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHART 6: THE HEATMAP: REGIONAL ACHIEVERS (Interactive Grid) */}
      <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} lg:col-span-1 transform hover:-translate-y-0.5 transition duration-300`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <Trophy size={15} className="text-emerald-400" />
            <h5 className={`font-bold text-[11px] sm:text-xs uppercase tracking-wide leading-relaxed ${theme.textMain}`}>
              Representative Sales Map
            </h5>
          </div>
        </div>

        {/* Heatmap Layout matrix representing Salespeople vs Product Group performance */}
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_repeat(3,auto)] gap-2 text-[9px] font-bold text-slate-500 text-center font-mono uppercase tracking-tight">
            <div className="text-left">Seller</div>
            <div>Net Sales</div>
            <div>Units</div>
            <div>Status</div>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {Object.entries(
              filteredRecords.reduce((acc, r) => {
                const name = r["Sales Person"];
                const curr = acc[name] || { sales: 0, qty: 0 };
                acc[name] = { sales: curr.sales + r["Total Price"], qty: curr.qty + r.Quantity };
                return acc;
              }, {} as Record<string, { sales: number; qty: number }>)
            )
              .sort((a,b) => b[1].sales - a[1].sales)
              .slice(0, 10)
              .map(([name, data]) => {
                const isTop = data.sales > 40000000;
                return (
                  <div 
                    key={name} 
                    className="grid grid-cols-[1fr_repeat(3,auto)] gap-2 items-center bg-slate-950/40 p-2 rounded border border-slate-900 text-[11px] text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                    onClick={() => handleDrillDown("salesPerson", name)}
                  >
                    <span className="truncate font-bold text-slate-100" title={name}>{name}</span>
                    <span className="font-mono text-[#34d399] font-bold">{formatBDT(data.sales)}</span>
                    <span className="font-mono text-center px-1">{data.qty}</span>
                    <div className="text-center">
                      {isTop ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-tighter block whitespace-nowrap">
                          Elite
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-tighter block whitespace-nowrap">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

    </div>
  );
}
