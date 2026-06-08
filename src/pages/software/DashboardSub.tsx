import React from "react";
import { 
  ShieldAlert, Mail, Bell, Smartphone, Clock, AlertCircle, ArrowUpRight, 
  CheckCircle2, DollarSign, Activity, AlertTriangle, Play 
} from "lucide-react";
import { DashboardTheme, SoftwareSubscription } from "../../types";

interface DashboardSubProps {
  subscriptions: SoftwareSubscription[];
  theme: DashboardTheme;
  onSetTab: (tab: string) => void;
}

export default function DashboardSub({ subscriptions, theme, onSetTab }: DashboardSubProps) {
  // Calculations
  const activeSubs = subscriptions.filter(s => s.status === "Active");
  const expiredSubs = subscriptions.filter(s => s.status === "Expired" || s.renewal_stage === "Lost");

  const totalActiveValue = activeSubs.reduce((acc, s) => acc + s.total_value, 0);
  const totalExpiredValue = expiredSubs.reduce((acc, s) => acc + s.total_value, 0);

  const getDaysRemaining = (expiryDateStr: string) => {
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const expiring30 = activeSubs.filter(s => {
    const days = getDaysRemaining(s.expires_on);
    return days >= 0 && days <= 30;
  });

  const expiring60 = activeSubs.filter(s => {
    const days = getDaysRemaining(s.expires_on);
    return days >= 31 && days <= 60;
  });

  const expiring90 = activeSubs.filter(s => {
    const days = getDaysRemaining(s.expires_on);
    return days >= 61 && days <= 90;
  });

  const expiringSoonCount = expiring30.length;
  const expiringSoonValue = expiring30.reduce((acc, s) => acc + s.total_value, 0);

  const formatBDT = (val: number) => {
    if (val >= 10000000) return `৳ ${(val / 10000000).toFixed(2)} Crore`;
    if (val >= 100000) return `৳ ${(val / 100000).toFixed(2)} Lakh`;
    return `৳ ${val.toLocaleString()}`;
  };

  // Generate automated alerts
  const alertsList = React.useMemo(() => {
    const list: Array<{
      id: string;
      account: string;
      vendor: string;
      product: string;
      daysRemaining: number;
      triggerType: string;
      severity: "critical" | "warning" | "info" | "expired";
    }> = [];

    subscriptions.forEach(sub => {
      const days = getDaysRemaining(sub.expires_on);
      if (days < 0) {
        list.push({
          id: `${sub.id}-alert-exp`,
          account: sub.account_name,
          vendor: sub.brand_oem,
          product: sub.product_name,
          daysRemaining: days,
          triggerType: "Expired",
          severity: "expired"
        });
      } else if (days === 1) {
        list.push({
          id: `${sub.id}-alert-1`,
          account: sub.account_name,
          vendor: sub.brand_oem,
          product: sub.product_name,
          daysRemaining: days,
          triggerType: "1 Day Before Expiry",
          severity: "critical"
        });
      } else if (days <= 7) {
        list.push({
          id: `${sub.id}-alert-7`,
          account: sub.account_name,
          vendor: sub.brand_oem,
          product: sub.product_name,
          daysRemaining: days,
          triggerType: "7 Days Before Expiry",
          severity: "critical"
        });
      } else if (days <= 15) {
        list.push({
          id: `${sub.id}-alert-15`,
          account: sub.account_name,
          vendor: sub.brand_oem,
          product: sub.product_name,
          daysRemaining: days,
          triggerType: "15 Days Before Expiry",
          severity: "critical"
        });
      } else if (days <= 30) {
        list.push({
          id: `${sub.id}-alert-30`,
          account: sub.account_name,
          vendor: sub.brand_oem,
          product: sub.product_name,
          daysRemaining: days,
          triggerType: "30 Days Before Expiry",
          severity: "warning"
        });
      } else if (days <= 60) {
        list.push({
          id: `${sub.id}-alert-60`,
          account: sub.account_name,
          vendor: sub.brand_oem,
          product: sub.product_name,
          daysRemaining: days,
          triggerType: "60 Days Before Expiry",
          severity: "info"
        });
      } else if (days <= 90) {
        list.push({
          id: `${sub.id}-alert-90`,
          account: sub.account_name,
          vendor: sub.brand_oem,
          product: sub.product_name,
          daysRemaining: days,
          triggerType: "90 Days Before Expiry",
          severity: "info"
        });
      }
    });

    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [subscriptions]);

  const [notificationConfig, setNotificationConfig] = React.useState<Record<string, { app: boolean; email: boolean; sms: boolean }>>({
    "90": { app: true, email: true, sms: false },
    "60": { app: true, email: true, sms: false },
    "30": { app: true, email: true, sms: true },
    "15": { app: true, email: true, sms: true },
    "7": { app: true, email: true, sms: true },
    "1": { app: true, email: true, sms: true },
    "Expired": { app: true, email: true, sms: true },
  });

  const toggleChannel = (alertDays: string, channel: "app" | "email" | "sms") => {
    if (window.navigator?.vibrate) {
      window.navigator.vibrate(10);
    }
    setNotificationConfig(prev => ({
      ...prev,
      [alertDays]: {
        ...prev[alertDays],
        [channel]: !prev[alertDays][channel]
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* KPI Overviews Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col justify-between`}>
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider ${theme.textMuted}`}>Active Licenses Val</span>
              <h3 className="text-lg sm:text-2xl font-bold tracking-tight mt-1">{formatBDT(totalActiveValue)}</h3>
            </div>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-[10px] text-emerald-400 font-mono mt-3 flex items-center gap-1">
            <ArrowUpRight size={12} /> {activeSubs.length} Contracts Active
          </p>
        </div>

        {/* KPI 2 */}
        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col justify-between`}>
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider ${theme.textMuted}`}>Due in 30 Days</span>
              <h3 className="text-lg sm:text-2xl font-bold tracking-tight mt-1 text-red-400">{formatBDT(expiringSoonValue)}</h3>
            </div>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 animate-pulse">
              <Clock size={20} />
            </div>
          </div>
          <p className="text-[10px] text-red-400 font-mono mt-3 flex items-center gap-1">
            <AlertCircle size={12} /> {expiringSoonCount} Licenses Expiring
          </p>
        </div>

        {/* KPI 3 */}
        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col justify-between`}>
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider ${theme.textMuted}`}>Due in 90 Days</span>
              <h3 className="text-lg sm:text-2xl font-bold tracking-tight mt-1 text-amber-500">
                {formatBDT(expiring90.concat(expiring60).concat(expiring30).reduce((acc, s) => acc + s.total_value, 0))}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Activity size={20} />
            </div>
          </div>
          <p className="text-[10px] text-amber-400 font-mono mt-3 flex items-center gap-1">
            <AlertTriangle size={12} /> {expiring30.length + expiring60.length + expiring90.length} Contracts At Risk
          </p>
        </div>

        {/* KPI 4 */}
        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col justify-between`}>
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-[10px] sm:text-xs font-mono uppercase tracking-wider ${theme.textMuted}`}>Expired / Lost Assets</span>
              <h3 className="text-lg sm:text-2xl font-bold tracking-tight mt-1 text-slate-400">{formatBDT(totalExpiredValue)}</h3>
            </div>
            <div className="p-2 rounded-lg bg-slate-500/10 text-slate-400">
              <ShieldAlert size={20} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-3 flex items-center gap-1">
            • {expiredSubs.filter(s=>s.renewal_stage==='Lost').length} Lost, {expiredSubs.filter(s=>s.status==='Expired'&&s.renewal_stage!=='Lost').length} Active but Unrenewed
          </p>
        </div>
      </div>

      {/* Main Grid for Automated Alerts & Matrix Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Alerts Center Feed */}
        <div className={`lg:col-span-7 p-4 sm:p-5 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-tight">Renewal Notification Control Desk</h3>
              <p className={`text-[11px] ${theme.textMuted} font-mono mt-0.5`}>Real-time system calculated alert thresholds</p>
            </div>
            <span className="text-[10px] py-1 px-2.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono">
              {alertsList.length} Triggered Messages
            </span>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 no-scrollbar">
            {alertsList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                All software licenses are currently in highly robust status. No alerts.
              </div>
            ) : (
              alertsList.map((alert, idx) => {
                const isCritical = alert.severity === "critical" || alert.severity === "expired";
                const isWarning = alert.severity === "warning";
                
                return (
                  <div 
                    key={alert.id}
                    className={`p-3.5 rounded-lg border transition-all duration-300 ${
                      alert.severity === "expired" 
                        ? "bg-red-950/15 border-red-900/40 hover:bg-red-950/20 text-red-200" 
                        : alert.severity === "critical"
                        ? "bg-rose-950/10 border-rose-900/30 hover:bg-rose-950/15 text-rose-300"
                        : isWarning
                        ? "bg-amber-950/10 border-amber-900/30 hover:bg-amber-950/15 text-amber-300"
                        : "bg-blue-950/10 border-blue-900/20 hover:bg-blue-950/15 text-blue-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {isCritical ? (
                          <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-bold text-xs sm:text-sm text-slate-100 break-words">{alert.account}</span>
                          <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full ${
                            alert.severity === "expired" ? "bg-red-500/10 text-red-400" :
                            alert.severity === "critical" ? "bg-rose-500/10 text-rose-400" :
                            isWarning ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"
                          }`}>
                            {alert.triggerType}
                          </span>
                        </div>
                        <p className="text-[11px] truncate mt-1 text-slate-300 opacity-90">{alert.vendor} (Brand) — {alert.product}</p>
                        
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-700/30 text-[10px] font-mono">
                          <span className={alert.daysRemaining < 0 ? "text-red-400" : "text-emerald-450"}>
                            {alert.daysRemaining < 0 ? `Lapsed by ${Math.abs(alert.daysRemaining)} Days` : `${alert.daysRemaining} Days remaining`}
                          </span>
                          <div className="flex gap-2">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 flex items-center gap-1">
                              <Bell size={8} /> App: {notificationConfig[alert.daysRemaining <= 0 ? "Expired" : String(alert.daysRemaining)]?.app ? "Yes" : "No"}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 flex items-center gap-1">
                              <Mail size={8} /> Mail: {notificationConfig[alert.daysRemaining <= 0 ? "Expired" : String(alert.daysRemaining)]?.email ? "Yes" : "No"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Central Notification Matrices */}
        <div className={`lg:col-span-5 p-4 sm:p-5 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} flex flex-col justify-between`}>
          <div>
            <h3 className="font-bold text-sm sm:text-base tracking-tight">Billing Notification Gateway</h3>
            <p className={`text-[11px] ${theme.textMuted} font-mono mt-0.5`}>Configure alert channels for each stage</p>

            <div className="space-y-3.5 mt-5">
              {Object.keys(notificationConfig).map((key) => {
                const config = notificationConfig[key];
                return (
                  <div key={key} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/20">
                    <span className="font-mono font-semibold text-slate-300">
                      {key === "Expired" ? "At Expiry & Lapsed" : `${key} Days Before`}
                    </span>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => toggleChannel(key, "app")}
                        title="Toggle In-App alert"
                        className={`p-1.5 rounded border transition-all ${
                          config.app 
                            ? theme.isDark ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-700" 
                            : "bg-slate-900/30 border-slate-800 text-slate-500"
                        }`}
                      >
                        <Bell size={13} />
                      </button>
                      <button 
                        onClick={() => toggleChannel(key, "email")}
                        title="Toggle Email notifications"
                        className={`p-1.5 rounded border transition-all ${
                          config.email 
                            ? theme.isDark ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-700" 
                            : "bg-slate-900/30 border-slate-800 text-slate-500"
                        }`}
                      >
                        <Mail size={13} />
                      </button>
                      <button 
                        onClick={() => toggleChannel(key, "sms")}
                        title="Toggle Push Notifications/SMS"
                        className={`p-1.5 rounded border transition-all ${
                          config.sms 
                            ? theme.isDark ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-700" 
                            : "bg-slate-900/30 border-slate-800 text-slate-500"
                        }`}
                      >
                        <Smartphone size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700/50">
            <button 
              onClick={() => onSetTab("tracker")}
              className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white`}
            >
              <CheckCircle2 size={13} /> Go to Renewal Tracker View
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
