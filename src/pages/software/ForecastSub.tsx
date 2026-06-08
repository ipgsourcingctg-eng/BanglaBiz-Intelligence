import React, { useMemo } from "react";
import { 
  Calendar, LineChart as LucideLineChart, BarChart3, TrendingUp, DollarSign, 
  ArrowRight, FileSpreadsheet 
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  CartesianGrid, LineChart, Line, Legend 
} from "recharts";
import { DashboardTheme, SoftwareSubscription } from "../../types";

interface ForecastSubProps {
  subscriptions: SoftwareSubscription[];
  theme: DashboardTheme;
}

export default function ForecastSub({ subscriptions, theme }: ForecastSubProps) {
  
  // Dynamic forecast calculations relative to today
  const forecastData = useMemo(() => {
    const data: Array<{ monthName: string; monthIndex: number; year: number; rawValue: number; probabilityAdjustedValue: number }> = [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Seed next 12 months starting from current month
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      data.push({
        monthName: `${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        rawValue: 0,
        probabilityAdjustedValue: 0
      });
    }

    // Allocate subscription renewal values into appropriate future month buckets
    subscriptions.forEach(sub => {
      if (sub.status !== "Active") return; // exclude expired/lost from future pipeline forecasts
      
      const expDate = new Date(sub.expires_on);
      const diffMonths = (expDate.getFullYear() - today.getFullYear()) * 12 + (expDate.getMonth() - today.getMonth());
      
      if (diffMonths >= 0 && diffMonths < 12) {
        data[diffMonths].rawValue += sub.total_value;
        data[diffMonths].probabilityAdjustedValue += Math.round(sub.total_value * (sub.renewal_probability / 100));
      }
    });

    return data;
  }, [subscriptions]);

  const aggregates = useMemo(() => {
    // Forecast buckets:
    // 1. Current Month (Index 0)
    // 2. Next 3 Months (Index 0, 1, 2)
    // 3. Next 6 Months (Index 0 to 5)
    // 4. Next 12 Months (Index 0 to 11)
    const current = forecastData[0]?.rawValue || 0;
    const next3 = forecastData.slice(0, 3).reduce((sum, item) => sum + item.rawValue, 0);
    const next6 = forecastData.slice(0, 6).reduce((sum, item) => sum + item.rawValue, 0);
    const next12 = forecastData.reduce((sum, item) => sum + item.rawValue, 0);

    return { current, next3, next6, next12 };
  }, [forecastData]);

  const formatBDT = (val: number) => {
    let suffix = "";
    let formattedVal = "";
    if (val >= 10000000) {
      suffix = " Cr";
      formattedVal = (val / 10000000).toFixed(2);
    } else if (val >= 100000) {
      suffix = " L";
      formattedVal = (val / 100000).toFixed(1);
    } else {
      formattedVal = (val / 1000).toFixed(0);
      suffix = " K";
    }

    return `৳ ${formattedVal}${suffix}`;
  };

  const formatChartVal = (val: number) => {
    if (val >= 100000) return `${(val / 100000).toFixed(0)}L`;
    return `${(val / 1000).toFixed(0)}K`;
  };

  return (
    <div className="space-y-6">
      
      {/* Forecast Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">This Month Forecast</span>
          <h4 className="text-xl font-extrabold mt-1 text-indigo-400">{formatBDT(aggregates.current)}</h4>
          <p className="text-[9px] font-mono text-emerald-450 mt-1 flex items-center gap-1">
            Expected immediate renewals
          </p>
        </div>

        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Next 3 Months Pipeline</span>
          <h4 className="text-xl font-extrabold mt-1 text-emerald-400">{formatBDT(aggregates.next3)}</h4>
          <p className="text-[9px] font-mono text-slate-350 mt-1 flex items-center gap-1">
            Qtr aggregate renewals
          </p>
        </div>

        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Next 6 Months Projection</span>
          <h4 className="text-xl font-extrabold mt-1 text-slate-100">{formatBDT(aggregates.next6)}</h4>
          <p className="text-[9px] font-mono text-slate-350 mt-1">
            Mid-term recurring commitments
          </p>
        </div>

        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Next 12 Months Pipeline</span>
          <h4 className="text-xl font-extrabold mt-1 text-amber-500">{formatBDT(aggregates.next12)}</h4>
          <p className="text-[9px] font-mono text-slate-350 mt-1">
            Fiscal annualized target totals
          </p>
        </div>
      </div>

      {/* Forecasting Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recharts Chart Node */}
        <div className={`lg:col-span-8 p-4 sm:p-5 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-tight flex items-center gap-2">
                <BarChart3 className="text-indigo-400 w-4 h-4" /> Twelve Month Renewal Projection Area
              </h3>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">Dual-mode raw contract values vs probability weighted expectations</p>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRaw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                <XAxis dataKey="monthName" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={formatChartVal} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme.isDark ? "#0f172a" : "#ffffff", 
                    borderColor: theme.isDark ? "#1e293b" : "#e2e8f0",
                    fontSize: "11px",
                    fontWeight: 600,
                    borderRadius: "8px"
                  }}
                  formatter={(value: any) => [`৳ ${Number(value).toLocaleString()}`, ""]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
                <Area 
                  type="monotone" 
                  dataKey="rawValue" 
                  name="Raw Subscription Pool"
                  stroke="#6366f1" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRaw)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="probabilityAdjustedValue" 
                  name="Weighted Probability Forecast"
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorProb)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Forecast Table Summary inside Dashboard */}
        <div className={`lg:col-span-4 p-4 sm:p-5 rounded-xl border ${theme.bgCard} ${theme.border} flex flex-col justify-between`}>
          <div>
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5 mb-4">
              <FileSpreadsheet className="text-emerald-400 w-4 h-4" /> Renewal Ledger
            </h3>
            <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1 no-scrollbar text-xs font-mono">
              <div className="flex border-b border-slate-800/10 pb-1.5 uppercase tracking-wider text-[9px] font-bold opacity-60">
                <span className="w-1/2">Period</span>
                <span className="w-1/2 text-right">Raw Forecast</span>
              </div>
              
              {forecastData.map((item) => (
                <div key={item.monthName} className="flex justify-between py-1 border-b border-slate-700/5 hover:bg-slate-800/10 transition rounded">
                  <span className="text-slate-300 font-semibold">{item.monthName}</span>
                  <span className="font-bold text-right text-slate-250">
                    {item.rawValue > 0 ? formatBDT(item.rawValue) : "৳ 0"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-2 text-[10px] font-semibold text-center text-indigo-400 font-mono">
            Annual aggregate: {formatBDT(aggregates.next12)} BDT
          </div>
        </div>

      </div>
    </div>
  );
}
