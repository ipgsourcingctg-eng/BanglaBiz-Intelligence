/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { 
  Bell, 
  Search, 
  Palette, 
  Database, 
  Check, 
  Menu,
  AlertTriangle,
  History,
  RefreshCw
} from "lucide-react";
import { ThemeType, DashboardTheme, SyncLog } from "../types";
import { CUSTOM_THEMES } from "../utils/theme";
const appIcon = "https://raw.githubusercontent.com/mahbubraju30-ctrl/logos-icons/main/SalesPulse.png";

interface HeaderProps {
  theme: DashboardTheme;
  setThemeVariant: (variant: ThemeType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  syncLogs: SyncLog[];
  totalRecords: number;
  collapsed?: boolean;
  setCollapsed?: (val: boolean) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Header({
  theme,
  setThemeVariant,
  searchQuery,
  setSearchQuery,
  syncLogs,
  totalRecords,
  collapsed,
  setCollapsed,
  onRefresh,
  isRefreshing
}: HeaderProps) {
  const [showPalette, setShowPalette] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const activeLogsCount = syncLogs.length;

  const handleManualSync = () => {
    if (onRefresh && !isRefreshing) {
      onRefresh();
    }
  };

  return (
    <header className={`sticky top-0 z-30 border-b flex p-3 md:p-4 items-center justify-between flex-wrap md:flex-nowrap ${theme.bgCard} ${theme.border} ${theme.cardShadow} gap-3 md:gap-4 relative`}>
      
      {/* 1. App Logo & Name branding - Order 1 (Always Left) */}
      <div className="flex items-center gap-2.5 shrink-0 order-1">
        {setCollapsed && (
          <button 
            className={`md:hidden p-1.5 rounded-md border transition ${theme.border} ${theme.textMuted}`}
            onClick={() => setCollapsed(!collapsed)}
          >
            <Menu size={18} />
          </button>
        )}
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-200/40 dark:border-slate-800/50 shrink-0 shadow-sm">
          <img src={appIcon} alt="SalesPulse" className="w-full h-full object-cover animate-fade-in" />
        </div>
        <div className="flex flex-col select-none">
          <span className={`font-extrabold tracking-wider text-xs md:text-sm uppercase bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent font-sans`}>
            SalesPulse
          </span>
          <span className="text-[7.5px] uppercase tracking-[0.15em] font-mono text-slate-450 dark:text-slate-500 leading-none font-bold mt-0.5">
            Enterprise BI
          </span>
        </div>
      </div>

      {/* 2. Controls & Theme Preset palette + Bell button - Order 2 on Mobile, Order 3 on Desktop */}
      <div className="flex items-center gap-2.5 order-2 md:order-3 ml-auto md:ml-0 shrink-0">
        
        {/* Sync Button */}
        {onRefresh && (
          <button
            id="global-cloud-resync-trigger"
            onClick={handleManualSync}
            disabled={isRefreshing}
            className={`p-2 rounded-lg border transition cursor-pointer flex items-center gap-2 ${
              isRefreshing ? "opacity-50 cursor-not-allowed" : ""
            } ${theme.border} ${
              theme.isDark 
                ? "bg-slate-800/30 text-slate-300 hover:text-white" 
                : "bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950"
            }`}
            title="Reload Cloud Data"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin text-amber-500" : ""} />
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">Sync Data</span>
          </button>
        )}

        {/* Enterprise Theme Presets Palette */}
        <div className="relative">
          <button
            id="theme-palette-dropdown-btn"
            onClick={() => {
              setShowPalette(!showPalette);
            }}
            className={`p-2 rounded-lg border transition cursor-pointer ${theme.border} ${theme.isDark ? "bg-slate-800/30 text-slate-300 hover:text-white" : "bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}
            title="Switch Dashboard Colors"
          >
            <Palette size={16} />
          </button>

          {showPalette && (
            <div className={`absolute right-0 mt-2 w-52 rounded-xl p-2 border shadow-2xl z-50 text-xs ${theme.bgCard} ${theme.border} backdrop-blur-md`}>
              <div className={`font-semibold p-1.5 text-[10px] uppercase tracking-widest border-b mb-1 ${theme.isDark ? "text-slate-400 border-slate-800" : "text-slate-500 border-slate-200"}`}>
                Colors & Themes
              </div>
              <div className="space-y-0.5">
                {Object.values(CUSTOM_THEMES).map((t) => (
                  <button
                    id={`theme-variant-selection-${t.variant}`}
                    key={t.variant}
                    onClick={() => {
                      setThemeVariant(t.variant);
                      setShowPalette(false);
                    }}
                    className={`w-full flex items-center justify-between p-1.5 rounded-md transition text-left ${
                      theme.variant === t.variant 
                        ? theme.isDark 
                          ? "text-amber-400 font-bold bg-slate-800" 
                          : "text-indigo-650 font-bold bg-slate-100"
                        : theme.isDark 
                          ? "text-slate-300 hover:bg-slate-800" 
                          : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-3.5 h-3.5 rounded-full border border-slate-705`}
                        style={{
                          backgroundColor: 
                            t.variant === "sophisticated-dark" ? "#6366f1" : 
                            t.variant === "dark-elegant" ? "#bfdbfe" : 
                            t.variant === "midnight-blue" ? "#38bdf8" : 
                            t.variant === "forest-green" ? "#34d399" : 
                            t.variant === "royal-purple" ? "#a78bfa" : 
                            t.variant === "executive-black" ? "#e5e5e5" : "#4a5568"
                        }}
                      />
                      <span>{t.name}</span>
                    </div>
                    {theme.variant === t.variant && <Check size={12} className={theme.isDark ? "text-amber-400 shrink-0" : "text-indigo-600 shrink-0"} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Global Search Input Bar - Order 3 on Mobile (wraps to line 2), Order 2 on Desktop (center) */}
      <div className="w-full md:w-80 order-3 md:order-2 shrink-0 md:shrink">
        <div className="relative group flex-1">
          <Search size={15} className={`absolute left-3 top-2.5 ${theme.textMuted}`} />
          <input
            id="global-search-slicer"
            type="text"
            placeholder="Search buyer, order, brand, products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full text-xs pl-9 pr-4 py-2 rounded-lg border focus:outline-none transition-all ${
              theme.isDark 
                ? "bg-slate-950/60 border-slate-800 text-slate-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400" 
                : "bg-slate-100/60 border-slate-200 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            }`}
          />
          {searchQuery && (
            <button 
              id="clear-search-btn"
              onClick={() => setSearchQuery("")} 
              className={`absolute right-3 top-1.5 text-xs text-slate-400 ${theme.isDark ? "hover:text-slate-100" : "hover:text-slate-900"}`}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
