/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Package, 
  Users, 
  Coins, 
  Workflow, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Target,
  FileSpreadsheet,
  UserCheck,
  CircleDollarSign,
  FileCode,
  Filter,
  Briefcase,
  Activity,
  BrainCircuit
} from "lucide-react";
import { User, DashboardTheme } from "../types";
const appIcon = "https://raw.githubusercontent.com/mahbubraju30-ctrl/logos-icons/main/SalesPulse.png";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User;
  onLogout: () => void;
  theme: DashboardTheme;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  theme,
  collapsed,
  setCollapsed
}: SidebarProps) {
  
  const menuItems = [
    { id: "overview", label: "Dashboard Overview", icon: LayoutDashboard },
    { id: "forecasting", label: "Sales Forecasting", icon: BrainCircuit },
    { id: "sales", label: "Sales Analytics", icon: TrendingUp },
    { id: "financials", label: "Finance & Collections", icon: Coins },
    { id: "kam_performance", label: "KAM Analytics", icon: UserCheck },
    { id: "pipeline", label: "Pipeline & Targets", icon: Target },
    { id: "customers", label: "Customer Intelligence", icon: Users },
    { id: "products", label: "Product Analytics", icon: Package },
    { id: "lead_analysis", label: "Lead Analysis", icon: Activity },
    { id: "funnel", label: "Sales Funnel", icon: Filter },
    { id: "software_business", label: "Software Business", icon: Briefcase },
    { id: "settings", label: "System Settings", icon: Settings }
  ];

  return (
    <aside 
      id="side-nav-container"
      className={`absolute md:relative h-screen top-0 border-r flex flex-col justify-between transition-all duration-300 ease-in-out z-40 ${
        collapsed ? "w-0 md:w-20 -left-64 md:left-0 overflow-hidden md:overflow-visible" : "w-64 left-0 md:left-0 overflow-visible"
      } ${theme.bgCard} ${theme.border}`}
    >
      <div>
        {/* Brand Header */}
        <div className={`p-4 border-b flex items-center justify-between ${theme.border}`}>
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center font-bold text-white shadow-md select-none border border-slate-800 shrink-0">
                <img src={appIcon} alt="SalesPulse" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className={`font-bold tracking-tight text-sm ${theme.isDark ? "text-slate-100" : "text-slate-900"}`}>SalesPulse</span>
                <span className={`text-[10px] uppercase tracking-[0.15em] font-mono ${theme.isDark ? "text-slate-400" : "text-slate-500"} leading-none font-bold mt-0.5`}>Enterprise BI</span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto w-8 h-8 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md select-none">
              <img src={appIcon} alt="SP" className="w-full h-full object-cover" />
            </div>
          )}
          
          <button 
            id="sidebar-toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1 rounded-md border transition ${theme.border} ${theme.isDark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-650"}`}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* User profile summary */}
        <div className={`p-4 border-b ${theme.border} overflow-hidden`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 border ${
              theme.isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-indigo-100 border-indigo-200 text-indigo-700"
            }`}>
              {user.name.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className={`font-semibold text-xs leading-none truncate ${theme.isDark ? "text-slate-100" : "text-slate-900"}`}>{user.name}</span>
                <span className={`text-[10px] mt-1 px-1.5 py-0.5 rounded-full inline-block w-max font-mono border ${
                  theme.isDark 
                    ? "text-purple-300 bg-purple-500/10 border-purple-500/20" 
                    : "text-purple-700 bg-purple-50 border-purple-200"
                }`}>
                  {user.role}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                id={`sidebar-tab-btn-${item.id}`}
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 768) {
                    setCollapsed(true);
                  }
                }}
                className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all group relative duration-200 ${
                  isActive 
                    ? theme.isDark 
                      ? "bg-slate-800 text-amber-400 border-l-2 border-amber-400" 
                      : "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-600"
                    : theme.isDark 
                      ? "text-slate-400 hover:text-slate-100 hover:bg-slate-900" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <IconComponent 
                  size={18} 
                  className={`shrink-0 transition-transform group-hover:scale-110 ${
                    isActive 
                      ? theme.isDark 
                        ? "text-amber-400" 
                        : "text-indigo-600" 
                      : theme.isDark 
                        ? "text-slate-400 group-hover:text-slate-200" 
                        : "text-slate-500 group-hover:text-slate-805"
                  }`} 
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
                
                {/* Tooltip for collapsed mode */}
                {collapsed && (
                  <div className={`absolute left-full ml-2 px-2 py-1 text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-md border ${
                    theme.isDark ? "bg-slate-950 text-slate-200 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                  }`}>
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer / Action Area */}
      <div className={`p-4 border-t ${theme.border}`}>
        <button
          id="sidebar-logout-btn"
          onClick={onLogout}
          className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg text-xs transition group font-semibold relative ${
            theme.isDark 
              ? "text-rose-400 hover:bg-rose-950/20 hover:text-rose-300" 
              : "text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-transparent hover:border-rose-100"
          }`}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={18} className="shrink-0 group-hover:translate-x-0.5 transition" />
          {!collapsed && <span>System Logout</span>}
          {collapsed && (
            <div className={`absolute left-full ml-2 px-2 py-1 text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap border ${
              theme.isDark ? "bg-rose-950/80 text-rose-200 border-rose-900/40" : "bg-rose-50 text-rose-700 border-rose-200"
            }`}>
              System Logout
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
