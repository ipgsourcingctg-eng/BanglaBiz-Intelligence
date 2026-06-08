import React from "react";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Package, 
  Users, 
  Coins, 
  Target, 
  UserCheck, 
  Filter, 
  Settings,
  FileCode,
  Briefcase,
  Activity
} from "lucide-react";
import { DashboardTheme } from "../types";

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: DashboardTheme;
}

export default function MobileNav({ activeTab, setActiveTab, theme }: MobileNavProps) {
  const menuItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "sales", label: "Sales", icon: TrendingUp },
    { id: "financials", label: "Accounts", icon: Coins },
    { id: "kam_performance", label: "KAMs", icon: UserCheck },
    { id: "pipeline", label: "Pipeline", icon: Target },
    { id: "customers", label: "Customers", icon: Users },
    { id: "products", label: "Products", icon: Package },
    { id: "lead_analysis", label: "Leads", icon: Activity },
    { id: "funnel", label: "Funnel", icon: Filter },
    { id: "software_business", label: "Software", icon: Briefcase },
    { id: "settings", label: "Settings", icon: Settings }
  ];

  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden border-t backdrop-blur-lg flex items-center overflow-x-auto no-scrollbar scroll-smooth px-2 py-1.5 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] transition-all duration-300 ${theme.bgCard} ${theme.border}`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.375rem)' }}
    >
      <div className="flex items-center gap-0.5 min-w-max mx-auto px-1.5">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                // Simple haptic feedback if supported
                if (window.navigator?.vibrate) {
                  window.navigator.vibrate(10);
                }
              }}
              className={`flex flex-col items-center justify-center min-w-[52px] h-12 rounded-xl transition-all duration-300 relative group ${
                isActive 
                  ? theme.isDark 
                    ? "bg-indigo-500/10 text-amber-400" 
                    : "bg-indigo-50 text-indigo-600"
                  : theme.isDark 
                    ? "text-slate-500" 
                    : "text-slate-500"
              }`}
            >
              <div className={`transition-all duration-300 ${isActive ? "scale-110 -translate-y-0.5" : "scale-100 opacity-80"}`}>
                <IconComponent size={20} />
              </div>
              <span className={`text-[9px] font-bold font-mono tracking-tighter mt-0.5 transition-all duration-300 uppercase ${
                isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
              }`}>
                {item.label}
              </span>
              
              {isActive && (
                <div className={`absolute -top-1 w-1 h-1 rounded-full ${theme.isDark ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "bg-indigo-600"}`} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
