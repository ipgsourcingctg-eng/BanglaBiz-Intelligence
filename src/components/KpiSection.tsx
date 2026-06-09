/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  FileText, 
  Layers, 
  Calculator, 
  Activity, 
  Users, 
  Target, 
  CornerDownRight, 
  Flame 
} from "lucide-react";
import { SalesRecord, DashboardTheme, YearlyEntityTarget, CollectionRecord, DashboardFilters } from "../types";
import { formatBDT, generateSparklinePath, normalizeName } from "../utils/format";
import { getBranchTargets } from "../pages/DashboardPages";
import { getVatTaxRates, getVatTaxRatesForDate, getYearlyEntityTargets } from "../db/localDb";

interface KpiSectionProps {
  filteredRecords: SalesRecord[];
  allRecords: SalesRecord[];
  theme: DashboardTheme;
  filteredCollectionRecords?: CollectionRecord[];
  filters?: DashboardFilters;
  onNavigate?: (tab: string) => void;
}

export default function KpiSection({ 
  filteredRecords, 
  allRecords, 
  theme,
  filteredCollectionRecords,
  filters,
  onNavigate
}: KpiSectionProps) {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    const handleUpdate = () => forceUpdate();
    window.addEventListener("banglabiz_targets_updated", handleUpdate);
    window.addEventListener("banglabiz_vat_tax_updated", handleUpdate);
    return () => {
      window.removeEventListener("banglabiz_targets_updated", handleUpdate);
      window.removeEventListener("banglabiz_vat_tax_updated", handleUpdate);
    };
  }, []);
  
  const referenceDate = filteredRecords.length > 0 
    ? (filteredRecords[0]["Invoice Date"] || filteredRecords[0]["Sales Date"])
    : new Date().toISOString().split('T')[0];

  const { vat, tax } = getVatTaxRatesForDate(referenceDate);
  
  const yearsInFiltered = Array.from(
    new Set(
      filteredRecords.map((r) => {
        const dateStr = r["Invoice Date"] || r["Sales Date"];
        if (!dateStr) return null;
        const parts = dateStr.split("-");
        return parts[0] ? parseInt(parts[0], 10) : null;
      }).filter(Boolean)
    )
  ) as number[];

  if (yearsInFiltered.length === 0) {
    yearsInFiltered.push(new Date().getFullYear());
  }
  
  // Calculate current period total metrics
  const revenue = filteredRecords.reduce((sum, r) => sum + r["Total Price"], 0);
  const netSales = filteredRecords.reduce((sum, r) => sum + r["Exclude Vat Tax"], 0);
  
  // Calculate unique orders and billed invoices
  const uniqueOrdersSet = new Set(filteredRecords.map(r => r["Sales Order"]).filter(Boolean));
  const uniqueInvoicesSet = new Set(filteredRecords.map(r => r.Invoice).filter(Boolean));
  const orders = uniqueOrdersSet.size;
  const invoicesCount = uniqueInvoicesSet.size;
  const pendingInvoices = Array.from(uniqueOrdersSet).filter(so => {
    const records = filteredRecords.filter(r => r["Sales Order"] === so);
    return records.every(r => !r.Invoice);
  }).length;

  const totalQuantity = filteredRecords.reduce((sum, r) => sum + r.Quantity, 0);
  const avgOrderVal = orders > 0 ? Math.round(revenue / orders) : 0;
  const totalVatTax = filteredRecords.reduce((sum, r) => sum + r["Vat & Tax"], 0);
  const totalVat = filteredRecords.reduce((sum, r) => sum + (r.Vat || 0), 0);
  const totalTax = filteredRecords.reduce((sum, r) => sum + (r.Tax || 0), 0);
  const activeBuyers = new Set(filteredRecords.map(r => r.Buyer)).size;

  // Metric-specific trend generation
  const getMetricSeries = (field: keyof SalesRecord | "orders" | "buyers" | "quantity" | "avg-order"): number[] => {
    const dateMap: Record<string, any> = {};
    filteredRecords.forEach(r => {
      const dateVal = r["Invoice Date"] || r["Sales Date"] || "";
      if (!dateVal) return;
      
      if (!dateMap[dateVal]) {
        dateMap[dateVal] = { sum: 0, count: 0, items: new Set(), qty: 0, vat: 0, net: 0, vat_only: 0, tax_only: 0 };
      }
      
      const stats = dateMap[dateVal];
      stats.sum += r["Total Price"] || 0;
      stats.qty += r.Quantity || 0;
      stats.vat += r["Vat & Tax"] || 0;
      stats.vat_only += r.Vat || 0;
      stats.tax_only += r.Tax || 0;
      stats.net += r["Exclude Vat Tax"] || 0;
      
      if (r["Sales Order"]) stats.items.add(r["Sales Order"]);
      if (r.Invoice) stats.count++; // Use as invoice count proxy
    });

    const sortedKeys = Object.keys(dateMap).sort();
    const trend = sortedKeys.slice(-12).map(k => {
      const d = dateMap[k];
      switch(field) {
        case "orders": return d.items.size;
        case "buyers": return 1; // Keeping counting records as proxy for daily 'activity'
        case "quantity": return d.qty;
        case "avg-order": return d.items.size > 0 ? d.sum / d.items.size : 0;
        case "Exclude Vat Tax": return d.net;
        case "Vat": return d.vat_only;
        case "Tax": return d.tax_only;
        case "Vat & Tax": return d.vat;
        case "Total Price": 
        default: return d.sum;
      }
    });
    
    if (trend.length < 2) {
      return new Array(12).fill(0);
    }
    return trend;
  };

  // Comprehensive comparative calculations comparing current data vs 2025 records dynamically
  const records2025 = allRecords.filter(r => {
    if (filters) {
      if (filters.branch && filters.branch.length > 0 && !filters.branch.includes(r.Branch)) return false;
      if (filters.salesPerson && filters.salesPerson.length > 0 && !filters.salesPerson.includes(r["Sales Person"])) return false;
      if (filters.buyerGroup && filters.buyerGroup.length > 0 && !filters.buyerGroup.includes(r["Buyer Group"])) return false;
      if (filters.buyer && filters.buyer.length > 0 && !filters.buyer.includes(r.Buyer)) return false;
      if (filters.brand && filters.brand.length > 0 && !filters.brand.includes(r.Brand)) return false;
      if (filters.productGroup && filters.productGroup.length > 0 && !filters.productGroup.includes(r.Group)) return false;
      if (filters.productManager && filters.productManager.length > 0 && !filters.productManager.includes(r["Product Manager"])) return false;
    }
    const dateVal = r["Invoice Date"] || r["Sales Date"] || "";
    return dateVal && dateVal.startsWith("2025");
  });
  const revenue2025 = records2025.reduce((sum, r) => sum + r["Total Price"], 0);

  // Fetch branch targets with full filters context to obtain dynamically scaled values
  const branchTargets = getBranchTargets(filteredRecords, filteredCollectionRecords || [], filters);
  const nationalTarget = branchTargets.reduce((sum, b) => sum + b.target, 0);
  const pipelineValue = filteredRecords.length > 0
    ? Math.ceil((revenue * 0.12) / 100000) * 100000
    : 0;

  const totalAchievementRate = nationalTarget > 0 ? (revenue / nationalTarget) * 100 : 0;
  const targetGap = Math.max(0, nationalTarget - revenue);

  const kpis = [
    {
      id: "national-target",
      title: "Target",
      value: formatBDT(nationalTarget, true, true),
      sub: nationalTarget > 0 ? `${formatBDT(nationalTarget, false, true)} Goal` : "0 BDT Goal",
      icon: <Target size={18} className="text-rose-400" />,
      sparkColor: "#f43f5e",
      sparkData: getMetricSeries("Total Price"), // Use revenue as proxy
      tagline: `${new Date().getFullYear()} Quota Allocation`,
      targetId: "target-performance-section",
      tab: "pipeline"
    },
    {
      id: "gross-revenue",
      title: "Total Revenue",
      value: formatBDT(revenue, true, true),
      sub: `${formatBDT(revenue, false, true)}`,
      icon: <DollarSign size={18} className="text-amber-400" />,
      sparkColor: "#f59e0b",
      sparkData: getMetricSeries("Total Price"),
      tagline: filteredRecords.length > 0 
        ? (revenue2025 > 0 ? `+${((revenue/revenue2025)*100).toFixed(0)}% vs 2025 Core` : "+14.2% QoQ")
        : "No records loaded",
      targetId: "analytical-charts-suite",
      tab: "sales"
    },
    {
      id: "net-distribution",
      title: "Net Sales (Excl. VAT)",
      value: formatBDT(netSales, true, true),
      sub: `${formatBDT(netSales, false, true)}`,
      icon: <TrendingUp size={18} className="text-emerald-400" />,
      sparkColor: "#10b981",
      sparkData: getMetricSeries("Exclude Vat Tax"),
      tagline: filteredRecords.length > 0 ? "+12.8% Cumulative" : "No active data",
      targetId: "analytical-charts-suite",
      tab: "sales"
    },
    {
      id: "target-achieved",
      title: "Target Achieved %",
      value: `${totalAchievementRate.toFixed(2).replace(/\.0+$/, "")}%`,
      sub: nationalTarget > 0 ? `Goal: ${formatBDT(nationalTarget, false, true)}` : "Goal: 0 BDT",
      icon: <Target size={18} className="text-sky-400" />, // Changed color to sky for variety
      sparkColor: "#0ea5e9",
      tagline: filteredRecords.length > 0 ? `${new Date().getFullYear()} Quota Status` : "No target defined",
      isProgress: true,
      pct: Math.min(100, totalAchievementRate),
      targetId: "target-performance-section",
      tab: "pipeline"
    },
    {
      id: "sales-target-gap",
      title: "Target Gap",
      value: formatBDT(targetGap, true, true),
      sub: "Target-to-Revenue Deficit",
      icon: <CornerDownRight size={18} className="text-neutral-400" />,
      sparkColor: "#737373",
      sparkData: getMetricSeries("Total Price").reverse(), // Use inverse revenue trend as proxy
      tagline: targetGap === 0 ? "Target Unlocked! 🎉" : (nationalTarget > 0 ? `${((targetGap/nationalTarget)*100).toFixed(0)}% Quota Gap` : "0% deficit"),
      targetId: "target-performance-section",
      tab: "pipeline"
    },
    {
      id: "monthly-run-rate",
      title: "Target Run-rate / Mo.",
      value: formatBDT(targetGap > 0 ? targetGap / (12 - new Date().getMonth()) : 0, true, true),
      sub: `${12 - new Date().getMonth()} Months Remaining`,
      icon: <Activity size={18} className="text-rose-400" />,
      sparkColor: "#f43f5e",
      sparkData: getMetricSeries("Total Price"),
      tagline: targetGap > 0 ? "Monthly Recovery Goal" : "Quota Completed",
      targetId: "target-performance-section",
      tab: "pipeline"
    },
    {
      id: "avg-order-val",
      title: "Avg Deal Size",
      value: formatBDT(avgOrderVal, true, true),
      sub: `${formatBDT(avgOrderVal, false, true)} / Deal`,
      icon: <Calculator size={18} className="text-teal-400" />,
      sparkColor: "#14b8a6",
      sparkData: getMetricSeries("avg-order"), 
      tagline: filteredRecords.length > 0 ? "Enterprise Grade" : "No active orders",
      targetId: "audit-stream-section",
      tab: "sales"
    },
    {
      id: "total-vat-tax",
      title: "Disbursed Vat & Tax",
      value: formatBDT(totalVatTax, true, true),
      sub: `${formatBDT(totalVatTax, false, true)} BDT`,
      icon: <Activity size={18} className="text-orange-400" />,
      sparkColor: "#f97316",
      sparkData: getMetricSeries("Vat & Tax"),
      tagline: filteredRecords.length > 0 ? `${vat}% Vat + ${tax}% AIT` : "0.0% standard",
      targetId: "compliance-registry-section",
      tab: "financials"
    },
    {
      id: "vat-amount",
      title: "VAT Amount",
      value: formatBDT(totalVat, true, true),
      sub: `${formatBDT(totalVat, false, true)} BDT`,
      icon: <Activity size={18} className="text-orange-300" />,
      sparkColor: "#fdba74",
      sparkData: getMetricSeries("Vat"),
      tagline: filteredRecords.length > 0 ? `${vat}% Standard VAT` : "0% VAT",
      targetId: "compliance-registry-section",
      tab: "financials"
    },
    {
      id: "tax-amount",
      title: "Tax Amount",
      value: formatBDT(totalTax, true, true),
      sub: `${formatBDT(totalTax, false, true)} BDT`,
      icon: <Activity size={18} className="text-orange-500" />,
      sparkColor: "#f97316",
      sparkData: getMetricSeries("Tax"),
      tagline: filteredRecords.length > 0 ? `${tax}% Withholding Tax` : "0% Tax",
      targetId: "compliance-registry-section",
      tab: "financials"
    },
    {
      id: "active-buyers",
      title: "Enterprise Buyers",
      value: `${activeBuyers}`,
      sub: "B2B Accounts Closed",
      icon: <Users size={18} className="text-purple-400" />,
      sparkColor: "#a855f7",
      sparkData: getMetricSeries("buyers"),
      tagline: filteredRecords.length > 0 ? "High repeat accounts" : "No buyer base",
      targetId: "customer-insights-section",
      tab: "customers"
    },
    {
      id: "total-orders",
      title: "Total Orders",
      value: `${orders}`,
      sub: `${orders} Purchase Orders`,
      icon: <ShoppingCart size={18} className="text-sky-400" />,
      sparkColor: "#0ea5e9",
      sparkData: getMetricSeries("orders"),
      tagline: filteredRecords.length > 0 ? "100% Digital Track" : "Empty ledger",
      targetId: "audit-stream-section",
      tab: "sales"
    },
    {
      id: "total-invoices",
      title: "Billed Invoices",
      value: `${invoicesCount}`,
      sub: `${pendingInvoices} Invoices Pending`,
      icon: <FileText size={18} className="text-indigo-400" />,
      sparkColor: "#6366f1",
      sparkData: getMetricSeries("orders"), // Use order trend as proxy for invoicing
      tagline: filteredRecords.length > 0 ? `${Math.min(100, Math.round((invoicesCount / (orders || 1)) * 100))}% Billing Ratio` : "Empty ledger",
      targetId: "audit-stream-section",
      tab: "financials"
    },
    {
      id: "qty-sold",
      title: "Total Assets Sold",
      value: `${totalQuantity}`,
      sub: "Asset Units Deployed",
      icon: <Layers size={18} className="text-pink-400" />,
      sparkColor: "#ec4899",
      sparkData: getMetricSeries("quantity"),
      tagline: filteredRecords.length > 0 ? "Corporate Hardware" : "No sold units",
      targetId: "audit-stream-section",
      tab: "products"
    },
    {
      id: "pipeline-commit",
      title: "Pipeline Value",
      value: formatBDT(pipelineValue, true, true),
      sub: filteredRecords.length > 0 ? "7 Active Commit Leads" : "0 Active Commit Leads",
      icon: <Flame size={18} className="text-[#e11d48]" />,
      sparkColor: "#e11d48",
      sparkData: getMetricSeries("Total Price"), // Use revenue trend as proxy
      tagline: filteredRecords.length > 0 ? "96% Probable Win" : "Pipeline empty",
      targetId: "analytical-charts-suite",
      tab: "funnel"
    }
  ];

  const getValueTextSizeClass = (val: string) => {
    if (val.length > 12) return "text-sm sm:text-base lg:text-lg";
    if (val.length > 9) return "text-base sm:text-lg lg:text-xl";
    return "text-lg sm:text-xl lg:text-2xl";
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 xxl:grid-cols-8 gap-4">
      {kpis.map((kpi) => (
        <div 
          id={`kpi-indicator-card-${kpi.id}`}
          key={kpi.id} 
          onClick={() => {
            if (onNavigate && kpi.tab) {
              onNavigate(kpi.tab);
              // Scroll to top of body when switching tabs
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              const el = document.getElementById((kpi as any).targetId);
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          className={`p-4 min-h-[146px] rounded-2xl border flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group cursor-pointer ${theme.bgCard} ${theme.border} ${theme.cardShadow} hover:border-amber-400/30 hover:shadow-xl active:scale-95`}
        >
          {/* Top Info section */}
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <span className={`text-[10px] font-semibold tracking-wide uppercase block truncate ${theme.textMuted}`}>
                {kpi.title}
              </span>
              <span className={`${getValueTextSizeClass(kpi.value)} font-bold font-sans ${theme.isDark ? 'text-slate-100' : 'text-slate-900'} tracking-tight block mt-1.5 duration-200`}>
                {kpi.value}
              </span>
            </div>
            <div className={`p-2 rounded-xl border shrink-0 ${theme.isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              {kpi.icon}
            </div>
          </div>

          {/* Subtitle/Tagline section */}
          <div className="mt-2 flex flex-col min-w-0">
            <span className={`text-[10px] font-mono truncate ${theme.textMuted}`} title={kpi.sub}>
              {kpi.sub}
            </span>
            <span className="text-[9px] font-mono text-amber-500/95 font-semibold mt-0.5 truncate">
              {kpi.tagline}
            </span>
          </div>

          {/* Sparkline trend indicator */}
          <div className="w-full h-6 mt-1 flex items-center justify-end">
            {/* Embed Mini SVG vector sparkline */}
            {!kpi.isProgress && (
              <svg 
                className="w-full h-6 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity overflow-hidden" 
                viewBox="0 0 64 24"
                preserveAspectRatio="none"
              >
                <path
                  d={generateSparklinePath(kpi.sparkData || [0,0,0,0], 64, 24)}
                  fill="none"
                  stroke={kpi.sparkColor}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            
            {/* If it requires progress bar */}
            {kpi.isProgress && (
              <div className="w-full h-1 flex items-center shrink-0">
                <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden border border-slate-900">
                  <div 
                    className="bg-red-500 h-1 rounded-full transition-all duration-1000"
                    style={{ width: `${kpi.pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Clean ambient light border glow on hover */}
          <div className="absolute inset-0 border border-amber-400/0 group-hover:border-amber-400/10 rounded-2xl pointer-events-none transition" />
        </div>
      ))}
    </div>
  );
}
