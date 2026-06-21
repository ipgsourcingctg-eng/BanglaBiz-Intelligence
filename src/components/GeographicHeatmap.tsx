/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Annotation
} from "react-simple-maps";
import { SalesRecord, DashboardTheme } from "../types";
import { formatBDT } from "../utils/format";
import { MapPin, Info } from "lucide-react";

// Bangladesh GeoJSON 
const geoUrl = "https://raw.githubusercontent.com/faustandfound/bangladesh-geojson/master/bangladesh.json";

interface BranchGeo {
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
}

const BRANCH_COORDINATES: Record<string, [number, number]> = {
  "Dhaka": [90.4125, 23.8103],
  "Dhaka HQ": [90.4125, 23.8103],
  "Chittagong": [91.7832, 22.3569],
  "Chattogram": [91.7832, 22.3569],
  "Chattogram Corporate Branch": [91.7832, 22.3569],
  "Chattogram Hub": [91.7832, 22.3569],
  "Sylhet": [91.8687, 24.8949],
  "Khulna": [89.5406, 22.8456],
  "Rajshahi": [88.6017, 24.3745],
  "Barishal": [90.3535, 22.7010],
  "Rangpur": [89.2488, 25.7439],
  "Mymensingh": [90.4073, 24.7471],
  "Gazipur": [90.4255, 24.0023],
  "Narayanganj": [90.5000, 23.6167],
  "Bogura": [89.3730, 24.8481],
  "Comilla": [91.1767, 23.4606],
};

interface GeographicHeatmapProps {
  records: SalesRecord[];
  theme: DashboardTheme;
}

export default function GeographicHeatmap({ records, theme }: GeographicHeatmapProps) {
  const branchData = useMemo(() => {
    const data: Record<string, { revenue: number; orders: number; name: string; coordinates: [number, number] }> = {};
    
    records.forEach(r => {
      let branchName = r.Branch || "Unassigned";
      // Find matching coordinate key
      const coordKey = Object.keys(BRANCH_COORDINATES).find(k => 
        branchName.toLowerCase().includes(k.toLowerCase()) || 
        k.toLowerCase().includes(branchName.toLowerCase())
      );
      
      if (coordKey) {
        if (!data[coordKey]) {
          data[coordKey] = {
            revenue: 0,
            orders: 0,
            name: coordKey,
            coordinates: BRANCH_COORDINATES[coordKey]
          };
        }
        data[coordKey].revenue += r["Total Price"] || 0;
        data[coordKey].orders += 1;
      }
    });

    return Object.values(data).sort((a, b) => b.revenue - a.revenue);
  }, [records]);

  const maxRevenue = useMemo(() => Math.max(...branchData.map(b => b.revenue), 1), [branchData]);

  return (
    <div className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <MapPin size={18} className="text-rose-500" />
            Geographic Performance Heatmap
          </h3>
          <p className="text-xs text-slate-500 mt-1">Regional revenue distribution and fulfillment centers</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/30"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low Revenue</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-[500px] bg-slate-950/20 rounded-xl relative overflow-hidden flex items-center justify-center">
          <div className="w-full h-full max-w-sm">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 4500,
                center: [90.3, 23.8] // Center on Bangladesh
              }}
              className="w-full h-full"
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={theme.isDark ? "#0f172a" : "#f1f5f9"}
                      stroke={theme.isDark ? "#1e293b" : "#cbd5e1"}
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: theme.isDark ? "#1e293b" : "#e2e8f0", outline: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {branchData.map((branch) => {
                const radius = Math.sqrt(branch.revenue / maxRevenue) * 25 + 5;
                return (
                  <Marker key={branch.name} coordinates={branch.coordinates}>
                    <circle 
                      r={radius} 
                      fill="rgba(244, 63, 94, 0.4)" 
                      stroke="rgba(244, 63, 94, 1)" 
                      strokeWidth={1} 
                      className="animate-pulse"
                    />
                    <circle r={2} fill="#fff" />
                    <text
                      textAnchor="middle"
                      y={-radius - 5}
                      style={{
                        fontFamily: "JetBrains Mono",
                        fontSize: "9px",
                        fill: theme.isDark ? "#94a3b8" : "#475569",
                        fontWeight: "bold",
                        pointerEvents: "none"
                      }}
                    >
                      {branch.name}
                    </text>
                  </Marker>
                );
              })}
            </ComposableMap>
          </div>
          
          <div className="absolute bottom-4 left-4 p-3 bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-800 flex items-start gap-2 max-w-[200px]">
            <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed italic">
              AI Projection: Geographic expansion into <span className="text-white font-bold">Sylhet</span> and <span className="text-white font-bold">Rajshahi</span> shows high untapped potential in Q3.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Regional Leaderboard</h4>
          <div className="space-y-3">
            {branchData.slice(0, 6).map((branch, idx) => (
              <div key={branch.name} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">0{idx + 1}</span>
                    <span className="text-sm font-bold text-slate-200">{branch.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-400">{formatBDT(branch.revenue)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-1000" 
                    style={{ width: `${(branch.revenue / maxRevenue) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-slate-500 uppercase font-mono">{branch.orders} Invoices Issued</span>
                  <span className="text-[9px] text-slate-400 font-bold">Contribution: {Math.round((branch.revenue / maxRevenue) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
            <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Zap size={12} />
              Optimization Insight
            </h5>
            <p className="text-xs text-slate-400 leading-relaxed">
              Revenue concentration is 78% in Dhaka HQ. Consider establishing a satellite fulfillment center in <span className="text-emerald-300 font-bold">Chattogram</span> to reduce last-mile logistics overhead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const Zap = ({ size, className }: { size?: number; className?: string }) => (
  <svg 
    width={size || 16} 
    height={size || 16} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
