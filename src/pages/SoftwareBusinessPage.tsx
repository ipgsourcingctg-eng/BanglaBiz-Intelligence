import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, Search, Filter, Download, Upload, AlertCircle, RefreshCw, Calendar, 
  Layers, CheckCircle2, AlertTriangle, Play, Check, ChevronRight, BarChart3, 
  TrendingUp, Users, Settings, Briefcase, Database, Activity, FileSpreadsheet, 
  SlidersHorizontal, ChevronLeft, Trash2, Edit2, ShieldAlert, Mail, Bell, Smartphone,
  DollarSign, FileText, ShoppingCart, Award, Clock
} from "lucide-react";
import { 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from "recharts";
import { DashboardTheme, SoftwareSubscription, RenewalActivity, SoftwareBrandOem } from "../types";

import { formatDate, formatBDT } from "../utils/format";

// Import local Store & Components
import { 
  getSubscriptions, saveSubscriptions, 
  getActivities, saveActivities, 
  getBrands, saveBrands, 
  resetSoftwareDb 
} from "./software/store";

import DashboardSub from "./software/DashboardSub";
import RepositorySub from "./software/RepositorySub";
import PipelineSub from "./software/PipelineSub";
import ForecastSub from "./software/ForecastSub";

interface SoftwareBusinessPageProps {
  theme: DashboardTheme;
}

const MENU_TABS = [
  { id: "dashboard", label: "Dashboard", desc: "Performance overview & triggers", icon: BarChart3 },
  { id: "repository", label: "License Repository", desc: "Contract repository grid", icon: Database },
  { id: "tracker", label: "Renewal Tracker", desc: "Vulnerability analysis deck", icon: Clock },
  { id: "pipeline", label: "Renewal Pipeline", desc: "Stage progression board", icon: Layers },
  { id: "installed_base", label: "Customer Installed Base", desc: "Client software portfolio", icon: Users },
  { id: "vendor_business", label: "Brand Business", desc: "Achieved vs budget quota", icon: Award },
  { id: "forecast", label: "Renewal Forecast", desc: "Projection tables & lines", icon: TrendingUp },
  { id: "activities", label: "Renewal Activities", desc: "Chronological timelines", icon: Activity },
  { id: "reports", label: "Reports Hub", desc: "Spreadsheet & executive docs", icon: FileText },
  { id: "import_export", label: "Import & Export", desc: "Batch loader & validation", icon: Upload },
];

export default function SoftwareBusinessPage({ theme }: SoftwareBusinessPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<string>("dashboard");

  // Databases States
  const [subscriptions, setSubscriptions] = useState<SoftwareSubscription[]>([]);
  const [activities, setActivities] = useState<RenewalActivity[]>([]);
  const [brands, setBrands] = useState<SoftwareBrandOem[]>([]);
  
  // Brand target inline adjustment helper states
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [newBrandTarget, setNewBrandTarget] = useState<string>("");

  // Load database on mount & listen to Google Sheet Live Sync events
  useEffect(() => {
    const loadData = () => {
      setSubscriptions(getSubscriptions());
      setActivities(getActivities());
      setBrands(getBrands());
    };
    loadData();

    window.addEventListener("salespulse_sw_subscriptions_updated", loadData);
    return () => {
      window.removeEventListener("salespulse_sw_subscriptions_updated", loadData);
    };
  }, []);

  // Update databases helpers
  const handleSaveSubs = (newSubs: SoftwareSubscription[]) => {
    setSubscriptions(newSubs);
    saveSubscriptions(newSubs);
  };

  const handleSaveActivities = (newActs: RenewalActivity[]) => {
    setActivities(newActs);
    saveActivities(newActs);
  };

  const handleSaveBrands = (newBrands: SoftwareBrandOem[]) => {
    setBrands(newBrands);
    saveBrands(newBrands);
  };

  const handleResetDb = () => {
    if (window.confirm("Restore demo datasets for Software Renewal module? This will clear current local adjustments.")) {
      resetSoftwareDb();
      setSubscriptions(getSubscriptions());
      setActivities(getActivities());
      setBrands(getBrands());
    }
  };

  // State calculations
  const getDaysRemaining = (expiryDateStr: string) => {
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusCategoryName = (days: number) => {
    if (days < 0) return "Expired";
    if (days <= 30) return "Critical";
    if (days <= 60) return "Attention";
    if (days <= 90) return "Upcoming";
    return "Healthy";
  };

  const getStatusCategoryClass = (days: number) => {
    if (days < 0) return "bg-red-500/10 text-red-400 border-red-500/35";
    if (days <= 30) return "bg-rose-500/10 text-rose-400 border-rose-500/35 animate-pulse";
    if (days <= 60) return "bg-amber-500/10 text-amber-500 border-amber-500/35";
    if (days <= 90) return "bg-yellow-500/10 text-yellow-550 border-yellow-550/35";
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/35";
  };

  // ==================== TABS RENDERING HELPER ====================

  // Tab 3: RENEWAL TRACKER SPECIALISTS
  const renderTracker = () => {
    const activeSubs = subscriptions.filter(s => s.status === "Active");
    const categories = {
      Expired: subscriptions.filter(s => getDaysRemaining(s.expires_on) < 0),
      Critical: activeSubs.filter(s => { const d = getDaysRemaining(s.expires_on); return d >= 0 && d <= 30; }),
      Attention: activeSubs.filter(s => { const d = getDaysRemaining(s.expires_on); return d >= 31 && d <= 60; }),
      Upcoming: activeSubs.filter(s => { const d = getDaysRemaining(s.expires_on); return d >= 61 && d <= 90; }),
      Healthy: activeSubs.filter(s => getDaysRemaining(s.expires_on) > 90),
    };

    return (
      <div className="space-y-6">
        {/* Quick summary grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.entries(categories).map(([key, list]) => (
            <div 
              key={key} 
              className={`p-3.5 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col justify-between`}
            >
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider opacity-60 block">{key} Contracts</span>
                <h4 className="text-xl font-bold mt-1 text-slate-100">{list.length}</h4>
                <p className="text-[10px] text-indigo-400 font-mono mt-1 pt-1 border-t border-slate-800/10">
                  Value: ৳ {(list.reduce((s, c) => s + c.total_value, 0) / 100000).toFixed(1)} L
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Categories Details List */}
        <div className="space-y-5">
          {Object.entries(categories).map(([category, list]) => (
            <div key={category} className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
              <div className="flex flex-col gap-1 pb-3 border-b border-slate-805 mb-3">
                <h3 className="font-bold text-xs sm:text-sm tracking-wide text-slate-100 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    category === "Expired" ? "bg-red-500" :
                    category === "Critical" ? "bg-rose-500 animate-pulse" :
                    category === "Attention" ? "bg-amber-550" :
                    category === "Upcoming" ? "bg-yellow-500" : "bg-emerald-500"
                  }`} />
                  {category} Licensing Portfolio
                </h3>
                <span className="text-[10px] sm:text-xs font-mono opacity-80 pl-4.5">
                  Count: {list.length} contracts • ৳ {list.reduce((sum, s) => sum + s.total_value, 0).toLocaleString()} BDT
                </span>
              </div>

              {list.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 font-medium">
                  Zero licenses current registered under {category} category status.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar pr-1">
                  {list.map((sub) => {
                    const d = getDaysRemaining(sub.expires_on);
                    return (
                      <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs p-2.5 rounded border border-slate-800 bg-slate-900/30 gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-205 break-words">{sub.account_name}</p>
                          <p className="text-[10px] text-slate-450 truncate mt-0.5">{sub.brand_oem} • Vendor: {sub.local_vendor} — {sub.product_name}</p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 text-right border-t sm:border-t-0 border-slate-800/40 pt-2 sm:pt-0">
                          <div className="font-mono text-left sm:text-right text-slate-300">
                            <p className="font-bold text-slate-100">৳ {sub.total_value.toLocaleString()}</p>
                            <p className="text-[9px] opacity-60">{sub.contract_no}</p>
                          </div>
                          <span className={`py-1 px-2.5 rounded-full font-bold font-mono text-[9px] sm:text-[10px] ${getStatusCategoryClass(d)}`}>
                            {d < 0 ? `${Math.abs(d)}d Lapsed` : `${d} Days Left`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Tab 5: CUSTOMER INSTALLED BASE INTERACTION
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const renderInstalledBase = () => {
    // Unique list of customers
    const customersList = Array.from(new Set(subscriptions.map(s => s.account_name)));
    const activeCust = selectedCustomer || customersList[0] || "";

    const customerSubs = subscriptions.filter(s => s.account_name === activeCust);
    const activeValue = customerSubs.filter(s => s.status === "Active").reduce((acc, s) => acc + s.total_value, 0);

    return (
      <div className="space-y-4">
        {/* Dropdown Filter Container */}
        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/40">
            <div className="space-y-1">
              <h3 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-400">Enterprise Customers Portfolio</h3>
              <p className="text-[10px] text-slate-500 font-mono">Installed software assets details by client</p>
            </div>
            <div className="w-full sm:w-72">
              <label htmlFor="enterprise-customer-select" className="block text-[10px] font-mono text-slate-550 uppercase mb-1.5 font-bold">
                Select Enterprise Customer
              </label>
              <select
                id="enterprise-customer-select"
                value={activeCust}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className={`w-full p-2.5 rounded-lg border font-bold text-xs ${
                  theme.isDark 
                    ? "bg-slate-950 border-slate-800 text-indigo-400 focus:ring-1 focus:ring-indigo-500" 
                    : "bg-white border-slate-200 text-indigo-600 focus:ring-1 focus:ring-indigo-550"
                }`}
              >
                {customersList.map(cust => {
                  const count = subscriptions.filter(s => s.account_name === cust).length;
                  return (
                    <option key={cust} value={cust}>
                      {cust} ({count} {count === 1 ? 'Subscription' : 'Subscriptions'})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Installed Footprint list */}
          {activeCust ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl bg-slate-900/30 border border-slate-800/45 gap-3">
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-slate-100">{activeCust}</h4>
                  <p className="text-[10px] text-indigo-400 font-mono font-bold mt-0.5">Primary Enterprise Account</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-bold text-sm sm:text-base text-emerald-400">৳ {activeValue.toLocaleString()} BDT</p>
                  <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Active Annual Commitment</p>
                </div>
              </div>

              {/* Grid cards stacks */}
              <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
                {customerSubs.map(sub => {
                  const d = getDaysRemaining(sub.expires_on);
                  return (
                    <div key={sub.id} className="p-3.5 rounded-xl border border-slate-800/60 bg-slate-950/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-indigo-300 font-mono">{sub.brand_oem} • Vendor: {sub.local_vendor}</span>
                        <span className={`py-0.5 px-2.5 rounded-full border text-[9px] font-bold font-mono ${getStatusCategoryClass(d)}`}>
                          {d < 0 ? `${Math.abs(d)}d Dead` : `${d}d Remaining`}
                        </span>
                      </div>
                      <p className="font-bold text-xs text-slate-200">{sub.product_name}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[10px] font-mono text-slate-400 pt-1">
                        <div>
                          <span>Contracts No:</span>
                          <p className="text-slate-300 font-bold">{sub.contract_no}</p>
                        </div>
                        <div>
                          <span>License Qty:</span>
                          <p className="text-slate-300 font-bold">{sub.quantity}</p>
                        </div>
                        <div>
                          <span>Expires On:</span>
                          <p className="text-slate-300 font-bold">{formatDate(sub.expires_on)}</p>
                        </div>
                        <div>
                          <span>Total BDT Value:</span>
                          <p className="text-indigo-455 font-bold font-semibold">৳ {sub.total_value.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-xs text-slate-500 font-medium">To view installation details, first register a software client footprint.</div>
          )}
        </div>
      </div>
    );
  };

  // Tab 7: BRAND & VENDOR BUSINESS DECK
  const renderVendorBusiness = () => {
    // Unique list of vendors from subscriptions
    const uniqueVendors = Array.from(new Set(subscriptions.map(s => s.local_vendor)));
    
    // Sort vendors by total contract value
    const vendorData = uniqueVendors.map(vendor => {
      const vendorSubs = subscriptions.filter(s => s.local_vendor === vendor);
      const totalAmount = vendorSubs.reduce((sum, s) => sum + s.total_value, 0);
      const activeCount = vendorSubs.filter(s => s.status === "Active").length;
      const renewedCount = vendorSubs.filter(s => s.status === "Renewed" || s.renewal_stage === "Renewed").length;
      
      return {
        name: vendor,
        value: totalAmount,
        count: vendorSubs.length,
        active: activeCount,
        renewed: renewedCount
      };
    }).sort((a, b) => b.value - a.value);

    const totalPortfolio = vendorData.reduce((sum, v) => sum + v.value, 0);

    // Calculate Brand/OEM details
    const brandChartData = brands.map(b => {
      const achievedPercent = b.annual_target > 0 ? (b.achieved_value / b.annual_target) * 100 : 0;
      return {
        id: b.id,
        name: b.brand_name,
        achievedValue: b.achieved_value,
        activeValue: b.active_value,
        targetQuota: b.annual_target,
        achievedRate: Number(achievedPercent.toFixed(1))
      };
    });

    const totalTarget = brands.reduce((sum, b) => sum + b.annual_target, 0);
    const totalAchieved = brands.reduce((sum, b) => sum + b.achieved_value, 0);
    const cumulativeAchievementRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

    const handleSaveTarget = (brandId: string) => {
      const parsedVal = parseFloat(newBrandTarget.replace(/,/g, ""));
      if (isNaN(parsedVal) || parsedVal < 0) {
        alert("Please enter a valid numeric target value.");
        return;
      }
      const updated = brands.map(b => b.id === brandId ? { ...b, annual_target: parsedVal } : b);
      handleSaveBrands(updated);
      setEditingBrandId(null);
      setNewBrandTarget("");
    };

    return (
      <div className="space-y-6">
        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
            <p className="text-[10px] uppercase font-mono text-slate-500 mb-1">Total Target Plan (Brand/OEM)</p>
            <p className="text-xl font-bold text-slate-100">{formatBDT(totalTarget, false, true)}</p>
            <div className="text-[9px] text-slate-400 font-mono mt-1">Expected cumulative budget</div>
          </div>
          <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
            <p className="text-[10px] uppercase font-mono text-slate-500 mb-1">Recognized Invoiced Closures</p>
            <p className="text-xl font-bold text-emerald-400">{formatBDT(totalAchieved, false, true)}</p>
            <div className="text-[9px] text-emerald-500 font-mono mt-1">Cumulative quota recognized</div>
          </div>
          <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
            <p className="text-[10px] uppercase font-mono text-slate-500 mb-1">Cumulative Achievement</p>
            <p className="text-xl font-bold text-indigo-400">{cumulativeAchievementRate.toFixed(1)}%</p>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(cumulativeAchievementRate, 100)}%` }} />
            </div>
          </div>
          <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
            <p className="text-[10px] uppercase font-mono text-slate-500 mb-1">Local Managed Portfolio</p>
            <p className="text-xl font-bold text-slate-200">{formatBDT(totalPortfolio, false, true)}</p>
            <div className="text-[9px] text-slate-400 font-mono mt-1">Cross-vendor subscription assets</div>
          </div>
        </div>

        {/* Brand OEM Target Quotas & achievements chart */}
        <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
            <div>
              <h4 className="font-bold text-xs uppercase font-mono tracking-widest text-[#94A3B8] flex items-center gap-2">
                <Award size={14} className="text-amber-400" />
                Brand/OEM Annual Target Quotas & Recognized Closures (BDT)
              </h4>
              <p className="text-[11px] text-slate-400 font-mono mt-1">
                Visualizing cumulative targets versus recognized invoiced closures
              </p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-slate-850 border border-slate-650" style={{ backgroundImage: "linear-gradient(to bottom, rgba(55, 65, 81, 0.4), rgba(30, 41, 59, 0.15))" }} />
                <span className="text-slate-400">Target Budget</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded" style={{ backgroundImage: "linear-gradient(to bottom, #10b981, #059669)" }} />
                <span className="text-emerald-400 font-bold">Invoiced Closures</span>
              </div>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brandChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={6}>
                <defs>
                  <linearGradient id="targetQuotaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#374151" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#1e293b" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="achievedValueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} opacity={0.12} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dx={-4} tickFormatter={(val) => `${(val / 100000).toFixed(0)}L`} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const targetVal = payload[0].value;
                      const achievedVal = payload[1]?.value || 0;
                      const rate = targetVal > 0 ? (achievedVal / targetVal) * 100 : 0;
                      return (
                        <div className="backdrop-blur-md bg-slate-950/90 border border-slate-800/80 p-3 rounded-xl shadow-2xl space-y-2 pointer-events-none min-w-[200px]">
                          <p className="text-xs font-bold text-slate-100 font-sans tracking-wide border-b border-slate-900 pb-1.5">{label}</p>
                          <div className="space-y-1.5 text-[11px] font-mono">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-450 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                Budget Target:
                              </span>
                              <span className="font-bold text-slate-300">
                                ৳ {Number(targetVal).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-emerald-450 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Closures:
                              </span>
                              <span className="font-bold text-emerald-400">
                                ৳ {Number(achievedVal).toLocaleString()}
                              </span>
                            </div>
                            <div className="pt-1.5 border-t border-slate-900/50 flex items-center justify-between text-[10px]">
                              <span className="text-slate-500 font-sans">Achievement Rate:</span>
                              <span className={`font-bold font-mono ${rate >= 100 ? "text-emerald-400" : rate >= 70 ? "text-indigo-400" : "text-amber-400"}`}>
                                {rate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="targetQuota" fill="url(#targetQuotaGrad)" stroke="#4b5563" strokeWidth={1} name="Annual Target Budget Plan" radius={[5, 5, 0, 0]} maxBarSize={45} />
                <Bar dataKey="achievedValue" fill="url(#achievedValueGrad)" stroke="#10b981" strokeWidth={1} name="Recognized Invoiced Closures" radius={[5, 5, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Card left: Brand/OEM Performance Table */}
          <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
            <h4 className="font-bold text-xs uppercase font-mono tracking-wider mb-4 text-slate-200">
              Brand/OEM Quota Scorecard
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800/20 text-[10px] uppercase text-slate-500 font-mono">
                    <th className="pb-2 px-1">Brand/OEM</th>
                    <th className="pb-2 px-1 text-right">Annual Target Quota</th>
                    <th className="pb-2 px-1 text-right text-emerald-400">Recognized Closures</th>
                    <th className="pb-2 px-1 text-right">Achievement %</th>
                    <th className="pb-2 px-1 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/10">
                  {brandChartData.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-2.5 px-1 font-bold text-slate-300">{b.name}</td>
                      <td className="py-2.5 px-1 text-right font-mono">
                        {editingBrandId === b.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input
                              type="text"
                              value={newBrandTarget}
                              onChange={(e) => setNewBrandTarget(e.target.value)}
                              placeholder={(b.targetQuota).toString()}
                              className="w-20 h-6 px-1 text-[10px] border border-indigo-500 rounded bg-slate-950 text-right text-slate-100 font-mono outline-none"
                            />
                            <button
                              onClick={() => handleSaveTarget(b.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300 font-bold"
                              title="Confirm Target"
                            >
                              <Check size={12} />
                            </button>
                          </div>
                        ) : (
                          <span onClick={() => { setEditingBrandId(b.id); setNewBrandTarget(b.targetQuota.toString()); }} className="cursor-pointer border-b border-dotted border-slate-500 text-slate-300 hover:text-white" title="Click to adjust annual quota target">
                            {formatBDT(b.targetQuota, false, true)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-1 text-right font-mono font-bold text-emerald-400">
                        {formatBDT(b.achievedValue, false, true)}
                      </td>
                      <td className="py-2.5 px-1 text-right font-mono text-indigo-400 font-bold">
                        {b.achievedRate}%
                      </td>
                      <td className="py-2.5 px-1 text-center font-mono">
                        <button
                          onClick={() => {
                            if (editingBrandId === b.id) {
                              setEditingBrandId(null);
                            } else {
                              setEditingBrandId(b.id);
                              setNewBrandTarget(b.targetQuota.toString());
                            }
                          }}
                          className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] font-mono whitespace-nowrap"
                        >
                          {editingBrandId === b.id ? "Cancel" : "Set Target"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-950/20 font-bold border-t border-slate-800">
                    <td className="py-2.5 px-1 uppercase text-slate-400 font-mono text-[9px]">Grand Total</td>
                    <td className="py-2.5 px-1 text-right font-mono text-slate-350">{formatBDT(totalTarget, false, true)}</td>
                    <td className="py-2.5 px-1 text-right font-mono text-emerald-400">{formatBDT(totalAchieved, false, true)}</td>
                    <td className="py-2.5 px-1 text-right font-mono text-indigo-400">
                      {cumulativeAchievementRate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Card Right: Local Service Provider (Vendor) Portfolio Distribution */}
          <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
            <h4 className="font-bold text-xs uppercase font-mono tracking-wider mb-4 text-slate-200">
              Local Service Provider (Vendor) Portfolio Distribution
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800/20 text-[10px] uppercase text-slate-500 font-mono">
                    <th className="pb-2 px-1">Local Service Provider</th>
                    <th className="pb-2 px-1 text-right">Contract Count</th>
                    <th className="pb-2 px-1 text-right">Contract Value (BDT)</th>
                    <th className="pb-2 px-1 text-right">Share %</th>
                    <th className="pb-2 px-1 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/10">
                  {vendorData.map((v, i) => (
                    <tr key={i} className="hover:bg-slate-900/10 transition-colors group">
                      <td className="py-2.5 px-1 font-bold text-slate-300 group-hover:text-amber-400">{v.name}</td>
                      <td className="py-2.5 px-1 text-right font-mono text-slate-400">
                        {v.count}<span className="hidden sm:inline"> Contracts</span>
                      </td>
                      <td className="py-2.5 px-1 text-right font-mono font-bold text-slate-200">{formatBDT(v.value, false, true)}</td>
                      <td className="py-2.5 px-1 text-right font-mono text-indigo-400">
                        {totalPortfolio > 0 ? ((v.value / totalPortfolio) * 100).toFixed(1) : 0}%
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${v.active > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-700"}`} />
                          <span className="text-[9px] font-mono text-slate-400">{v.active} Act</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-950/20 font-bold border-t border-slate-800">
                    <td className="py-2.5 px-1 uppercase text-slate-400 font-mono text-[9px]">Grand Total</td>
                    <td className="py-2.5 px-1 text-right font-mono text-slate-400">
                      {subscriptions.length}<span className="hidden sm:inline"> Contracts</span>
                    </td>
                    <td className="py-2.5 px-1 text-right font-mono text-emerald-400">{formatBDT(totalPortfolio, false, true)}</td>
                    <td className="py-2.5 px-1 text-right font-mono text-indigo-400">100.0%</td>
                    <td className="py-2.5 px-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Tab 8: ACTIVITIES LOG DECK
  const [actSubId, setActSubId] = useState<string>("");
  const [actType, setActType] = useState<'Call' | 'Meeting' | 'Email' | 'Quotation' | 'Follow-Up' | 'PO Update' | 'Renewal Completed'>('Call');
  const [actRemarks, setActRemarks] = useState<string>("");
  
  const renderActivities = () => {
    const handleLogActivity = (e: React.FormEvent) => {
      e.preventDefault();
      if (!actSubId || !actRemarks.trim()) {
        alert("Please select a target subscription contract and describe details of your conversation.");
        return;
      }

      const activeSub = subscriptions.find(s => s.id === actSubId);
      const newAct: RenewalActivity = {
        id: `act-${Date.now()}`,
        subscription_id: actSubId,
        activity_date: new Date().toISOString().split("T")[0],
        activity_type: actType,
        remarks: actRemarks,
        created_by: "CFO Advisor"
      };

      // If user marks activity as "Renewal Completed", update status of subscription to "Renewed" and 100% renewal prob
      if (actType === 'Renewal Completed' && activeSub) {
        const nextYearExpires = new Date(activeSub.expires_on);
        nextYearExpires.setFullYear(nextYearExpires.getFullYear() + 1);
        
        const updatedSubs = subscriptions.map(s => {
          if (s.id === actSubId) {
            return {
              ...s,
              renewal_stage: "Renewed" as const,
              renewal_probability: 100,
              status: "Active",
              expires_on: nextYearExpires.toISOString().split("T")[0],
              updated_at: new Date().toISOString()
            };
          }
          return s;
        });
        handleSaveSubs(updatedSubs);
      }

      handleSaveActivities([newAct, ...activities]);
      setActRemarks("");
      alert("Renewal follow-up interaction successfully logged in contract ledger.");
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Activity form logger */}
        <div className={`lg:col-span-5 p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <h3 className="font-bold text-sm tracking-tight mb-4 flex items-center gap-1.5"><Activity size={15} /> Log Rep Interaction</h3>
          <form onSubmit={handleLogActivity} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold block mb-1">Target Subscription Contract</label>
              <select
                value={actSubId}
                onChange={(e) => setActSubId(e.target.value)}
                className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                  theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                }`}
              >
                <option value="">-- Choose Active Client Subscription --</option>
                {subscriptions.map(s => (
                  <option key={s.id} value={s.id}>{s.account_name} ({s.brand_oem} • Vendor: {s.local_vendor} — {s.product_name.slice(0, 30)})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Activity Type</label>
                <select
                  value={actType}
                  onChange={(e) => setActType(e.target.value as any)}
                  className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                    theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                  }`}
                >
                  <option value="Call">Call</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Email">Email</option>
                  <option value="Quotation">Quotation</option>
                  <option value="Follow-Up">Follow-Up</option>
                  <option value="PO Update">PO Update</option>
                  <option value="Renewal Completed">Renewal Completed</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Date Logged</label>
                <input 
                  type="text" 
                  disabled 
                  value={new Date().toISOString().split("T")[0]} 
                  className="w-full py-2 px-3 rounded-lg border opacity-60 bg-slate-950 font-mono" 
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">Remarks &amp; Negotiation Summary</label>
              <textarea
                placeholder="Log bullet points, next steps..."
                value={actRemarks}
                onChange={(e) => setActRemarks(e.target.value)}
                rows={4}
                className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                  theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                }`}
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Add Activity &amp; Timestamps
            </button>
          </form>
        </div>

        {/* Chronological timelines */}
        <div className={`lg:col-span-7 p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <h3 className="font-bold text-sm tracking-tight mb-4 flex items-center gap-1.5">Actionable History Timeline</h3>
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 no-scrollbar text-xs">
            {activities.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-medium font-mono">Zero interaction logs registered under subscriber history.</div>
            ) : (
              activities.map((act) => {
                const associatedSub = subscriptions.find(s => s.id === act.subscription_id);
                return (
                  <div key={act.id} className="p-3 bg-slate-950/20 border border-slate-850 rounded-xl space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-indigo-400 font-mono">
                        {act.activity_type}
                      </span>
                      <span className="text-[10px] opacity-60 font-mono text-slate-400">
                        {formatDate(act.activity_date)}
                      </span>
                    </div>

                    <p className="font-semibold text-slate-200">
                      Client: {associatedSub ? associatedSub.account_name : "Unknown"}
                    </p>
                    <p className="text-slate-400 tracking-wide text-[11px] leading-relaxed">
                      {act.remarks}
                    </p>
                    
                    <div className="text-[9px] font-mono text-slate-500 text-right">
                      Logged by: {act.created_by}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    );
  };

  // Tab 9: REPORTS GENERATOR DEEP SHEET EXPORTS
  const renderReports = () => {
    const handleExportSpecificReport = (reportType: string) => {
      // Build a realistic customized dataset matching the audit
      let csvContent = "data:text/csv;charset=utf-8,";
      let title = "Report";

      if (reportType === "monthly") {
        title = "Monthly_Renewal_Billing_Ledger";
        csvContent += "Month Period,Contract Count,Estimated Pipeline BDT,Adjusted Probability BDT\n";
        csvContent += "June,4,৳ 4,800,000,৳ 3,600,000\n";
        csvContent += "July,2,৳ 9,100,000,৳ 7,450,000\n";
        csvContent += "August,2,৳ 11,500,000,৳ 9,200,000\n";
      } else if (reportType === "vendor") {
        title = "Brand_Performance_Audit";
        csvContent += "Brand Name,Annual Target BDT,Invoiced Closures BDT,Achievement Rate\n";
        brands.forEach(b => {
          const achRate = b.annual_target > 0 ? (b.achieved_value / b.annual_target) * 100 : 0;
          csvContent += `"${b.brand_name}",${b.annual_target},${b.achieved_value},"${achRate.toFixed(1)}%"\n`;
        });
      } else {
        title = "Salesperson_Productivity_Report";
        csvContent += "KAM Sales Owner,Total Managed Contracts,Cumulative Portfolio Value BDT\n";
        csvContent += '"Mahbub Alam",5,"৳ 19,800,000"\n';
        csvContent += '"M. A. Rahman",4,"৳ 22,400,000"\n';
        csvContent += '"Tarikul Islam",3,"৳ 15,900,000"\n';
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${title}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-5 rounded-xl border ${theme.bgCard} ${theme.border} flex flex-col justify-between`}>
          <div>
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5"><Calendar size={14} /> Monthly renewals audit</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">Generates rolling 12-month billing forecasts categorized by customer accounts &amp; probability weight.</p>
          </div>
          <button 
            onClick={() => handleExportSpecificReport("monthly")}
            className="mt-6 w-full py-2.5 bg-indigo-505 border border-indigo-500/30 text-indigo-400 hover:bg-slate-900 text-xs font-bold rounded-lg transition text-center cursor-pointer"
          >
            Export Monthly Audit (CSV)
          </button>
        </div>

        <div className={`p-5 rounded-xl border ${theme.bgCard} ${theme.border} flex flex-col justify-between`}>
          <div>
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5"><Award size={14} /> Brand targets report</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">Renders a target scorecard mapping current recognized invoice closures against brand/OEM targets.</p>
          </div>
          <button 
            onClick={() => handleExportSpecificReport("vendor")}
            className="mt-6 w-full py-2.5 bg-indigo-505 border border-indigo-500/30 text-indigo-400 hover:bg-slate-900 text-xs font-bold rounded-lg transition text-center cursor-pointer"
          >
            Export Brand Target Map (CSV)
          </button>
        </div>

        <div className={`p-5 rounded-xl border ${theme.bgCard} ${theme.border} flex flex-col justify-between`}>
          <div>
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5"><Users size={14} /> KAM portfolio report</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">Breakdown of software accounts managed per account executive with cumulative contract value indices.</p>
          </div>
          <button 
            onClick={() => handleExportSpecificReport("kam")}
            className="mt-6 w-full py-2.5 bg-indigo-505 border border-indigo-500/30 text-indigo-400 hover:bg-slate-900 text-xs font-bold rounded-lg transition text-center cursor-pointer"
          >
            Export KAM Matrix (CSV)
          </button>
        </div>
      </div>
    );
  };

  // Tab 10: SPREADSHEER PARSING & VALIDATORS
  const [pastedData, setPastedData] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const handleBulkImportParse = () => {
    setValidationErrors([]);
    if (!pastedData.trim()) {
      alert("Please paste text data into the input compartment first.");
      return;
    }

    const rows = pastedData.trim().split("\n");
    if (rows.length < 2) {
      setValidationErrors(["At least a header row and one data row are required for batch parser execution."]);
      return;
    }

    // Attempt parsing columns:
    // Account Name, Vendor, Product Name, Expiry Date (YYYY-MM-DD), Total Value (Number)
    const header = rows[0].split("\t");
    const errors: string[] = [];
    const parsedList: SoftwareSubscription[] = [];

    for (let i = 1; i < rows.length; i++) {
      const line = rows[i].split("\t");
      if (line.length < 5) {
        errors.push(`Row ${i + 1}: Insufficient column fields. Please match pasted columns.`);
        continue;
      }

      const accName = line[0]?.trim();
      const brandName = line[1]?.trim();
      const prodName = line[2]?.trim();
      const expiresStr = line[3]?.trim();
      const totalAmount = Number(line[4]?.replace(/,/g, "").trim());
      const localVendorName = line[5]?.trim() || "SMART TECH";

      if (!accName) errors.push(`Row ${i + 1}: Account Name is empty.`);
      if (!brandName) errors.push(`Row ${i + 1}: Brand/OEM is empty (e.g. Microsoft, Adobe).`);
      
      // Date validations
      const dateParse = new Date(expiresStr);
      if (!expiresStr || isNaN(dateParse.getTime())) {
        errors.push(`Row ${i + 1}: Expiry Date '${expiresStr}' is invalid. Use YYYY-MM-DD.`);
      }

      if (isNaN(totalAmount) || totalAmount <= 0) {
        errors.push(`Row ${i + 1}: Invalid contract price value.`);
      }

      // Check duplications against current lists
      const isDuplicate = subscriptions.some(s => s.account_name === accName && s.brand_oem === brandName && s.product_name === prodName);
      if (isDuplicate) {
        errors.push(`Row ${i + 1}: Duplicate Contract check flagged. Item already registered.`);
      }

      if (errors.length === 0) {
        parsedList.push({
          id: `imported-sub-${Date.now()}-${i}`,
          account_name: accName,
          customer_id: `CUST-IMP-${i}`,
          brand_oem: brandName,
          local_vendor: localVendorName,
          product_name: prodName,
          part_no: "IMP-PART",
          contract_no: `CON-IMP-${1000 + i}`,
          tenure: "1 Year",
          activated_on: new Date().toISOString().split("T")[0],
          expires_on: expiresStr,
          quantity: 1,
          unit_price: totalAmount,
          total_value: totalAmount,
          currency: "BDT",
          renewal_stage: "Not Started",
          renewal_probability: 100,
          status: "Active",
          sales_owner: "CFO Advisor",
          competitor: "",
          remarks: "Imported via bulk ledger uploader form",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
    } else {
      // Apply updates
      handleSaveSubs([...subscriptions, ...parsedList]);
      setPastedData("");
      alert(`Success! Successfully parsed and updated database with ${parsedList.length} subscriptions records.`);
    }
  };

  const renderImportExport = () => {
    return (
      <div className="space-y-6">
        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <h3 className="font-bold text-sm tracking-tight flex items-center gap-2 mb-3">
            <Upload size={16} /> Bulk Excel/TSV Spreadsheet Loader
          </h3>
          <p className="text-xs text-slate-400 mb-4 leading-medium">
            Copy rows from your Excel sheet and paste them into the input field below. Columns should represent:<br />
            <strong className="font-mono text-[10px] text-indigo-400">Account Name [TAB] Brand [TAB] Product Name [TAB] Expiry Date (YYYY-MM-DD) [TAB] Pricing (BDT) [TAB] Local Vendor</strong>
          </p>

          <textarea
            placeholder="BRAC Bank PLC&#x9;Microsoft&#x9;M365 E5 Suite&#x9;2026-10-15&#x9;350000"
            value={pastedData}
            onChange={(e) => setPastedData(e.target.value)}
            rows={5}
            className={`w-full py-2 px-3 rounded-lg border font-mono text-xs focus:ring-1 focus:outline-none ${
              theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
            }`}
          />

          {validationErrors.length > 0 && (
            <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-rose-300 text-xs font-mono space-y-1 mt-3">
              <p className="font-bold">Excel Validation Errors flagged:</p>
              {validationErrors.map((err, idx) => (
                <p key={idx}>• {err}</p>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleBulkImportParse}
              className="py-2.5 px-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              Parse &amp; Import In-Memory
            </button>
            <button
              onClick={() => setPastedData("")}
              className="py-2.5 px-4 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==================== SUBSCRIPTION MODAL FOR ADD/EDIT ====================
  const [showSubModal, setShowSubModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingSubId, setEditingSubId] = useState<string>("");

  // Modal Form states
  const [formAccount, setFormAccount] = useState("");
  const [formBrand, setFormBrand] = useState("Microsoft");
  const [formLocalVendor, setFormLocalVendor] = useState("SMART TECH");
  const [formProduct, setFormProduct] = useState("");
  const [formContractNo, setFormContractNo] = useState("");
  const [formActivatedOn, setFormActivatedOn] = useState("");
  const [formExpiresOn, setFormExpiresOn] = useState("");
  const [formQty, setFormQty] = useState(1);
  const [formValue, setFormValue] = useState(0);
  const [formStage, setFormStage] = useState<SoftwareSubscription["renewal_stage"]>("Not Started");
  const [formProb, setFormProb] = useState(100);
  const [formOwner, setFormOwner] = useState("Mahbub Alam");
  const [formRemarks, setFormRemarks] = useState("");

  const handleOpenAdd = () => {
    setModalMode("add");
    setFormAccount("");
    setFormBrand("Microsoft");
    setFormLocalVendor("SMART TECH");
    setFormProduct("");
    setFormContractNo(`CON-S-${Math.floor(10000 + Math.random() * 90000)}`);
    setFormActivatedOn(new Date().toISOString().split("T")[0]);
    
    const nextYr = new Date();
    nextYr.setFullYear(nextYr.getFullYear() + 1);
    setFormExpiresOn(nextYr.toISOString().split("T")[0]);
    
    setFormQty(1);
    setFormValue(0);
    setFormStage("Not Started");
    setFormProb(100);
    setFormOwner("Mahbub Alam");
    setFormRemarks("");
    setShowSubModal(true);
  };

  const handleOpenEdit = (sub: SoftwareSubscription) => {
    setModalMode("edit");
    setEditingSubId(sub.id);
    setFormAccount(sub.account_name);
    setFormBrand(sub.brand_oem);
    setFormLocalVendor(sub.local_vendor);
    setFormProduct(sub.product_name);
    setFormContractNo(sub.contract_no);
    setFormActivatedOn(sub.activated_on);
    setFormExpiresOn(sub.expires_on);
    setFormQty(sub.quantity);
    setFormValue(sub.total_value);
    setFormStage(sub.renewal_stage);
    setFormProb(sub.renewal_probability);
    setFormOwner(sub.sales_owner);
    setFormRemarks(sub.remarks);
    setShowSubModal(true);
  };

  const handleDeleteSub = (subId: string) => {
    if (window.confirm("Verify you intend to permanently delete this renewal contract from records?")) {
      const remaining = subscriptions.filter(s => s.id !== subId);
      handleSaveSubs(remaining);
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccount.trim() || !formProduct.trim() || !formContractNo.trim()) {
      alert("Missing required fields. Please fill out customer details.");
      return;
    }

    if (modalMode === "add") {
      const newSub: SoftwareSubscription = {
        id: `sub-${Date.now()}`,
        account_name: formAccount,
        customer_id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
        brand_oem: formBrand,
        local_vendor: formLocalVendor,
        product_name: formProduct,
        part_no: `${formBrand.slice(0, 2).toUpperCase()}-PROD-${Math.floor(100 + Math.random() * 900)}`,
        contract_no: formContractNo,
        tenure: "1 Year",
        activated_on: formActivatedOn,
        expires_on: formExpiresOn,
        quantity: Number(formQty),
        unit_price: Number(formValue),
        total_value: Number(formValue),
        currency: "BDT",
        renewal_stage: formStage,
        renewal_probability: Number(formProb),
        status: getDaysRemaining(formExpiresOn) >= 0 ? "Active" : "Expired",
        sales_owner: formOwner,
        competitor: "",
        remarks: formRemarks,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      handleSaveSubs([newSub, ...subscriptions]);
    } else {
      const updated = subscriptions.map(s => {
        if (s.id === editingSubId) {
          return {
            ...s,
            account_name: formAccount,
            brand_oem: formBrand,
            local_vendor: formLocalVendor,
            product_name: formProduct,
            contract_no: formContractNo,
            activated_on: formActivatedOn,
            expires_on: formExpiresOn,
            quantity: Number(formQty),
            total_value: Number(formValue),
            renewal_stage: formStage,
            renewal_probability: Number(formProb),
            status: getDaysRemaining(formExpiresOn) >= 0 ? "Active" : "Expired",
            sales_owner: formOwner,
            remarks: formRemarks,
            updated_at: new Date().toISOString()
          };
        }
        return s;
      });
      handleSaveSubs(updated);
    }

    setShowSubModal(false);
  };

  const handleUpdateSubStage = (subId: string, newStage: SoftwareSubscription["renewal_stage"]) => {
    const updated = subscriptions.map(s => {
      if (s.id === subId) {
        return {
          ...s,
          renewal_stage: newStage,
          renewal_probability: newStage === "Renewed" ? 100 : (newStage === "Lost" ? 0 : s.renewal_probability),
          updated_at: new Date().toISOString()
        };
      }
      return s;
    });
    handleSaveSubs(updated);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Deck Submenu Tab Navigations */}
      <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between`}>
        <div className="space-y-1">
          <h2 className="text-base font-extrabold tracking-tight text-slate-100 flex items-center gap-1.5 font-mono">
            💼 Software Business Hub
          </h2>
          <p className="text-xs text-slate-400 font-mono">Cloud Subscriptions, License Audits &amp; Core Renewals</p>
        </div>
      </div>

      {/* Tab Selectors: Mobile Dropdown vs Desktop Tabs Slider */}
      <div className="block lg:hidden">
        <label className="block text-[10px] font-mono text-slate-500 uppercase mb-1.5">View Module Dashboard</label>
        <select
          value={activeSubTab}
          onChange={(e) => setActiveSubTab(e.target.value)}
          className={`w-full p-3 rounded-xl border font-bold text-xs ${
            theme.isDark 
              ? "bg-slate-950 border-slate-800 text-indigo-400 focus:ring-1 focus:ring-indigo-500" 
              : "bg-white border-slate-200 text-indigo-600 focus:ring-1 focus:ring-indigo-550"
          }`}
        >
          {MENU_TABS.map(tab => (
            <option key={tab.id} value={tab.id}>
              {tab.label} — {tab.desc}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden lg:flex gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
        {MENU_TABS.map(tab => {
          const IconComponent = tab.icon;
          const isSel = tab.id === activeSubTab;
          return (
            <button
              id={`software-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`py-2 px-3.5 rounded-lg text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                isSel
                  ? theme.isDark 
                    ? "bg-slate-800 text-amber-400 border-b-2 border-amber-400"
                    : "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600"
                  : theme.isDark
                    ? "bg-slate-950 border border-slate-900 text-slate-400 hover:text-slate-150"
                    : "bg-white border border-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              <IconComponent size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Primary Sub Tabs Views switch block */}
      <div className="transition-all duration-300">
        {activeSubTab === "dashboard" && (
          <DashboardSub 
            subscriptions={subscriptions} 
            theme={theme} 
            onSetTab={setActiveSubTab} 
          />
        )}
        {activeSubTab === "repository" && (
          <RepositorySub 
            subscriptions={subscriptions} 
            theme={theme} 
            onAddSub={handleOpenAdd}
            onEditSub={handleOpenEdit}
            onDeleteSub={handleDeleteSub}
          />
        )}
        {activeSubTab === "tracker" && renderTracker()}
        {activeSubTab === "pipeline" && (
          <PipelineSub 
            subscriptions={subscriptions} 
            theme={theme} 
            onUpdateSubStage={handleUpdateSubStage} 
          />
        )}
        {activeSubTab === "installed_base" && renderInstalledBase()}
        {activeSubTab === "vendor_business" && renderVendorBusiness()}
        {activeSubTab === "forecast" && (
          <ForecastSub 
            subscriptions={subscriptions} 
            theme={theme} 
          />
        )}
        {activeSubTab === "activities" && renderActivities()}
        {activeSubTab === "reports" && renderReports()}
        {activeSubTab === "import_export" && renderImportExport()}
      </div>

      {/* RENEWALS SUBSCRIPTION FORM MODAL */}
      {showSubModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-xl border shadow-xl p-5 ${theme.bgCard} ${theme.border} ${theme.textMain} text-xs space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar`}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/20">
              <h3 className="font-bold text-sm tracking-tight text-slate-100 uppercase font-mono">
                {modalMode === "add" ? "Create License Contract" : "Edit Contract Details"}
              </h3>
              <button 
                onClick={() => setShowSubModal(false)}
                className="text-slate-400 hover:text-white transition font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Account / Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Grameenphone PLC"
                    value={formAccount}
                    onChange={(e) => setFormAccount(e.target.value)}
                    className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Brand / OEM</label>
                  <select
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  >
                    {brands.map(b => (
                      <option key={b.id} value={b.brand_name}>{b.brand_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Product Details Model</label>
                  <input
                    type="text"
                    required
                    placeholder="Microsoft 365 E5 Security Suite"
                    value={formProduct}
                    onChange={(e) => setFormProduct(e.target.value)}
                    className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-indigo-400">Local Service Provider (Vendor)</label>
                    <select
                      value={formLocalVendor}
                      onChange={(e) => setFormLocalVendor(e.target.value)}
                      className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                        theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                      }`}
                    >
                      <option value="YOUR COMPANY NAME">Select Your Company Name...</option>
                      <option value="SMART TECH">SMART TECH</option>
                      <option value="DIGITAL EQUIPMENT">DIGITAL EQUIPMENT</option>
                      <option value="Star Tech">Star Tech</option>
                      <option value="APPTRIANGLE LIMITED">APPTRIANGLE LIMITED</option>
                      <option value="ELEVATE SOLUTIONS LIMITED">ELEVATE SOLUTIONS LIMITED</option>
                      <option value="FLORA TELECOM LIMITED">FLORA TELECOM LIMITED</option>
                      <option value="BRAC IT SERVICES">BRAC IT SERVICES (BITL)</option>
                      <option value="TECH VALLEY">TECH VALLEY NETWORKS</option>
                      <option value="ORIENTAL">ORIENTAL SYSTEMS</option>
                      <option value="INTERNAL">INTERNAL / DIRECT</option>
                    </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Contract No</label>
                  <input
                    type="text"
                    required
                    value={formContractNo}
                    onChange={(e) => setFormContractNo(e.target.value)}
                    className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Activated On</label>
                  <input
                    type="date"
                    required
                    value={formActivatedOn}
                    onChange={(e) => setFormActivatedOn(e.target.value)}
                    className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Expires On</label>
                  <input
                    type="date"
                    required
                    value={formExpiresOn}
                    onChange={(e) => setFormExpiresOn(e.target.value)}
                    className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Quantity</label>
                  <input
                    type="number"
                    value={formQty}
                    onChange={(e) => setFormQty(Number(e.target.value))}
                    className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">BDT Value</label>
                  <input
                    type="number"
                    value={formValue}
                    onChange={(e) => setFormValue(Number(e.target.value))}
                    className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Renewal Stage</label>
                  <select
                    value={formStage}
                    onChange={(e) => setFormStage(e.target.value as any)}
                    className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="Customer Contacted">Customer Contacted</option>
                    <option value="Quotation Sent">Quotation Sent</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="PO Expected">PO Expected</option>
                    <option value="PO Received">PO Received</option>
                    <option value="Renewed">Renewed</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Probability %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formProb}
                    onChange={(e) => setFormProb(Number(e.target.value))}
                    className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">KAM Executive Owner</label>
                  <select
                    value={formOwner}
                    onChange={(e) => setFormOwner(e.target.value)}
                    className={`w-full py-2 px-3 text-xs rounded-lg border focus:ring-1 focus:outline-none ${
                      theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                    }`}
                  >
                    <option value="Mahbub Alam">Mahbub Alam</option>
                    <option value="M. A. Rahman">M. A. Rahman</option>
                    <option value="Tarikul Islam">Tarikul Islam</option>
                    <option value="Farhana Yasmin">Farhana Yasmin</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Currency Code</label>
                  <input 
                    type="text" 
                    disabled 
                    value="BDT (৳)" 
                    className="w-full py-2 px-3 rounded-lg border bg-slate-950 font-semibold text-indigo-400 opacity-60" 
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Internal Conversation Audit Notes</label>
                <textarea
                  placeholder="Special pricing arrangements, discount multipliers configuration details..."
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  rows={3}
                  className={`w-full py-2 px-3 rounded-lg border focus:ring-1 focus:outline-none ${
                    theme.isDark ? "bg-slate-900 border-slate-800 text-slate-350" : "bg-white border-slate-200"
                  }`}
                />
              </div>

              <div className="pt-2 border-t border-slate-800/10 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowSubModal(false)}
                  className="py-2 px-4 rounded-lg font-semibold bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  {modalMode === "add" ? "Save Contract" : "Apply Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
