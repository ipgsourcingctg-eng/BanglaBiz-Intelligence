/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Layers,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Trophy,
  Calendar,
  AlertOctagon,
  Percent,
  Search,
  ExternalLink,
  ShieldCheck,
  Settings,
  Trash2,
  Package,
  Users,
  Building2,
  Tag,
  PercentCircle,
  MapPin,
  Briefcase,
  CircleDollarSign,
  Wallet,
  Timer,
  Activity,
  Receipt,
  FileCheck,
  FileSpreadsheet,
} from "lucide-react";
import {
  SalesRecord,
  DashboardTheme,
  TargetDetails,
  PipelineItem,
  VatTaxMode,
  CollectionRecord,
  DashboardFilters,
  YearlyEntityTarget,
  FunnelRecord,
} from "../types";
import Filters from "../components/Filters";
import { formatBDT, formatDate, normalizeName } from "../utils/format";
import {
  exportDashboardToPdf,
  exportDashboardToSlides,
  exportToExcel,
} from "../utils/export";
import {
  getVatTaxRates,
  saveVatTaxRates,
  getRowVisibilitySettings,
  saveRowVisibilitySettings,
  getYearlyEntityTargets,
  saveYearlyEntityTargets,
  updateRecordVatMode,
  updateRecordCustomRates,
  getLocalCollectionRecords,
  getLocalSalesRecords,
  getMonthsList,
} from "../db/localDb";

export interface DashboardTargetDetails {
  branchOrName: string;
  target: number;
  collectionTarget: number;
  actual: number;
  actualCollection: number;
  achievementRate: number;
  collectionAchievementRate: number;
  gap: number;
  collectionGap: number;
}

export const getTargetScaleFactor = (
  year: number,
  startDateStr?: string,
  endDateStr?: string
): number => {
  if (!startDateStr || !endDateStr) return 1.0;

  // Check for standard quarters of this target year
  if (startDateStr === `${year}-01-01` && endDateStr === `${year}-03-31`) return 0.25;
  if (startDateStr === `${year}-04-01` && endDateStr === `${year}-06-30`) return 0.25;
  if (startDateStr === `${year}-07-01` && endDateStr === `${year}-09-30`) return 0.25;
  if (startDateStr === `${year}-10-01` && endDateStr === `${year}-12-31`) return 0.25;

  // Check for standard halves
  if (startDateStr === `${year}-01-01` && endDateStr === `${year}-06-30`) return 0.50;
  if (startDateStr === `${year}-07-01` && endDateStr === `${year}-12-31`) return 0.50;

  // Check for full year
  if (startDateStr === `${year}-01-01` && endDateStr === `${year}-12-31`) return 1.0;

  // Proportional day calculation
  const yearStart = new Date(`${year}-01-01`).getTime();
  const yearEnd = new Date(`${year}-12-31`).getTime();
  const filterStart = new Date(startDateStr).getTime();
  const filterEnd = new Date(endDateStr).getTime();

  if (isNaN(yearStart) || isNaN(yearEnd) || isNaN(filterStart) || isNaN(filterEnd)) {
    return 1.0;
  }

  const intersectStart = Math.max(yearStart, filterStart);
  const intersectEnd = Math.min(yearEnd, filterEnd);

  if (intersectStart > intersectEnd) {
    return 0.0;
  }

  const overlapMs = intersectEnd - intersectStart;
  const overlapDays = Math.round(overlapMs / (1000 * 60 * 60 * 24)) + 1;

  const yearTotalMs = yearEnd - yearStart;
  const yearTotalDays = Math.round(yearTotalMs / (1000 * 60 * 60 * 24)) + 1;

  return overlapDays / yearTotalDays;
};

export const calculateScaledTarget = (
  entity: YearlyEntityTarget,
  filters?: DashboardFilters
): { salesTarget: number; collectionTarget: number } => {
  const start = filters?.dateRange?.[0];
  const end = filters?.dateRange?.[1];

  let scale = 1.0;
  if (start && end) {
    scale = getTargetScaleFactor(entity.year, start, end);
  }

  // If a custom monthly breakdown is defined, sum across the overlapping range
  if (entity.monthlyBreakdown && entity.monthlyBreakdown.length > 0 && start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      let salesSum = 0;
      let hasOverlap = false;

      entity.monthlyBreakdown.forEach((mb) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const monthStartStr = `${entity.year}-${pad(mb.month)}-01`;
        
        const nextMonth = mb.month === 12 ? 1 : mb.month + 1;
        const nextYear = mb.month === 12 ? entity.year + 1 : entity.year;
        const monthEndStr = new Date(new Date(`${nextYear}-${pad(nextMonth)}-01`).getTime() - 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];

        const mStart = new Date(monthStartStr).getTime();
        const mEnd = new Date(monthEndStr).getTime();
        const fStart = startDate.getTime();
        const fEnd = endDate.getTime();

        const intersectStart = Math.max(mStart, fStart);
        const intersectEnd = Math.min(mEnd, fEnd);

        if (intersectStart <= intersectEnd) {
          hasOverlap = true;
          const overlapMs = intersectEnd - intersectStart;
          const overlapDays = Math.round(overlapMs / (1000 * 60 * 60 * 24)) + 1;
          const totalDaysInMonth = Math.round((mEnd - mStart) / (1000 * 60 * 60 * 24)) + 1;
          const fraction = overlapDays / totalDaysInMonth;

          salesSum += (mb.sales || 0) * fraction;
        }
      });

      if (hasOverlap) {
        return { salesTarget: salesSum, collectionTarget: salesSum };
      }
    }
  }

  // Check for specific targets if it is a perfect quarter match
  if (start && end) {
    if (start === `${entity.year}-01-01` && end === `${entity.year}-03-31`) {
      if (entity.q1Target && entity.q1Target > 0) {
        return {
          salesTarget: entity.q1Target,
          collectionTarget: entity.q1Target
        };
      }
    } else if (start === `${entity.year}-04-01` && end === `${entity.year}-06-30`) {
      if (entity.q2Target && entity.q2Target > 0) {
        return {
          salesTarget: entity.q2Target,
          collectionTarget: entity.q2Target
        };
      }
    } else if (start === `${entity.year}-07-01` && end === `${entity.year}-09-30`) {
      if (entity.q3Target && entity.q3Target > 0) {
        return {
          salesTarget: entity.q3Target,
          collectionTarget: entity.q3Target
        };
      }
    } else if (start === `${entity.year}-10-01` && end === `${entity.year}-12-31`) {
      if (entity.q4Target && entity.q4Target > 0) {
        return {
          salesTarget: entity.q4Target,
          collectionTarget: entity.q4Target
        };
      }
    } else if (start === `${entity.year}-01-01` && end === `${entity.year}-06-30`) {
      if (entity.h1Target && entity.h1Target > 0) {
        return {
          salesTarget: entity.h1Target,
          collectionTarget: entity.h1Target
        };
      }
    } else if (start === `${entity.year}-07-01` && end === `${entity.year}-12-31`) {
      if (entity.h2Target && entity.h2Target > 0) {
        return {
          salesTarget: entity.h2Target,
          collectionTarget: entity.h2Target
        };
      }
    }
  }

  // Fallback to proportional scaling
  const salesTarget = (entity.totalTarget || 0) * scale;
  // USER REQUIREMENT: Collection Target is always synchronized and identical to calculated actual sales
  // However, we still use the entity's own value if that's the source, but the user requested synchronization.
  // We'll handle the identical override in the mapping logic below to ensure it matches the actuals.
  return { salesTarget, collectionTarget: salesTarget };
};

export const getBranchTargets = (
  records: SalesRecord[],
  collectionRecords: CollectionRecord[] = [],
  filters?: DashboardFilters
): DashboardTargetDetails[] => {
  if (!records || records.length === 0) return [];

  let yearsInFiltered: number[] = [];
  if (filters && filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
    const startYear = new Date(filters.dateRange[0]).getFullYear();
    const endYear = new Date(filters.dateRange[1]).getFullYear();
    if (!isNaN(startYear) && !isNaN(endYear)) {
      for (let y = startYear; y <= endYear; y++) {
        yearsInFiltered.push(y);
      }
    }
  }

  if (yearsInFiltered.length === 0) {
    yearsInFiltered = Array.from(
      new Set(
        records.map((r) => {
          const dateStr = r["Invoice Date"] || r["Sales Date"];
          if (!dateStr) return null;
          const parts = dateStr.split("-");
          return parts[0] ? parseInt(parts[0], 10) : null;
        }).filter(Boolean)
      )
    ) as number[];
  }

  if (yearsInFiltered.length === 0) {
    yearsInFiltered.push(new Date().getFullYear());
  }

  const branchMap: Record<
    string,
    { actual: number; actualCollection: number }
  > = {};

  const salesBranches = Array.from(new Set(records.map(r => r.Branch || "Unassigned").filter(b => b && b !== "Unassigned")));
  const defaultBranch = salesBranches[0] || "Chattogram Corporate Branch";

  records.forEach((r) => {
    let branch = r.Branch || defaultBranch;
    if (branch === "Unassigned") {
      branch = defaultBranch;
    }
    const total = r["Total Price"] || 0;

    if (!branchMap[branch])
      branchMap[branch] = { actual: 0, actualCollection: 0 };
    branchMap[branch].actual += total;
  });

  // map collections to branches
  const fbSales = getLocalSalesRecords();

  collectionRecords.forEach((c) => {
    let branch = "";

    // 1. Try branch directly from the collection record (if imported from sheet)
    if (c.branch) {
      const matched = salesBranches.find(b => normalizeName(b) === normalizeName(c.branch || ""));
      if (matched) {
        branch = matched;
      } else {
        branch = c.branch;
      }
    }

    // 2. If no branch yet, try invoice lookup in fbSales
    if (!branch && c.invoiceNo) {
      const sale = fbSales.find((s) => s.Invoice === c.invoiceNo);
      if (sale && sale.Branch && sale.Branch !== "Unassigned") {
        branch = sale.Branch;
      } else {
        const saleByBuyer = fbSales.find((s) => s.Buyer === c.buyerName);
        if (saleByBuyer && saleByBuyer.Branch && saleByBuyer.Branch !== "Unassigned") {
          branch = saleByBuyer.Branch;
        }
      }
    }

    // 3. Fallback to buyer lookup in fbSales
    if (!branch) {
      const sale = fbSales.find((s) => s.Buyer === c.buyerName);
      if (sale && sale.Branch && sale.Branch !== "Unassigned") {
        branch = sale.Branch;
      }
    }

    // 4. Ultimate fallback to default branch to prevent "Unassigned" branch from being created
    if (!branch || branch === "Unassigned") {
      branch = defaultBranch;
    }

    if (!branchMap[branch]) {
      branchMap[branch] = { actual: 0, actualCollection: 0 };
    }
    branchMap[branch].actualCollection += c.amountCollected;
  });

  const yearlyTargets = getYearlyEntityTargets("Branch");
  const activeYearTargets = yearlyTargets.filter((t) => yearsInFiltered.includes(t.year));

  // Compute global lifetime sales and collections per branch
  const fbAllCollections = getLocalCollectionRecords();
  const branchGlobalSalesMap: Record<string, number> = {};
  const branchGlobalCollectionMap: Record<string, number> = {};

  fbSales.forEach(r => {
    let branch = r.Branch || defaultBranch;
    if (branch === "Unassigned") branch = defaultBranch;
    if (!branchGlobalSalesMap[branch]) branchGlobalSalesMap[branch] = 0;
    branchGlobalSalesMap[branch] += (r["Total Price"] || 0);
  });

  fbAllCollections.forEach(c => {
    let branch = "";
    if (c.branch) {
      const matched = salesBranches.find(b => normalizeName(b) === normalizeName(c.branch || ""));
      branch = matched || c.branch;
    }
    if (!branch && c.invoiceNo) {
      const sale = fbSales.find((s) => s.Invoice === c.invoiceNo);
      if (sale && sale.Branch && sale.Branch !== "Unassigned") branch = sale.Branch;
      else {
        const saleByBuyer = fbSales.find((s) => s.Buyer === c.buyerName);
        if (saleByBuyer && saleByBuyer.Branch && saleByBuyer.Branch !== "Unassigned") branch = saleByBuyer.Branch;
      }
    }
    if (!branch) {
      const sale = fbSales.find((s) => s.Buyer === c.buyerName);
      if (sale && sale.Branch && sale.Branch !== "Unassigned") branch = sale.Branch;
    }
    if (!branch || branch === "Unassigned") branch = defaultBranch;

    if (!branchGlobalCollectionMap[branch]) branchGlobalCollectionMap[branch] = 0;
    branchGlobalCollectionMap[branch] += c.amountCollected;
  });

  return Object.entries(branchMap)
    .map(([branchName, totals]) => {
      // Find all custom targets across all represented years matching normalized names
      const branchEntities = activeYearTargets.filter(
        (t) => normalizeName(t.entityName) === normalizeName(branchName)
      );

      let target: number | undefined;
      let collTarget: number | undefined;

      if (branchEntities.length > 0) {
        let salesSum = 0;
        let collSum = 0;
        branchEntities.forEach((e) => {
          const res = calculateScaledTarget(e, filters);
          salesSum += res.salesTarget;
          collSum += res.collectionTarget;
        });
        target = salesSum;
        collTarget = collSum;
      }

      if (target === undefined || target === null || target === 0) {
        const baseTarget = totals.actual * 1.15;
        target = Math.max(1000000, Math.ceil(baseTarget / 500000) * 500000);
      }

      // USER REQUIREMENT: Current Year Collection Target = Total Sales Value of All Years - Total Collection of All Years
      const totalSalesAllTime = branchGlobalSalesMap[branchName] || 0;
      const totalColAllTime = branchGlobalCollectionMap[branchName] || 0;
      collTarget = Math.max(0, totalSalesAllTime - totalColAllTime);

      const { actual, actualCollection } = totals;
      const achievementRate =
        target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;
      const collectionAchievementRate =
        collTarget > 0
          ? Math.round((actualCollection / collTarget) * 1000) / 10
          : 0;
      const gap = Math.max(0, target - actual);
      const collectionGap = Math.max(0, collTarget - actualCollection);

      return {
        branchOrName: branchName,
        target,
        collectionTarget: collTarget,
        actual,
        actualCollection,
        achievementRate,
        collectionAchievementRate,
        gap,
        collectionGap,
      };
    })
    .sort((a, b) => b.actual - a.actual);
};

export const getRepresentativeTargets = (
  records: SalesRecord[],
  collectionRecords: CollectionRecord[] = [],
  filters?: DashboardFilters
): DashboardTargetDetails[] => {
  if (!records || records.length === 0) return [];

  let yearsInFiltered: number[] = [];
  if (filters && filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
    const startYear = new Date(filters.dateRange[0]).getFullYear();
    const endYear = new Date(filters.dateRange[1]).getFullYear();
    if (!isNaN(startYear) && !isNaN(endYear)) {
      for (let y = startYear; y <= endYear; y++) {
        yearsInFiltered.push(y);
      }
    }
  }

  if (yearsInFiltered.length === 0) {
    yearsInFiltered = Array.from(
      new Set(
        records.map((r) => {
          const dateStr = r["Invoice Date"] || r["Sales Date"];
          if (!dateStr) return null;
          const parts = dateStr.split("-");
          return parts[0] ? parseInt(parts[0], 10) : null;
        }).filter(Boolean)
      )
    ) as number[];
  }

  if (yearsInFiltered.length === 0) {
    yearsInFiltered.push(new Date().getFullYear());
  }

  const repMap: Record<string, { actual: number; actualCollection: number }> =
    {};
  records.forEach((r) => {
    const rep = r["Sales Person"] || "Unassigned";
    const total = r["Total Price"] || 0;

    if (!repMap[rep]) repMap[rep] = { actual: 0, actualCollection: 0 };
    repMap[rep].actual += total;
  });

  // map collections to reps
  const fbSales = getLocalSalesRecords();

  collectionRecords.forEach((c) => {
    let rep = "Unassigned";
    if (c.invoiceNo) {
      const sale = fbSales.find((s) => s.Invoice === c.invoiceNo);
      if (sale) {
        rep = sale["Sales Person"] || "Unassigned";
      } else {
        const saleByBuyer = fbSales.find((s) => s.Buyer === c.buyerName);
        if (saleByBuyer) {
          rep = saleByBuyer["Sales Person"] || "Unassigned";
        }
      }
    } else {
      const sale = fbSales.find((s) => s.Buyer === c.buyerName);
      if (sale) {
        rep = sale["Sales Person"] || "Unassigned";
      }
    }

    if (!repMap[rep]) {
      repMap[rep] = { actual: 0, actualCollection: 0 };
    }
    repMap[rep].actualCollection += c.amountCollected;
  });

  const yearlyTargets = getYearlyEntityTargets("KAM");
  const activeYearTargets = yearlyTargets.filter((t) => yearsInFiltered.includes(t.year));

  // Compute global lifetime sales and collections per KAM to formulate collection target properly
  const fbAllCollections = getLocalCollectionRecords();
  const kamGlobalSalesMap: Record<string, number> = {};
  const kamGlobalCollectionMap: Record<string, number> = {};
  
  fbSales.forEach(r => {
    const rep = r["Sales Person"] || "Unassigned";
    if (!kamGlobalSalesMap[rep]) kamGlobalSalesMap[rep] = 0;
    kamGlobalSalesMap[rep] += (r["Total Price"] || 0);
  });

  fbAllCollections.forEach(c => {
    let rep = "Unassigned";
    if (c.invoiceNo) {
      const sale = fbSales.find((s) => s.Invoice === c.invoiceNo);
      if (sale) {
        rep = sale["Sales Person"] || "Unassigned";
      } else {
        const saleByBuyer = fbSales.find((s) => s.Buyer === c.buyerName);
        if (saleByBuyer) {
          rep = saleByBuyer["Sales Person"] || "Unassigned";
        }
      }
    } else {
      const sale = fbSales.find((s) => s.Buyer === c.buyerName);
      if (sale) {
        rep = sale["Sales Person"] || "Unassigned";
      }
    }
    if (!kamGlobalCollectionMap[rep]) kamGlobalCollectionMap[rep] = 0;
    kamGlobalCollectionMap[rep] += c.amountCollected;
  });

  return Object.entries(repMap)
    .filter(([repName]) => repName && repName.toLowerCase().trim() !== "unassigned" && repName.toLowerCase().trim() !== "unknown" && repName.toLowerCase().trim() !== "")
    .map(([repName, totals]) => {
      // Find all custom targets across all represented years matching normalized names
      const kamEntities = activeYearTargets.filter(
        (t) => normalizeName(t.entityName) === normalizeName(repName)
      );

      let target: number | undefined;
      let collTarget: number | undefined;

      if (kamEntities.length > 0) {
        let salesSum = 0;
        let collSum = 0;
        kamEntities.forEach((e) => {
          const res = calculateScaledTarget(e, filters);
          salesSum += res.salesTarget;
          collSum += res.collectionTarget;
        });
        target = salesSum;
        collTarget = collSum;
      }

      if (target === undefined || target === null || target === 0) {
        const baseTarget = totals.actual * 1.12;
        target = Math.max(500000, Math.ceil(baseTarget / 250000) * 250000);
      }

      // USER REQUIREMENT: Current Year Collection Target = KAM Total Sales Value of All Years - KAM Total Collection of All Years
      const totalSalesAllTime = kamGlobalSalesMap[repName] || 0;
      const totalColAllTime = kamGlobalCollectionMap[repName] || 0;
      collTarget = Math.max(0, totalSalesAllTime - totalColAllTime);

      const { actual, actualCollection } = totals;
      const achievementRate =
        target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;
      const collectionAchievementRate =
        collTarget > 0
          ? Math.round((actualCollection / collTarget) * 1000) / 10
          : 0;
      const gap = Math.max(0, target - actual);
      const collectionGap = Math.max(0, collTarget - actualCollection);

      return {
        branchOrName: repName,
        target,
        collectionTarget: collTarget,
        actual,
        actualCollection,
        achievementRate,
        collectionAchievementRate,
        gap,
        collectionGap,
      };
    })
    .sort((a, b) => b.actual - a.actual);
};

interface PageProps {
  filteredRecords: SalesRecord[];
  allRecords: SalesRecord[];
  theme: DashboardTheme;
  filters?: DashboardFilters;
  setFilters?: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  activeTab?: string;
  collectionRecords?: CollectionRecord[];
  filteredCollectionRecords?: CollectionRecord[];
  funnelRecords?: FunnelRecord[];
  filteredFunnelRecords?: FunnelRecord[];
}

// ==========================================
// SHARED UI COMPONENTS
// ==========================================
export function KpiCard({
  title,
  value,
  subValue,
  icon: Icon,
  colorClass,
  theme,
  trend,
}: {
  title: string;
  value: string;
  subValue: string;
  icon: any;
  colorClass: string;
  theme: DashboardTheme;
  trend?: { label: string; positive: boolean };
}) {
  const iconColor = colorClass.replace("bg-", "text-");
  const borderColor = colorClass.replace("bg-", "border-");

  return (
    <div
      className={`p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} transition-all hover:border-slate-700/50 group relative overflow-hidden`}
    >
      {/* Background Accent Glow */}
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${colorClass} opacity-[0.03] blur-2xl group-hover:opacity-[0.07] transition-opacity`} />
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full border border-dashed ${borderColor}/30 ${colorClass}/10 group-hover:scale-110 transition-transform`}
        >
          <Icon size={20} className={iconColor} />
        </div>
        {trend && (
          <div
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${trend.positive ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}
          >
            {trend.positive ? "↑" : "↓"} {trend.label}
          </div>
        )}
      </div>
      <h4 className="text-[10px] uppercase font-mono tracking-widest text-slate-400 mb-1 relative z-10">
        {title}
      </h4>
      <div className={`text-2xl font-bold font-mono truncate relative z-10 ${theme.isDark ? 'text-white' : 'text-slate-900'}`}>
        {value}
      </div>
      <p className="text-[10px] text-slate-500 mt-2 font-sans relative z-10">{subValue}</p>
    </div>
  );
}

const DashboardTargetRow: React.FC<{
  col: any;
  allRecords: any[];
  setRefreshKey: any;
}> = ({ col, allRecords, setRefreshKey }) => {
  const isTop = col.achievementRate >= 90;
  const [isEditing, setIsEditing] = useState(false);
  const [editTarget, setEditTarget] = useState(col.target);
  const [editCollTarget, setEditCollTarget] = useState(col.collectionTarget);

  const saveTargets = () => {
    const yearlyTargets = getYearlyEntityTargets("Branch");
    const currentYear =
      allRecords.length > 0
        ? parseInt((allRecords[0]["Invoice Date"] || allRecords[0]["Sales Date"]).split("-")[0], 10)
        : new Date().getFullYear();

    const existingIdx = yearlyTargets.findIndex(
      (t) => normalizeName(t.entityName) === normalizeName(col.branchOrName) && t.year === currentYear,
    );
    if (existingIdx !== -1) {
      yearlyTargets[existingIdx].totalTarget = editTarget;
      yearlyTargets[existingIdx].totalCollectionTarget = editTarget; // Kept for DB consistency, though UI uses actuals
    } else {
      yearlyTargets.push({
        year: currentYear,
        entityName: col.branchOrName,
        totalTarget: editTarget,
        totalCollectionTarget: editTarget,
        monthlyBreakdown: [],
      });
    }
    saveYearlyEntityTargets("Branch", yearlyTargets);
    setIsEditing(false);
    setRefreshKey((prev: number) => prev + 1);
  };

  return (
    <tr className="hover:bg-slate-900/60 transition">
      <td className="py-3 font-semibold text-slate-200">{col.branchOrName}</td>
      <td className="py-3 text-right">
        {isEditing ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-[9px] text-slate-500 uppercase font-mono mr-1">TGT:</span>
            <input
              type="number"
              value={editTarget}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setEditTarget(val);
                setEditCollTarget(val);
              }}
              className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 w-24 text-right text-[10px] font-mono text-indigo-400 outline-none focus:border-indigo-500"
            />
            <div className="flex flex-col items-end opacity-50 ml-1">
              <span className="text-[8px] text-slate-500 uppercase font-mono leading-none">Coll Sync</span>
              <span className="text-[9px] text-emerald-500 font-mono">{formatBDT(col.actual, true, true)}</span>
            </div>
            <button
              onClick={saveTargets}
              className="text-emerald-500 hover:text-emerald-400 p-0.5"
            >
              <ShieldCheck size={14} />
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="text-rose-500 hover:text-rose-400 p-0.5"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <div
            className="flex items-center justify-end gap-1.5 group font-mono cursor-pointer hover:bg-white/5 p-1 rounded transition"
            onClick={() => setIsEditing(true)}
          >
            <span className="text-indigo-400">
              {formatBDT(col.target, true, true)}
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-emerald-500">
              {formatBDT(col.collectionTarget, true, true)}
            </span>
            <Settings
              size={10}
              className="text-slate-600 opacity-0 group-hover:opacity-100"
            />
          </div>
        )}
      </td>
      <td className="py-3 text-right font-mono text-indigo-400 font-semibold">
        {formatBDT(col.actual, true, true)}
      </td>
      <td className="py-3 text-right font-mono text-emerald-400 font-semibold">
        {formatBDT(col.actualCollection, true, true)}
      </td>
      <td className="py-3 text-center">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500 uppercase font-mono">
              S:
            </span>
            <span className="font-mono font-bold text-indigo-400">
              {col.achievementRate}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500 uppercase font-mono">
              C:
            </span>
            <span className="font-mono font-bold text-emerald-400">
              {col.collectionAchievementRate}%
            </span>
          </div>
        </div>
      </td>
      <td className="py-3">
        {isTop ? (
          <span className="bg-emerald-500/15 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
            Target Sealed
          </span>
        ) : (
          <span className="bg-amber-500/15 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
            Progressing
          </span>
        )}
      </td>
    </tr>
  );
};

// ==========================================
// 1. DASHBOARD OVERVIEW PAGE
// ==========================================
export function DashboardOverviewPage({
  filteredRecords,
  filteredCollectionRecords,
  allRecords,
  theme,
  filters,
}: PageProps & { filteredCollectionRecords: CollectionRecord[] }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const branchTargets = getBranchTargets(filteredRecords, filteredCollectionRecords, filters);
  const nationalTarget = branchTargets.reduce((sum, b) => sum + b.target, 0);
  const totalSales = filteredRecords.reduce(
    (sum, r) => sum + r["Total Price"],
    0,
  );
  const totalColl = filteredCollectionRecords.reduce(
    (sum, c) => sum + c.amountCollected,
    0
  );
  const achievement =
    nationalTarget > 0 ? (totalSales / nationalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Executive KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          title="Gross Revenue Actual"
          value={formatBDT(totalSales, true, true)}
          subValue="Cumulative sales volume across all outlets"
          icon={TrendingUp}
          colorClass="bg-indigo-500"
          theme={theme}
        />
        <KpiCard
          title="Total Realized Cash"
          value={formatBDT(totalColl, true, true)}
          subValue="Total volume of successfully billed invoices"
          icon={CircleDollarSign}
          colorClass="bg-emerald-500"
          theme={theme}
        />
        <KpiCard
          title="Global Achievement"
          value={`${achievement.toFixed(1)}%`}
          subValue="Performance against national branch targets"
          icon={Trophy}
          colorClass="bg-amber-500"
          theme={theme}
          trend={{ label: "Dynamic Target", positive: true }}
        />
      </div>

      {/* Executive Briefing Welcome */}
      <div
        className={`p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 shadow-lg`}
      >
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <span>৳</span>
          Executive Portfolio Briefing — B2B Distribution Bangladesh
        </h3>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          {allRecords.length > 0 ? (
            <span>
              National distribution overview based on active records. Cumulative
              gross sales in Bangladeshi Taka is running towards the dynamic
              target of <strong>{formatBDT(nationalTarget, true, true)}</strong>{" "}
              (calculated as a sum of manually and automatically set branch
              targets). Active transactions reflect B2B distribution activities
              across major local districts and buyers.
            </span>
          ) : (
            <span>
              Welcome to the distribution portfolio briefing dashboard. The
              database has been initialized with 0 records to guarantee no
              test/mock data is displayed. Please import or drag and drop your
              active MS Excel workbook (.xlsx, .xls) via the{" "}
              <strong>Sync Engine</strong> in the top navbar to populate all
              analytical charts, tables, and KPIs!
            </span>
          )}
        </p>
      </div>

      {/* Regional Branch Performance Detailed Table */}
      <div
        id="branch-performance-section"
        className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} scroll-mt-24`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={15} className="text-amber-400" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
              National Branch Target vs Actual (BDT)
            </span>
          </div>
          <span className="font-mono text-[9px] text-[#94A3B8]">
            National Board review (Hover target to edit manually)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-sans">
            <thead>
              <tr className="border-b border-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                <th className="pb-2.5">Branch Location</th>
                <th className="pb-2.5 text-right w-64">
                  Corporate Target (Sales | Coll)
                </th>
                <th className="pb-2.5 text-right">Actual sales</th>
                <th className="pb-2.5 text-right">Actual Collection</th>
                <th className="pb-2.5 text-center">Achieve %</th>
                <th className="pb-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {branchTargets.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-slate-500 font-mono text-[10px] italic"
                  >
                    No regional branch data found. Please synchronise an Excel
                    record using the Sync Engine to populate the Target Board.
                  </td>
                </tr>
              ) : (
                branchTargets.map((col) => (
                  <DashboardTargetRow
                    key={col.branchOrName}
                    col={col}
                    allRecords={allRecords}
                    setRefreshKey={setRefreshKey}
                  />
                ))
              )}
            </tbody>
            {branchTargets.length > 0 && (
              <tfoot className="border-t border-slate-800">
                <tr className="bg-slate-900/30 text-slate-100 font-bold">
                  <td className="py-3 text-[10px] uppercase font-mono px-2 text-slate-400">
                    National Total
                  </td>
                  <td className="py-3 text-right font-mono text-[10px] flex items-center justify-end gap-2 pr-1">
                    <span className="text-indigo-400">
                      {formatBDT(
                        branchTargets.reduce((s, b) => s + b.target, 0),
                        true,
                        true,
                      )}
                    </span>
                    <span className="text-slate-700">|</span>
                    <span className="text-emerald-500">
                      {formatBDT(
                        branchTargets.reduce(
                          (s, b) => s + b.collectionTarget,
                          0,
                        ),
                        true,
                        true,
                      )}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono text-indigo-400 text-[10px]">
                    {formatBDT(
                      branchTargets.reduce((s, b) => s + b.actual, 0),
                      true,
                      true,
                    )}
                  </td>
                  <td className="py-3 text-right font-mono text-emerald-400 text-[10px]">
                    {formatBDT(
                      branchTargets.reduce((s, b) => s + b.actualCollection, 0),
                      true,
                      true,
                    )}
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-[9px] text-indigo-400">
                        S:{" "}
                        {(() => {
                          const t = branchTargets.reduce(
                            (s, b) => s + b.target,
                            0,
                          );
                          const a = branchTargets.reduce(
                            (s, b) => s + b.actual,
                            0,
                          );
                          return t > 0 ? Math.round((a / t) * 1000) / 10 : 0;
                        })()}
                        %
                      </span>
                      <span className="font-mono text-[9px] text-emerald-400">
                        C:{" "}
                        {(() => {
                          const t = branchTargets.reduce(
                            (s, b) => s + b.collectionTarget,
                            0,
                          );
                          const a = branchTargets.reduce(
                            (s, b) => s + b.actualCollection,
                            0,
                          );
                          return t > 0 ? Math.round((a / t) * 1000) / 10 : 0;
                        })()}
                        %
                      </span>
                    </div>
                  </td>
                  <td className="py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. SALES ANALYTICS PAGE
// ==========================================
export function SalesAnalyticsPage({
  filteredRecords,
  allRecords,
  theme,
  filteredCollectionRecords = [],
  filters,
}: PageProps & { filteredCollectionRecords?: CollectionRecord[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [editingModeId, setEditingModeId] = useState<number | null>(null);
  const [editingRatesId, setEditingRatesId] = useState<number | null>(null);
  const [tempRates, setTempRates] = useState<{ vat?: number; tax?: number }>(
    {},
  );

  const [settings, setSettings] = useState(() => {
    const s = getRowVisibilitySettings("audit_stream");
    return {
      rowsPerPage: s.rowsPerPage || 10,
      hiddenItems: s.hiddenItems || [],
      hiddenColumns: (s as any).hiddenColumns || [],
    };
  });
  const [isOpen, setIsOpen] = useState(false);

  const ALL_COLUMNS = [
    { id: "no", label: "SL" },
    { id: "date", label: "Invoice Date" },
    { id: "order", label: "Order/Invoice" },
    { id: "branch", label: "Branch" },
    { id: "client", label: "Client & Industry" },
    { id: "product", label: "Product" },
    { id: "vat_mode", label: "VAT/Tax Mode" },
    { id: "custom_rates", label: "Custom Rates" },
    { id: "qty", label: "Qty" },
    { id: "total", label: "Gross Total" },
  ];

  const updateRowsPerPage = (num: number) => {
    const updated = { ...settings, rowsPerPage: num };
    setSettings(updated);
    saveRowVisibilitySettings("audit_stream", updated);
    setCurrentPage(1);
  };

  const totalSales = filteredRecords.reduce(
    (sum, r) => sum + r["Total Price"],
    0,
  );
  const avgOrder =
    filteredRecords.length > 0 ? totalSales / filteredRecords.length : 0;
  const totalQty = filteredRecords.reduce((sum, r) => sum + r.Quantity, 0);

  const toggleColumnHidden = (colId: string) => {
    const isHidden = settings.hiddenColumns.includes(colId);
    const newHidden = isHidden
      ? settings.hiddenColumns.filter((id: string) => id !== colId)
      : [...settings.hiddenColumns, colId];

    const updated = { ...settings, hiddenColumns: newHidden };
    setSettings(updated);
    saveRowVisibilitySettings("audit_stream", updated);
  };

  const isColVisible = (colId: string) =>
    !settings.hiddenColumns.includes(colId);

  const toggleRowHidden = (orderId: string) => {
    const isHidden = settings.hiddenItems.includes(orderId);
    const newHidden = isHidden
      ? settings.hiddenItems.filter((item) => item !== orderId)
      : [...settings.hiddenItems, orderId];

    const updated = { ...settings, hiddenItems: newHidden };
    setSettings(updated);
    saveRowVisibilitySettings("audit_stream", updated);
    setCurrentPage(1);
  };

  // Filter records based on selected rows to show
  const visibleRecords = filteredRecords.filter(
    (r) => !settings.hiddenItems.includes(r["Sales Order"]),
  );

  const rowsPerPage = settings.rowsPerPage;
  const totalItems = visibleRecords.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedList = visibleRecords.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

  // Grand totals across all matched/filtered records that are selected to show
  const grandTotalQty = visibleRecords.reduce(
    (sum, r) => sum + (r.Quantity || 0),
    0,
  );
  const grandTotalPrice = visibleRecords.reduce(
    (sum, r) => sum + (r["Total Price"] || 0),
    0,
  );

  // --- Monthly Performance Chart Logic ---
  let currentYear = new Date().getFullYear();
  if (visibleRecords.length > 0) {
    for (const r of visibleRecords) {
      const dateStr = r["Invoice Date"] || r["Sales Date"];
      if (dateStr) {
        // Handle YYYY-MM-DD or DD-MMM-YYYY or custom split
        const yearPart = dateStr.includes("-") 
          ? dateStr.split("-")[0] 
          : dateStr.includes("/") 
            ? dateStr.split("/")[0] 
            : "";
        if (yearPart && yearPart.length === 4) {
          const yr = parseInt(yearPart, 10);
          if (!isNaN(yr)) {
            currentYear = yr;
            break;
          }
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          currentYear = d.getFullYear();
          break;
        }
      }
    }
  }

  // Calculate targets specifically based on the filtered records for the active selected year.
  // Using filteredRecords instead of allRecords guarantees targets align with the selected year!
  const branchTargets = getBranchTargets(filteredRecords, filteredCollectionRecords, filters);
  const nationalTarget = branchTargets.reduce((sum, b) => sum + b.target, 0);
  const monthlyTarget = nationalTarget / 12;

  const months = getMonthsList();

  const chartData = months.map((monthName, index) => {
    const monthNum = index + 1;
    const monthRecords = visibleRecords.filter((r) => {
      const dateVal = r["Invoice Date"] || r["Sales Date"] || "";
      if (!dateVal) return false;
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        return d.getFullYear() === currentYear && (d.getMonth() + 1) === monthNum;
      }
      const parts = dateVal.split("-");
      return (
        parseInt(parts[0], 10) === currentYear &&
        parseInt(parts[1], 10) === monthNum
      );
    });

    const sales = monthRecords.reduce((sum, r) => sum + (r["Total Price"] || 0), 0);
    const monthCollectionRecords = filteredCollectionRecords.filter((c) => {
      const dateVal = c.paymentDate || "";
      if (!dateVal) return false;
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        return d.getFullYear() === currentYear && (d.getMonth() + 1) === monthNum;
      }
      const parts = dateVal.split("-");
      return (
        parseInt(parts[0], 10) === currentYear &&
        parseInt(parts[1], 10) === monthNum
      );
    });
    const collection = monthCollectionRecords.reduce((sum, c) => sum + (c.amountCollected || 0), 0);

    return {
      name: monthName,
      sales: Math.round(sales),
      collection: Math.round(collection),
      target: Math.round(monthlyTarget),
    };
  });

  const totalSalesActual = visibleRecords.reduce(
    (sum, r) => sum + r["Total Price"],
    0,
  );
  const totalCollectionActual = filteredCollectionRecords.reduce(
    (sum, c) => sum + c.amountCollected,
    0
  );
  const totalSalesTarget = nationalTarget;
  // Collection target is equal to total actual sales
  const totalCollectionTarget = totalSalesActual;

  const salesPieData = [
    { name: "Achieved", value: totalSalesActual },
    {
      name: "Remaining",
      value: Math.max(0, totalSalesTarget - totalSalesActual),
    },
  ];

  const collectionPieData = [
    { name: "Collected", value: totalCollectionActual },
    {
      name: "Due",
      value: Math.max(0, totalCollectionTarget - totalCollectionActual),
    },
  ];

  const PIE_COLORS = ["#6366f1", "#1e293b"];
  const COLL_PIE_COLORS = ["#10b981", "#1e293b"];

  return (
    <div className="space-y-6">
      {/* Sales Specific KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          title="Active Invoice Count"
          value={filteredRecords.length.toString()}
          subValue="Total volume of registered B2B transactions"
          icon={ShoppingCart}
          colorClass="bg-purple-500"
          theme={theme}
        />
        <KpiCard
          title="Total Assets Sold"
          value={`${totalQty.toLocaleString()} Units`}
          subValue="Physical unit distribution volume"
          icon={Package}
          colorClass="bg-blue-500"
          theme={theme}
        />
        <KpiCard
          title="Avg Transaction Value"
          value={formatBDT(avgOrder, true, true)}
          subValue="Mean revenue per customer invoice"
          icon={Layers}
          colorClass="bg-indigo-400"
          theme={theme}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Performance Benchmark Chart */}
        <div
          id="monthly-benchmark-chart"
          className={`lg:col-span-2 p-3 sm:p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} scroll-mt-24 overflow-hidden`}
        >
          <div className="flex flex-col items-center justify-center border-b border-slate-800 pb-6 mb-8 gap-4 overflow-hidden">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400 opacity-80" />
              <h5 className="font-black text-[11px] sm:text-xs uppercase tracking-[0.12em] leading-normal text-white text-center">
                Monthly Performance Benchmark — {currentYear}
              </h5>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]"></div>
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-tight">
                  Sales
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-tight">
                  Collection
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]"></div>
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-tight">
                  Target
                </span>
              </div>
            </div>
          </div>

          <div className="h-[250px] sm:h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: isMobile ? 5 : 10, left: isMobile ? -15 : 10, bottom: 0 }}
                barGap={isMobile ? 2 : 4}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#64748b",
                    fontSize: isMobile ? 8 : 10,
                    fontFamily: "monospace",
                  }}
                  tickFormatter={(val) => isMobile ? val.substring(0, 3) : val}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#64748b",
                    fontSize: isMobile ? 8 : 10,
                    fontFamily: "monospace",
                  }}
                  tickFormatter={(value) => isMobile ? `${(value / 1000000).toFixed(0)}M` : `৳${(value / 1000000).toFixed(0)}M`}
                />
                <RechartsTooltip
                  cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const sales = data.sales || 0;
                      const collection = data.collection || 0;
                      const target = data.target || 0;

                      // Percent calculations
                      const achievementPercent = target > 0 ? ((sales / target) * 100).toFixed(1) : "0.0";
                      const collectionPercent = sales > 0 ? ((collection / sales) * 100).toFixed(1) : "0.0";

                      return (
                        <div className={`p-3 sm:p-4 rounded-xl border shadow-2xl backdrop-blur-md font-sans text-[10px] sm:text-xs min-w-[140px] sm:min-w-[180px] ${
                          theme.isDark ? "bg-slate-950/95 border-slate-800 text-slate-200" : "bg-white/95 border-slate-200 text-slate-800"
                        }`}>
                          <p className={`font-bold tracking-tight mb-2 border-b pb-1.5 flex items-center justify-between gap-4 ${
                            theme.isDark ? "border-slate-800 text-slate-100" : "border-slate-100 text-slate-900"
                          }`}>
                            <span className="font-semibold">{label}</span>
                            {!isMobile && (
                              <span className={`text-[10px] font-normal font-mono ${theme.isDark ? "text-slate-400" : "text-slate-500"}`}>
                                Metrics
                              </span>
                            )}
                          </p>
                          <div className="space-y-1.5 sm:space-y-2 font-mono">
                            <div className="flex items-center justify-between gap-4">
                              <span className={`flex items-center gap-1 ${theme.isDark ? "text-slate-400" : "text-slate-600"}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                                Sales:
                              </span>
                              <span className="font-bold text-indigo-500">{formatBDT(sales, true, true)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className={`flex items-center gap-1 ${theme.isDark ? "text-slate-400" : "text-slate-600"}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                Coll:
                              </span>
                              <span className="font-bold text-emerald-500">{formatBDT(collection, true, true)}</span>
                            </div>
                            <div className={`flex items-center justify-between gap-4 border-b pb-1.5 ${
                              theme.isDark ? "border-slate-800/60" : "border-slate-100"
                            }`}>
                              <span className={`flex items-center gap-1 ${theme.isDark ? "text-slate-400" : "text-slate-600"}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                                Target:
                              </span>
                              <span className="font-bold text-amber-500">{formatBDT(target, true, true)}</span>
                            </div>
                            <div className="pt-1 flex flex-col gap-1 text-[9px] sm:text-[11px] font-sans">
                              <div className="flex items-center justify-between gap-4">
                                <span className={theme.isDark ? "text-slate-400" : "text-slate-500"}>Achievement:</span>
                                <span className={`font-semibold ${sales >= target ? "text-emerald-500" : "text-amber-500"}`}>
                                  {achievementPercent}%
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className={theme.isDark ? "text-slate-400" : "text-slate-500"}>Ratio:</span>
                                <span className={`font-semibold ${collection >= sales ? "text-emerald-500" : "text-indigo-500"}`}>
                                  {collectionPercent}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="sales"
                  fill="#6366f1"
                  radius={[2, 2, 0, 0]}
                  barSize={isMobile ? 6 : 18}
                  name="Sales"
                />
                <Bar
                  dataKey="collection"
                  fill="#10b981"
                  radius={[2, 2, 0, 0]}
                  barSize={isMobile ? 6 : 18}
                  name="Collection"
                />
                <Bar
                  dataKey="target"
                  fill="#f59e0b"
                  radius={[2, 2, 0, 0]}
                  barSize={isMobile ? 6 : 18}
                  name="Target"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Achievement Donuts */}
        <div className="space-y-6">
          <div
            className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}
          >
            <h5 className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Trophy size={12} className="text-amber-500" />
              Sales achievement vs Target
            </h5>
            <div className="h-40 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {salesPieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-white font-mono">
                  {Math.round((totalSalesActual / totalSalesTarget) * 100)}%
                </span>
                <span className="text-[8px] text-slate-500 uppercase font-mono">
                  Quota
                </span>
              </div>
            </div>
          </div>

          <div
            className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}
          >
            <h5 className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <CircleDollarSign size={12} className="text-emerald-500" />
              Collection vs Target
            </h5>
            <div className="h-40 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={collectionPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {collectionPieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLL_PIE_COLORS[index % COLL_PIE_COLORS.length]}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-white font-mono">
                  {Math.round(
                    (totalCollectionActual / totalCollectionTarget) * 100,
                  )}
                  %
                </span>
                <span className="text-[8px] text-slate-500 uppercase font-mono">
                  Realized
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Feed */}
      <div
        id="audit-stream-section"
        className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} scroll-mt-24`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4 mb-6 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-[#a78bfa] shrink-0">
              <ShoppingCart size={16} />
            </div>
            <div className="flex flex-col">
              <h5 className="font-black text-xs uppercase tracking-wider text-slate-200">
                Audit Transaction Stream
              </h5>
              <span className="font-mono text-[9px] text-[#94A3B8] font-bold uppercase tracking-widest mt-0.5">
                Showing {totalItems > 0 ? startIndex + 1 : 0} -{" "}
                {Math.min(totalItems, startIndex + rowsPerPage)} of {totalItems}{" "}
                orders
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-between sm:justify-start">
            <button
              onClick={() => exportToExcel(filteredRecords.map((r, idx) => ({
                SL: idx + 1,
                Date: r["Invoice Date"] || r["Sales Date"],
                "Invoice/Order": r.Invoice || r["Sales Order"],
                Branch: r.Branch,
                Client: r.Buyer,
                Industry: r["Buyer Group"],
                Asset: r.Product,
                Brand: r.Brand,
                "VAT Mode": r.vatTaxMode || "Standard",
                Quantity: r.Quantity,
                "Unit Price": r["Unit Price"],
                "Gross Amount": r["Exclude Vat Tax"],
                "VAT": r.Vat,
                "Tax": r.Tax,
                "Total Value (BDT)": r["Total Price"]
              })), "Audit_Transactions")}
              className="p-2 px-3 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl border border-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
              title="Export to Excel"
            >
              <FileSpreadsheet size={14} />
              <span>Excel</span>
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 px-3 text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-700/60 rounded-xl border border-slate-800 transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider group"
              title="Configure Rows"
            >
              <Settings
                size={14}
                className={isOpen ? "animate-spin text-indigo-400" : "group-hover:rotate-90 transition-transform duration-500"}
              />
              <span>Configure</span>
            </button>
          </div>
        </div>

        {/* Configurations Sliding Expander */}
        {isOpen && (
          <div className="mb-5 p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 text-xs text-slate-300 transition-all">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Page size (Row Limit)
                </label>
                <select
                  value={rowsPerPage}
                  onChange={(e) =>
                    updateRowsPerPage(parseInt(e.target.value, 10))
                  }
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-mono w-full cursor-pointer"
                >
                  <option value={5}>5 Rows</option>
                  <option value={10}>10 Rows</option>
                  <option value={15}>15 Rows</option>
                  <option value={20}>20 Rows</option>
                  <option value={30}>30 Rows</option>
                  <option value={50}>50 Rows</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 font-sans leading-relaxed">
                  Sets the max number of visible audit rows per tabbed grid
                  page.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Configure Columns
                </label>
                <div className="bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[9px]">
                  {ALL_COLUMNS.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isColVisible(col.id)}
                        onChange={() => toggleColumnHidden(col.id)}
                        className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                      />
                      <span
                        className={
                          isColVisible(col.id)
                            ? "text-slate-200"
                            : "text-slate-500"
                        }
                      >
                        {col.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Select which rows to show
                </label>
                <div className="max-h-28 overflow-y-auto bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[9px]">
                  {Array.from(
                    new Set(filteredRecords.map((r) => r["Sales Order"])),
                  )
                    .filter(Boolean)
                    .map((orderId) => {
                      const rec = filteredRecords.find(
                        (r) => r["Sales Order"] === orderId,
                      );
                      const isChecked = !settings.hiddenItems.includes(orderId);
                      return (
                        <label
                          key={orderId}
                          className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRowHidden(orderId)}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                          />
                          <span
                            className={
                              isChecked
                                ? "text-slate-200"
                                : "text-slate-500 line-through"
                            }
                          >
                            {orderId} ({rec?.Buyer.substring(0, 10)}...)
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[9px] sm:text-[10px]">
                {isColVisible("no") && !isMobile && <th className="pb-2.5">SL</th>}
                {isColVisible("date") && <th className="pb-2.5">Date</th>}
                {isColVisible("order") && (
                  <th className="pb-2.5">{isMobile ? "Ref" : "Invoice/Order"}</th>
                )}
                {isColVisible("branch") && !isMobile && <th className="pb-2.5">Branch</th>}
                {isColVisible("client") && (
                  <th className="pb-2.5">{isMobile ? "Buyer" : "Client & Industry"}</th>
                )}
                {isColVisible("product") && !isMobile && (
                  <th className="pb-2.5">Asset</th>
                )}
                {isColVisible("vat_mode") && !isMobile && (
                  <th className="pb-2.5 whitespace-nowrap">VAT Mode</th>
                )}
                {isColVisible("custom_rates") && !isMobile && (
                  <th className="pb-2.5 whitespace-nowrap">
                    Overrides
                  </th>
                )}
                {isColVisible("qty") && (
                  <th className="pb-2.5 text-center">Qty</th>
                )}
                {isColVisible("total") && (
                  <th className="pb-2.5 text-right">Total</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {paginatedList.map((row) => (
                <tr key={row.No} className="hover:bg-slate-900/40 transition">
                  {isColVisible("no") && !isMobile && (
                    <td className="py-3 font-mono text-[11px] text-slate-500">
                      #{row.No}
                    </td>
                  )}
                  {isColVisible("date") && (
                    <td className="py-2.5 sm:py-3 font-mono text-[10px] sm:text-[11px] whitespace-nowrap">
                      {formatDate(row["Invoice Date"] || row["Sales Date"])}
                    </td>
                  )}
                  {isColVisible("order") && (
                    <td className="py-3">
                      <span className="font-semibold text-slate-100 block">
                        {row.Invoice || (isMobile ? "OFF" : "❌ Uninvoiced")}
                      </span>
                      {!isMobile && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {row["Sales Order"]}
                        </span>
                      )}
                    </td>
                  )}
                  {isColVisible("branch") && !isMobile && (
                    <td className="py-3 text-slate-200">{row.Branch}</td>
                  )}
                  {isColVisible("client") && (
                    <td className="py-3">
                      <span
                        className="font-semibold block text-slate-200 truncate max-w-[120px] sm:max-w-[380px] md:max-w-[500px] xl:max-w-none whitespace-normal md:whitespace-nowrap"
                        title={row.Buyer}
                      >
                        {row.Buyer}
                      </span>
                      <span className="text-[10px] font-mono text-purple-400">
                        {row["Buyer Group"]}
                      </span>
                    </td>
                  )}
                  {isColVisible("product") && !isMobile && (
                    <td className="py-3">
                      <span
                        className="font-semibold text-slate-200 block truncate max-w-[170px]"
                        title={row.Product}
                      >
                        {row.Product}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {row.Brand}
                      </span>
                    </td>
                  )}
                  {isColVisible("vat_mode") && !isMobile && (
                    <td className="py-3">
                      {editingModeId === row.No ? (
                        <select
                          value={row.vatTaxMode || "both"}
                          onChange={(e) => {
                            const val = e.target.value as VatTaxMode;
                            updateRecordVatMode(row.No, val);
                            setEditingModeId(null);
                            window.dispatchEvent(
                              new Event("banglabiz_vat_tax_updated"),
                            );
                          }}
                          onBlur={() => setEditingModeId(null)}
                          className="bg-slate-900 border border-slate-700 text-slate-100 text-[10px] rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500 font-mono w-24 cursor-pointer"
                          autoFocus
                        >
                          <option value="both">Both</option>
                          <option value="only-vat">Only VAT</option>
                          <option value="only-tax">Only Tax</option>
                          <option value="excl-both">Exclude Both</option>
                        </select>
                      ) : (
                        <div
                          className="flex items-center gap-1.5 cursor-pointer group"
                          onClick={() => setEditingModeId(row.No)}
                        >
                          <span
                            className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-slate-800 ${
                              row.vatTaxMode === "both"
                                ? "text-amber-400 bg-amber-400/5 font-bold"
                                : row.vatTaxMode === "only-vat"
                                  ? "text-sky-400 bg-sky-400/5 font-bold"
                                  : row.vatTaxMode === "only-tax"
                                    ? "text-emerald-400 bg-emerald-400/5 font-bold"
                                    : "text-slate-500 bg-slate-500/5"
                            }`}
                          >
                            {row.vatTaxMode === "excl-both"
                              ? "None"
                              : row.vatTaxMode || "both"}
                          </span>
                        </div>
                      )}
                    </td>
                  )}
                  {isColVisible("custom_rates") && !isMobile && (
                    <td className="py-3">
                      {editingRatesId === row.No ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="VAT%"
                            value={tempRates.vat ?? ""}
                            onChange={(e) =>
                              setTempRates({
                                ...tempRates,
                                vat: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="bg-slate-950 border border-slate-800 text-[9px] w-12 rounded px-1 py-0.5 font-mono text-amber-500 outline-none"
                          />
                          <input
                            type="number"
                            step="0.1"
                            placeholder="TAX%"
                            value={tempRates.tax ?? ""}
                            onChange={(e) =>
                              setTempRates({
                                ...tempRates,
                                tax: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="bg-slate-950 border border-slate-800 text-[9px] w-12 rounded px-1 py-0.5 font-mono text-emerald-500 outline-none"
                          />
                          <button
                            onClick={() => {
                              updateRecordCustomRates(
                                row.No,
                                tempRates.vat,
                                tempRates.tax,
                              );
                              setEditingRatesId(null);
                              window.dispatchEvent(
                                new Event("banglabiz_vat_tax_updated"),
                              );
                            }}
                            className="p-1 hover:text-emerald-400 text-slate-400 cursor-pointer"
                          >
                            <ShieldCheck size={12} />
                          </button>
                          <button
                            onClick={() => setEditingRatesId(null)}
                            className="p-1 hover:text-rose-400 text-slate-400 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-2 cursor-pointer group"
                          onClick={() => {
                            setEditingRatesId(row.No);
                            setTempRates({
                              vat: row.customVatRate,
                              tax: row.customTaxRate,
                            });
                          }}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`text-[9px] font-mono ${row.customVatRate !== undefined ? "text-amber-400 font-bold" : "text-slate-500"}`}
                            >
                              V:{" "}
                              {row.customVatRate !== undefined
                                ? row.customVatRate
                                : "Def"}
                              %
                            </span>
                            <span
                              className={`text-[9px] font-mono ${row.customTaxRate !== undefined ? "text-emerald-400 font-bold" : "text-slate-500"}`}
                            >
                              T:{" "}
                              {row.customTaxRate !== undefined
                                ? row.customTaxRate
                                : "Def"}
                              %
                            </span>
                          </div>
                          <Settings
                            size={10}
                            className="text-slate-600 opacity-0 group-hover:opacity-100 transition"
                          />
                        </div>
                      )}
                    </td>
                  )}
                  {isColVisible("qty") && (
                    <td className="py-2.5 sm:py-3 text-center font-mono font-semibold text-[10px] sm:text-xs">
                      {row.Quantity}
                    </td>
                  )}
                  {isColVisible("total") && (
                    <td className="py-2.5 sm:py-3 text-right font-mono font-bold text-amber-500 text-[10px] sm:text-xs">
                      {formatBDT(row["Total Price"], true, true)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-800">
              <tr className="bg-slate-900/50 hover:bg-slate-900/60 transition font-bold text-slate-100">
                <td
                  className="py-3.5 px-2 font-mono text-[10px] sm:text-xs text-slate-300 font-bold uppercase tracking-wider"
                  colSpan={
                    ALL_COLUMNS.filter((c) => 
                      isColVisible(c.id) && 
                      (!isMobile || !["no", "branch", "product", "vat_mode", "custom_rates"].includes(c.id))
                    ).length - 2
                  }
                >
                  Grand Total
                </td>
                {isColVisible("qty") && (
                  <td className="py-3.5 text-center font-mono text-indigo-300 font-extrabold text-xs">
                    {grandTotalQty.toLocaleString()}
                  </td>
                )}
                {isColVisible("total") && (
                  <td className="py-3.5 text-right font-mono font-extrabold text-amber-400 text-xs">
                    {formatBDT(grandTotalPrice, true, true)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Dynamic Pagination Controls */}
        <div className="flex items-center justify-between border-t border-slate-850 pt-4 mt-2">
          <span className="text-[11px] text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2.5">
            <button
              id="sales-table-prev-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-[11px] text-slate-300 border border-slate-850 rounded hover:bg-slate-900 cursor-pointer disabled:opacity-40"
            >
              Previous
            </button>
            <button
              id="sales-table-next-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-[11px] text-slate-300 border border-slate-850 rounded hover:bg-slate-900 cursor-pointer disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. PRODUCT ANALYTICS PAGE
// ==========================================
export function ProductAnalyticsPage({
  filteredRecords,
  allRecords,
  theme,
  filters,
  setFilters,
  activeTab,
  collectionRecords,
  filteredCollectionRecords,
  funnelRecords,
  filteredFunnelRecords,
}: PageProps) {
  const [settings, setSettings] = useState(() => {
    const s = getRowVisibilitySettings("brand_rankings_v3");
    return {
      limit: s.rowsPerPage || 10,
      hiddenItems: s.hiddenItems || [],
      hiddenColumns: s.hiddenColumns !== undefined ? s.hiddenColumns : ["pm"],
    };
  });

  const brands = Array.from(
    new Set(filteredRecords.map((r) => r.Brand)),
  ).length;
  const skus = Array.from(
    new Set(filteredRecords.map((r) => r.Product)),
  ).length;
  const totalSales = filteredRecords.reduce(
    (sum, r) => sum + r["Total Price"],
    0,
  );

  const [productSettings, setProductSettings] = useState(() => {
    const s = getRowVisibilitySettings("product_rankings_v1");
    return {
      limit: s.limit || 15,
      hiddenItems: s.hiddenItems || [],
      hiddenColumns: (s as any).hiddenColumns || [],
    };
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isProductTableOpen, setIsProductTableOpen] = useState(false);
  const [pmSettings, setPmSettings] = useState(() => {
    const s = getRowVisibilitySettings("pm_rankings_v1");
    return {
      limit: s.limit || 10,
      hiddenItems: s.hiddenItems || [],
      hiddenColumns: (s as any).hiddenColumns || [],
    };
  });
  const [isPmTableOpen, setIsPmTableOpen] = useState(false);

  const ALL_COLUMNS = [
    { id: "rank", label: "# Rank" },
    { id: "brand", label: "Brand Identity" },
    { id: "pm", label: "Product Manager" },
    { id: "ratio", label: "Sales Mix %" },
    { id: "tx_count", label: "Transactions count" },
    { id: "qty", label: "Quantities deployed" },
    { id: "revenue", label: "Grand Sales (BDT)" },
  ];

  // Sort products and compile brand performance metrics
  const getBrandContributions = () => {
    const map: Record<
      string,
      { revenue: number; uniqueInvoices: Set<string>; qty: number; pm: string }
    > = {};
    filteredRecords.forEach((r) => {
      if (settings.hiddenItems.includes(r.Brand)) return;

      const invId = r.Invoice || r["Sales Order"];
      const curr = map[r.Brand] || {
        revenue: 0,
        uniqueInvoices: new Set<string>(),
        qty: 0,
        pm: r["Product Manager"] || "Unassigned",
      };

      if (invId) curr.uniqueInvoices.add(invId);

      map[r.Brand] = {
        revenue: curr.revenue + r["Total Price"],
        uniqueInvoices: curr.uniqueInvoices,
        qty: curr.qty + r.Quantity,
        pm: curr.pm || r["Product Manager"] || "Unassigned",
      };
    });

    let entries = Object.entries(map)
      .map(
        ([brand, data]) =>
          [brand, { ...data, orders: data.uniqueInvoices.size }] as [
            string,
            { revenue: number; orders: number; qty: number; pm: string },
          ],
      )
      .sort((a, b) => b[1].revenue - a[1].revenue);

    if (settings.limit && settings.limit > 0) {
      entries = entries.slice(0, settings.limit);
    }
    return entries;
  };

  const updateLimit = (num: number) => {
    const updated = { ...settings, limit: num, rowsPerPage: num };
    setSettings(updated);
    saveRowVisibilitySettings("brand_rankings_v3", updated);
  };

  const toggleColumnHidden = (colId: string) => {
    const isHidden = settings.hiddenColumns.includes(colId);
    const newHidden = isHidden
      ? settings.hiddenColumns.filter((id: string) => id !== colId)
      : [...settings.hiddenColumns, colId];

    const updated = { ...settings, hiddenColumns: newHidden };
    setSettings(updated);
    saveRowVisibilitySettings("brand_rankings_v3", updated);
  };

  const isColVisible = (colId: string) =>
    !settings.hiddenColumns.includes(colId);

  const toggleBrandHidden = (brand: string) => {
    const isHidden = settings.hiddenItems.includes(brand);
    const newHidden = isHidden
      ? settings.hiddenItems.filter((item) => item !== brand)
      : [...settings.hiddenItems, brand];
    const updated = { ...settings, hiddenItems: newHidden };
    setSettings(updated);
    saveRowVisibilitySettings("brand_rankings_v3", updated);
  };

  const getProductContributions = () => {
    const map: Record<
      string,
      {
        revenue: number;
        qty: number;
        brand: string;
        uniqueInvoices: Set<string>;
      }
    > = {};
    filteredRecords.forEach((r) => {
      if (productSettings.hiddenItems.includes(r.Product)) return;

      const invId = r.Invoice || r["Sales Order"];
      const curr = map[r.Product] || {
        revenue: 0,
        qty: 0,
        brand: r.Brand,
        uniqueInvoices: new Set<string>(),
      };
      if (invId) curr.uniqueInvoices.add(invId);

      map[r.Product] = {
        revenue: curr.revenue + r["Total Price"],
        qty: curr.qty + r.Quantity,
        brand: r.Brand,
        uniqueInvoices: curr.uniqueInvoices,
      };
    });

    let entries = Object.entries(map)
      .map(
        ([prod, data]) =>
          [prod, { ...data, orders: data.uniqueInvoices.size }] as [
            string,
            { revenue: number; qty: number; brand: string; orders: number },
          ],
      )
      .sort((a, b) => b[1].revenue - a[1].revenue);

    if (productSettings.limit && productSettings.limit > 0) {
      entries = entries.slice(0, productSettings.limit);
    }
    return entries;
  };

  const updateProductLimit = (num: number) => {
    const updated = { ...productSettings, limit: num };
    setProductSettings(updated);
    saveRowVisibilitySettings("product_rankings_v1", updated);
  };

  const toggleProductColumnHidden = (colId: string) => {
    const isHidden = productSettings.hiddenColumns.includes(colId);
    const newHidden = isHidden
      ? productSettings.hiddenColumns.filter((id: string) => id !== colId)
      : [...productSettings.hiddenColumns, colId];
    const updated = { ...productSettings, hiddenColumns: newHidden };
    setProductSettings(updated);
    saveRowVisibilitySettings("product_rankings_v1", updated);
  };

  const isProductColVisible = (colId: string) =>
    !productSettings.hiddenColumns.includes(colId);

  const toggleProductHidden = (prod: string) => {
    const isHidden = productSettings.hiddenItems.includes(prod);
    const newHidden = isHidden
      ? productSettings.hiddenItems.filter((item) => item !== prod)
      : [...productSettings.hiddenItems, prod];
    const updated = { ...productSettings, hiddenItems: newHidden };
    setProductSettings(updated);
    saveRowVisibilitySettings("product_rankings_v1", updated);
  };

  const getPMContributions = () => {
    const map: Record<
      string,
      {
        revenue: number;
        qty: number;
        brands: Set<string>;
        uniqueInvoices: Set<string>;
      }
    > = {};
    filteredRecords.forEach((r) => {
      const pm = r["Product Manager"] || "Unassigned";
      if (pmSettings.hiddenItems.includes(pm)) return;

      const invId = r.Invoice || r["Sales Order"];
      const curr = map[pm] || {
        revenue: 0,
        qty: 0,
        brands: new Set<string>(),
        uniqueInvoices: new Set<string>(),
      };

      if (invId) curr.uniqueInvoices.add(invId);
      if (r.Brand) curr.brands.add(r.Brand);

      map[pm] = {
        revenue: curr.revenue + r["Total Price"],
        qty: curr.qty + r.Quantity,
        brands: curr.brands,
        uniqueInvoices: curr.uniqueInvoices,
      };
    });

    let entries = Object.entries(map)
      .map(
        ([pm, data]) =>
          [
            pm,
            {
              ...data,
              orders: data.uniqueInvoices.size,
              brandCount: data.brands.size,
            },
          ] as [
            string,
            {
              revenue: number;
              qty: number;
              brandCount: number;
              orders: number;
            },
          ],
      )
      .sort((a, b) => b[1].revenue - a[1].revenue);

    if (pmSettings.limit && pmSettings.limit > 0) {
      entries = entries.slice(0, pmSettings.limit);
    }
    return entries;
  };

  const updatePMLimit = (num: number) => {
    const updated = { ...pmSettings, limit: num };
    setPmSettings(updated);
    saveRowVisibilitySettings("pm_rankings_v1", updated);
  };

  const togglePMColumnHidden = (colId: string) => {
    const isHidden = pmSettings.hiddenColumns.includes(colId);
    const newHidden = isHidden
      ? pmSettings.hiddenColumns.filter((id: string) => id !== colId)
      : [...pmSettings.hiddenColumns, colId];
    const updated = { ...pmSettings, hiddenColumns: newHidden };
    setPmSettings(updated);
    saveRowVisibilitySettings("pm_rankings_v1", updated);
  };

  const isPMColVisible = (colId: string) =>
    !pmSettings.hiddenColumns.includes(colId);

  const togglePMHidden = (pm: string) => {
    const isHidden = pmSettings.hiddenItems.includes(pm);
    const newHidden = isHidden
      ? pmSettings.hiddenItems.filter((item) => item !== pm)
      : [...pmSettings.hiddenItems, pm];
    const updated = { ...pmSettings, hiddenItems: newHidden };
    setPmSettings(updated);
    saveRowVisibilitySettings("pm_rankings_v1", updated);
  };

  const getCategoryContributions = () => {
    const map: Record<string, { revenue: number; qty: number }> = {};
    filteredRecords.forEach((r) => {
      const cat = r.Group || "General";
      const curr = map[cat] || { revenue: 0, qty: 0 };
      map[cat] = {
        revenue: curr.revenue + r["Total Price"],
        qty: curr.qty + r.Quantity,
      };
    });
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  };

  const brandLogs = getBrandContributions();
  const productLogs = getProductContributions();
  const pmLogs = getPMContributions();
  const categoryLogs = getCategoryContributions();

  const totalBrandRevenue = brandLogs.reduce(
    (sum, [_, data]) => sum + data.revenue,
    0,
  );
  const totalProductRevenue = productLogs.reduce(
    (sum, [_, data]) => sum + data.revenue,
    0,
  );
  const totalPMRevenue = pmLogs.reduce(
    (sum, [_, data]) => sum + data.revenue,
    0,
  );
  const grandTotalRevenue = filteredRecords.reduce(
    (sum, r) => sum + r["Total Price"],
    0,
  );

  // Top Performers for KPIs
  const topBrand = brandLogs[0] || ["None", { revenue: 0 }];
  const topProduct = productLogs[0] || ["None", { revenue: 0 }];
  const topPM = pmLogs[0] || ["Unassigned", { revenue: 0 }];
  const topCategory = categoryLogs[0] || ["General", { revenue: 0 }];

  return (
    <div id="product-performance-section" className="space-y-6 scroll-mt-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiCard
          title="Portfolio Brands"
          value={brands.toString()}
          subValue="Active distributed brand identities"
          icon={Building2}
          colorClass="bg-rose-500"
          theme={theme}
        />
        <KpiCard
          title="Active SKUs"
          value={skus.toString()}
          subValue="Unique technology assets in circulation"
          icon={Tag}
          colorClass="bg-amber-400"
          theme={theme}
        />
      </div>

      {/* Product Performance KPI Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Top Brand Entity",
            value: topBrand[0],
            metric: formatBDT((topBrand[1] as any).revenue),
            ratio:
              grandTotalRevenue > 0
                ? ((topBrand[1] as any).revenue / grandTotalRevenue) * 100
                : 0,
            icon: Building2,
            color: "text-indigo-400",
          },
          {
            label: "Bestselling SKU",
            value: topProduct[0],
            metric: formatBDT((topProduct[1] as any).revenue),
            ratio:
              grandTotalRevenue > 0
                ? ((topProduct[1] as any).revenue / grandTotalRevenue) * 100
                : 0,
            icon: Package,
            color: "text-purple-400",
          },
          {
            label: "Leading PM Head",
            value: topPM[0],
            metric: formatBDT((topPM[1] as any).revenue),
            ratio:
              grandTotalRevenue > 0
                ? ((topPM[1] as any).revenue / grandTotalRevenue) * 100
                : 0,
            icon: Users,
            color: "text-blue-400",
          },
          {
            label: "Alpha Category",
            value: topCategory[0],
            metric: formatBDT((topCategory[1] as any).revenue),
            ratio:
              grandTotalRevenue > 0
                ? ((topCategory[1] as any).revenue / grandTotalRevenue) * 100
                : 0,
            icon: Tag,
            color: "text-emerald-400",
          },
        ].map((kpi, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} group transition-all hover:border-slate-700`}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className={`p-2 rounded-lg bg-slate-900/50 border border-slate-800 ${kpi.color}`}
              >
                <kpi.icon size={18} />
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-800">
                <PercentCircle size={10} className="text-slate-400" />
                <span className="font-mono text-[10px] font-bold text-slate-300">
                  {kpi.ratio.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 font-semibold">
                {kpi.label}
              </p>
              <p
                className={`text-sm font-bold truncate ${theme.textMain} mb-0.5`}
                title={kpi.value}
              >
                {kpi.value}
              </p>
              <p className="text-xs font-mono text-indigo-400/90 font-medium">
                {kpi.metric}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Insert Global Analysis Slicers after KPIs */}
      {filters && setFilters && (
        <div className="w-full">
          <Filters
            filters={filters}
            setFilters={setFilters}
            allRecords={allRecords}
            filteredRecords={filteredRecords}
            activeTab={activeTab || "products"}
            collectionRecords={collectionRecords || []}
            filteredCollectionRecords={filteredCollectionRecords || []}
            funnelRecords={funnelRecords || []}
            filteredFunnelRecords={filteredFunnelRecords || []}
            theme={theme}
          />
        </div>
      )}

      {/* Brand ranking and PM contribution cards */}
      <div
        id="brand-rankings-section"
        className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} scroll-mt-24`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4 mb-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-[#34d399] shrink-0">
              <Layers size={15} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Brand Asset Rankings
              </span>
              <span className="font-mono text-[9px] text-[#94A3B8] mt-0.5">
                Brand portfolio (Shown: {brandLogs.length})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:justify-end w-full md:w-auto shrink-0 justify-between sm:justify-start">
            <button
              onClick={() => exportToExcel(brandLogs.map(([name, data], idx) => ({
                Rank: idx + 1,
                "Brand Identity": name,
                "Product Manager": data.pm,
                "Transactions": data.orders,
                "Quantities": data.qty,
                "Revenue (BDT)": data.revenue,
                "Ratio": `${((totalBrandRevenue > 0 ? data.revenue / totalBrandRevenue : 0) * 100).toFixed(1)}%`
              })), "Brand_Rankings")}
              className="px-2.5 py-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold"
              title="Export to Excel"
            >
              <FileSpreadsheet size={13} />
              Export
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="px-2.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg border border-slate-700/60 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold group"
            >
              <Settings
                size={13}
                className={isOpen ? "animate-spin text-indigo-400" : "group-hover:rotate-90 transition-transform duration-500"}
              />
              Configure
            </button>
          </div>
        </div>

        {/* Configurations Sliding Expander */}
        {isOpen && (
          <div className="mb-5 p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 text-xs text-slate-300 transition-all">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Visible Row Limit
                </label>
                <select
                  value={settings.limit}
                  onChange={(e) => updateLimit(parseInt(e.target.value, 10))}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-mono w-full cursor-pointer"
                >
                  <option value={3}>Top 3 Brands</option>
                  <option value={5}>Top 5 Brands</option>
                  <option value={10}>Top 10 Brands</option>
                  <option value={15}>Top 15 Brands</option>
                  <option value={20}>Top 20 Brands</option>
                  <option value={100}>Show All</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  Limits the maximum number of brand ranking rows returned.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Configure Columns
                </label>
                <div className="bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[9px]">
                  {ALL_COLUMNS.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isColVisible(col.id)}
                        onChange={() => toggleColumnHidden(col.id)}
                        className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                      />
                      <span
                        className={
                          isColVisible(col.id)
                            ? "text-slate-200"
                            : "text-slate-500"
                        }
                      >
                        {col.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Select which Brand rows to show
                </label>
                <div className="max-h-28 overflow-y-auto bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[9px]">
                  {Array.from(new Set(filteredRecords.map((r) => r.Brand)))
                    .filter(Boolean)
                    .map((brand) => {
                      const isChecked = !settings.hiddenItems.includes(brand);
                      return (
                        <label
                          key={brand}
                          className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleBrandHidden(brand)}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                          />
                          <span
                            className={
                              isChecked
                                ? theme.textMain
                                : `${theme.textMuted} line-through`
                            }
                          >
                            {brand}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                {isColVisible("rank") && <th className="pb-2.5"># Rank</th>}
                {isColVisible("brand") && (
                  <th className="pb-2.5">Brand Identity</th>
                )}
                {isColVisible("pm") && (
                  <th className="pb-2.5">Product Manager</th>
                )}
                {isColVisible("ratio") && (
                  <th className="pb-2.5 text-center">Performance Ratio</th>
                )}
                {isColVisible("tx_count") && (
                  <th className="pb-2.5 text-center">Transactions count</th>
                )}
                {isColVisible("qty") && (
                  <th className="pb-2.5 text-center">Quantities deployed</th>
                )}
                {isColVisible("revenue") && (
                  <th className="pb-2.5 text-right">Grand Sales (BDT)</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {brandLogs.map(([brandName, data], idx) => {
                const performanceRatio =
                  totalBrandRevenue > 0
                    ? (data.revenue / totalBrandRevenue) * 100
                    : 0;
                return (
                  <tr
                    key={brandName}
                    className="hover:bg-slate-900/60 transition"
                  >
                    {isColVisible("rank") && (
                      <td className="py-3 font-mono font-bold text-indigo-400">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                    )}
                    {isColVisible("brand") && (
                      <td className={`py-3 font-semibold ${theme.textMain}`}>
                        {brandName}
                      </td>
                    )}
                    {isColVisible("pm") && (
                      <td className={`py-3 ${theme.textMuted} font-medium`}>
                        {data.pm}
                      </td>
                    )}
                    {isColVisible("ratio") && (
                      <td className="py-3 text-center">
                        <span className="font-mono text-[10px] text-indigo-400 font-bold">
                          {performanceRatio.toFixed(1)}%
                        </span>
                      </td>
                    )}
                    {isColVisible("tx_count") && (
                      <td className="py-3 text-center font-mono">
                        {data.orders}<span className="hidden md:inline"> Unique Inv.</span>
                      </td>
                    )}
                    {isColVisible("qty") && (
                      <td className="py-3 text-center font-mono">
                        {data.qty}<span className="hidden md:inline"> Hardware assets</span>
                      </td>
                    )}
                    {isColVisible("revenue") && (
                      <td className="py-3 text-right font-mono text-amber-500 font-bold">
                        {formatBDT(data.revenue)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-800">
              <tr className="bg-slate-900/30 text-slate-100 font-bold">
                {isColVisible("rank") && <td className="py-3"></td>}
                {isColVisible("brand") && (
                  <td className="py-3 text-[10px] uppercase font-mono px-2 text-slate-400">
                    Total
                  </td>
                )}
                {isColVisible("pm") && <td className="py-3"></td>}
                {isColVisible("ratio") && (
                  <td className="py-3 text-center font-mono text-[10px]">
                    100.0%
                  </td>
                )}
                {isColVisible("tx_count") && (
                  <td className="py-3 text-center font-mono text-[10px]">
                    {brandLogs.reduce((s, b) => s + b[1].orders, 0)}<span className="hidden md:inline"> Total</span>
                  </td>
                )}
                {isColVisible("qty") && (
                  <td className="py-3 text-center font-mono text-[10px]">
                    {brandLogs.reduce((s, b) => s + b[1].qty, 0)}<span className="hidden md:inline"> Assets</span>
                  </td>
                )}
                {isColVisible("revenue") && (
                  <td className="py-3 text-right font-mono text-[10px] text-amber-400">
                    {formatBDT(totalBrandRevenue)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Nomenclature Product Asset Rankings */}
      <div
        className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4 mb-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-purple-500/10 rounded-xl border border-purple-500/20 text-[#a855f7] shrink-0">
              <Package size={15} />
            </div>
            <div className="flex flex-col">
              <span className={`font-bold text-xs uppercase tracking-wider ${theme.textMain}`}>
                Nomenclature Asset Rankings (SKUs)
              </span>
              <span className="font-mono text-[9px] text-[#94A3B8] mt-0.5">
                Product performance (Shown: {productLogs.length})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:justify-end w-full md:w-auto shrink-0 justify-between sm:justify-start">
            <button
              onClick={() => exportToExcel(productLogs.map(([name, data], idx) => ({
                Rank: idx + 1,
                "Product Name": name,
                "Brand": data.brand,
                "Qty Sold": data.qty,
                "Order Count": data.orders,
                "Revenue (BDT)": data.revenue
              })), "SKU_Rankings")}
              className="px-2.5 py-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold"
              title="Export to Excel"
            >
              <FileSpreadsheet size={13} />
              Export
            </button>
            <button
              onClick={() => setIsProductTableOpen(!isProductTableOpen)}
              className="px-2.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg border border-slate-700/60 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold group"
            >
              <Settings
                size={13}
                className={isProductTableOpen ? "animate-spin text-indigo-400" : "group-hover:rotate-90 transition-transform duration-500"}
              />
              Configure
            </button>
          </div>
        </div>

        {/* Configurations Sliding Expander */}
        {isProductTableOpen && (
          <div className="mb-5 p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 text-xs text-slate-300 transition-all">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Visible Row Limit
                </label>
                <select
                  value={productSettings.limit}
                  onChange={(e) =>
                    updateProductLimit(parseInt(e.target.value, 10))
                  }
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-mono w-full cursor-pointer"
                >
                  <option value={5}>Top 5 Products</option>
                  <option value={10}>Top 10 Products</option>
                  <option value={15}>Top 15 Products</option>
                  <option value={25}>Top 25 Products</option>
                  <option value={50}>Top 50 Products</option>
                  <option value={500}>Show All</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Configure Columns
                </label>
                <div className="bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[9px]">
                  {[
                    { id: "rank", label: "# Rank" },
                    { id: "product", label: "Product Nomenclature" },
                    { id: "brand", label: "Original Brand" },
                    { id: "qty", label: "Qty Sold" },
                    { id: "orders", label: "Order Count" },
                    { id: "revenue", label: "Cumulative BDT" },
                  ].map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isProductColVisible(col.id)}
                        onChange={() => toggleProductColumnHidden(col.id)}
                        className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                      />
                      <span
                        className={
                          isProductColVisible(col.id)
                            ? theme.textMain
                            : theme.textMuted
                        }
                      >
                        {col.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Filter Specific Assets
                </label>
                <div className="max-h-28 overflow-y-auto bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[10px]">
                  {Array.from(new Set(filteredRecords.map((r) => r.Product)))
                    .filter(Boolean)
                    .sort()
                    .map((prod) => {
                      const isChecked =
                        !productSettings.hiddenItems.includes(prod);
                      return (
                        <label
                          key={prod}
                          className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleProductHidden(prod)}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                          />
                          <span
                            className={
                              isChecked
                                ? theme.textMain
                                : `${theme.textMuted} line-through`
                            }
                          >
                            {prod}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                {isProductColVisible("rank") && (
                  <th className="pb-2.5"># Rank</th>
                )}
                {isProductColVisible("product") && (
                  <th className="pb-2.5">Product Nomenclature</th>
                )}
                {isProductColVisible("brand") && (
                  <th className="pb-2.5">Original Brand</th>
                )}
                {isProductColVisible("qty") && (
                  <th className="pb-2.5 text-center">Qty Sold</th>
                )}
                {isProductColVisible("orders") && (
                  <th className="pb-2.5 text-center">Order Count</th>
                )}
                {isProductColVisible("revenue") && (
                  <th className="pb-2.5 text-right">Cumulative BDT</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {productLogs.map(([prodName, data], idx) => (
                <tr key={prodName} className="hover:bg-slate-900/60 transition">
                  {isProductColVisible("rank") && (
                    <td className="py-3 font-mono font-bold text-indigo-400">
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                  )}
                  {isProductColVisible("product") && (
                    <td className={`py-3 font-semibold ${theme.textMain}`}>
                      {prodName}
                    </td>
                  )}
                  {isProductColVisible("brand") && (
                    <td className="py-3">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${theme.isDark ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-slate-100 text-slate-600 border-slate-200"}`}
                      >
                        {data.brand}
                      </span>
                    </td>
                  )}
                  {isProductColVisible("qty") && (
                    <td className="py-3 text-center font-mono">{data.qty}<span className="hidden md:inline"> U</span></td>
                  )}
                  {isProductColVisible("orders") && (
                    <td className="py-3 text-center font-mono">
                      {data.orders}<span className="hidden md:inline"> Inv</span>
                    </td>
                  )}
                  {isProductColVisible("revenue") && (
                    <td className="py-3 text-right font-mono text-emerald-400 font-bold">
                      {formatBDT(data.revenue)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className={`border-t ${theme.border}`}>
              <tr
                className={`${theme.isDark ? "bg-slate-900/30" : "bg-slate-50"} ${theme.textMain} font-bold`}
              >
                {isProductColVisible("rank") && <td className="py-3"></td>}
                {isProductColVisible("product") && (
                  <td
                    className={`py-3 text-[10px] uppercase font-mono px-2 ${theme.textMuted}`}
                  >
                    Total Portfolio
                  </td>
                )}
                {isProductColVisible("brand") && <td className="py-3"></td>}
                {isProductColVisible("qty") && (
                  <td className="py-3 text-center font-mono text-[10px] tracking-tight">
                    {productLogs.reduce((s, p) => s + p[1].qty, 0)}<span className="hidden md:inline"> Units</span>
                  </td>
                )}
                {isProductColVisible("orders") && (
                  <td className="py-3 text-center font-mono text-[10px] tracking-tight">
                    {productLogs.reduce((s, p) => s + p[1].orders, 0)}<span className="hidden md:inline"> Total</span>
                  </td>
                )}
                {isProductColVisible("revenue") && (
                  <td className="py-3 text-right font-mono text-[10px] text-emerald-500">
                    {formatBDT(totalProductRevenue)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Product Manager Performance Rankings */}
      <div
        className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4 mb-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-[#3b82f6] shrink-0">
              <Users size={15} />
            </div>
            <div className="flex flex-col">
              <span className={`font-bold text-xs uppercase tracking-wider ${theme.textMain}`}>
                Product Manager rankings
              </span>
              <span className="font-mono text-[9px] text-[#94A3B8] mt-0.5">
                PM contribution (Shown: {pmLogs.length})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:justify-end w-full md:w-auto shrink-0 justify-between sm:justify-start">
            <button
              onClick={() => exportToExcel(pmLogs.map(([name, data], idx) => ({
                Rank: idx + 1,
                "Product Manager": name,
                "Brands Managed": data.brandCount,
                "Asset Volume": data.qty,
                "Transactions": data.orders,
                "Revenue (BDT)": data.revenue
              })), "Product_Manager_Rankings")}
              className="px-2.5 py-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold"
              title="Export to Excel"
            >
              <FileSpreadsheet size={13} />
              Export
            </button>
            <button
              onClick={() => setIsPmTableOpen(!isPmTableOpen)}
              className="px-2.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg border border-slate-700/60 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold group"
            >
              <Settings
                size={13}
                className={isPmTableOpen ? "animate-spin text-indigo-400" : "group-hover:rotate-90 transition-transform duration-500"}
              />
              Configure
            </button>
          </div>
        </div>

        {isPmTableOpen && (
          <div className="mb-5 p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 text-xs text-slate-300 transition-all">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Visible Row Limit
                </label>
                <select
                  value={pmSettings.limit}
                  onChange={(e) => updatePMLimit(parseInt(e.target.value, 10))}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-mono w-full cursor-pointer"
                >
                  <option value={5}>Top 5 PMs</option>
                  <option value={10}>Top 10 PMs</option>
                  <option value={15}>Top 15 PMs</option>
                  <option value={100}>Show All</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Configure Columns
                </label>
                <div className="bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[9px]">
                  {[
                    { id: "rank", label: "# Rank" },
                    { id: "pm", label: "Product Manager" },
                    { id: "brands", label: "Brands Managed" },
                    { id: "qty", label: "Asset Volume" },
                    { id: "tx", label: "Transaction Load" },
                    { id: "revenue", label: "Contribution BDT" },
                  ].map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isPMColVisible(col.id)}
                        onChange={() => togglePMColumnHidden(col.id)}
                        className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                      />
                      <span
                        className={
                          isPMColVisible(col.id)
                            ? theme.textMain
                            : theme.textMuted
                        }
                      >
                        {col.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Filter Specific PMs
                </label>
                <div className="max-h-28 overflow-y-auto bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[10px]">
                  {Array.from(
                    new Set(
                      filteredRecords.map(
                        (r) => r["Product Manager"] || "Unassigned",
                      ),
                    ),
                  )
                    .filter(Boolean)
                    .sort()
                    .map((pm) => {
                      const isChecked = !pmSettings.hiddenItems.includes(pm);
                      return (
                        <label
                          key={pm}
                          className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePMHidden(pm)}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                          />
                          <span
                            className={
                              isChecked
                                ? theme.textMain
                                : `${theme.textMuted} line-through`
                            }
                          >
                            {pm}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                {isPMColVisible("rank") && <th className="pb-2.5"># Rank</th>}
                {isPMColVisible("pm") && (
                  <th className="pb-2.5">Product Manager</th>
                )}
                {isPMColVisible("brands") && (
                  <th className="pb-2.5 text-center">Brands Managed</th>
                )}
                {isPMColVisible("qty") && (
                  <th className="pb-2.5 text-center">Asset Volume</th>
                )}
                {isPMColVisible("tx") && (
                  <th className="pb-2.5 text-center">Transaction Load</th>
                )}
                {isPMColVisible("revenue") && (
                  <th className="pb-2.5 text-right">Contribution BDT</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {pmLogs.map(([pmName, data], idx) => (
                <tr key={pmName} className="hover:bg-slate-900/60 transition">
                  {isPMColVisible("rank") && (
                    <td className="py-3 font-mono font-bold text-indigo-400">
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                  )}
                  {isPMColVisible("pm") && (
                    <td className={`py-3 font-semibold ${theme.textMain}`}>
                      {pmName}
                    </td>
                  )}
                  {isPMColVisible("brands") && (
                    <td className="py-3 text-center">
                      <span className="font-mono text-[10px] text-slate-400">
                        {data.brandCount}
                      </span>
                    </td>
                  )}
                  {isPMColVisible("qty") && (
                    <td className="py-3 text-center font-mono">{data.qty}<span className="hidden md:inline"> U</span></td>
                  )}
                  {isPMColVisible("tx") && (
                    <td className="py-3 text-center font-mono">
                      {data.orders}<span className="hidden md:inline"> Inv</span>
                    </td>
                  )}
                  {isPMColVisible("revenue") && (
                    <td className="py-3 text-right font-mono text-blue-400 font-bold">
                      {formatBDT(data.revenue)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className={`border-t ${theme.border}`}>
              <tr
                className={`${theme.isDark ? "bg-slate-900/30" : "bg-slate-50"} ${theme.textMain} font-bold`}
              >
                {isPMColVisible("rank") && <td className="py-3"></td>}
                {isPMColVisible("pm") && (
                  <td
                    className={`py-3 text-[10px] uppercase font-mono px-2 ${theme.textMuted}`}
                  >
                    Grand Total
                  </td>
                )}
                {isPMColVisible("brands") && <td className="py-3"></td>}
                {isPMColVisible("qty") && (
                  <td className="py-3 text-center font-mono text-[10px] tracking-tight">
                    {pmLogs.reduce((s, p) => s + p[1].qty, 0)}<span className="hidden md:inline"> Units</span>
                  </td>
                )}
                {isPMColVisible("tx") && (
                  <td className="py-3 text-center font-mono text-[10px] tracking-tight">
                    {pmLogs.reduce((s, p) => s + p[1].orders, 0)}<span className="hidden md:inline"> Total</span>
                  </td>
                )}
                {isPMColVisible("revenue") && (
                  <td className="py-3 text-right font-mono text-[10px] text-blue-500">
                    {formatBDT(totalPMRevenue)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. CUSTOMER INTELLIGENCE PAGE
// ==========================================
export function CustomerInsightsPage({
  filteredRecords,
  allRecords,
  theme,
  filters,
  setFilters,
  activeTab,
  collectionRecords,
  filteredCollectionRecords,
  funnelRecords,
  filteredFunnelRecords,
}: PageProps) {
  const [settings, setSettings] = useState(() => {
    const s = getRowVisibilitySettings("buyer_leaderboard");
    return {
      limit: s.rowsPerPage || 8,
      hiddenItems: s.hiddenItems || [],
      hiddenColumns: (s as any).hiddenColumns || [],
    };
  });
  const [isOpen, setIsOpen] = useState(false);

  const totalBuyers = Array.from(
    new Set(filteredRecords.map((r) => r.Buyer)),
  ).length;
  const buyerGroups = Array.from(
    new Set(filteredRecords.map((r) => r["Buyer Group"])),
  ).length;

  const ALL_COLUMNS = [
    { id: "rank", label: "# Rank" },
    { id: "buyer", label: "Corporate Account Name" },
    { id: "industry", label: "Industry Segment" },
    { id: "qty", label: "Assets deployed" },
    { id: "invoices", label: "Invoice count" },
    { id: "revenue", label: "Cumulative Value (BDT)" },
  ];

  // Aggregate calculations for top corporate buyers
  const getBuyerRankings = () => {
    const map: Record<
      string,
      { sales: number; qty: number; group: string; uniqueInvoices: Set<string> }
    > = {};
    filteredRecords.forEach((r) => {
      if (settings.hiddenItems.includes(r.Buyer)) return;

      const invId = r.Invoice || r["Sales Order"];
      const curr = map[r.Buyer] || {
        sales: 0,
        qty: 0,
        group: r["Buyer Group"],
        uniqueInvoices: new Set<string>(),
      };

      if (invId) curr.uniqueInvoices.add(invId);

      map[r.Buyer] = {
        sales: curr.sales + r["Total Price"],
        qty: curr.qty + r.Quantity,
        group: r["Buyer Group"],
        uniqueInvoices: curr.uniqueInvoices,
      };
    });

    let entries = Object.entries(map)
      .map(
        ([buyer, data]) =>
          [buyer, { ...data, invoiceCount: data.uniqueInvoices.size }] as [
            string,
            { sales: number; qty: number; group: string; invoiceCount: number },
          ],
      )
      .sort((a, b) => b[1].sales - a[1].sales);

    if (settings.limit && settings.limit > 0) {
      entries = entries.slice(0, settings.limit);
    }
    return entries;
  };

  const updateLimit = (num: number) => {
    const updated = { ...settings, limit: num, rowsPerPage: num };
    setSettings(updated);
    saveRowVisibilitySettings("buyer_leaderboard", updated);
  };

  const toggleColumnHidden = (colId: string) => {
    const isHidden = settings.hiddenColumns.includes(colId);
    const newHidden = isHidden
      ? settings.hiddenColumns.filter((id: string) => id !== colId)
      : [...settings.hiddenColumns, colId];

    const updated = { ...settings, hiddenColumns: newHidden };
    setSettings(updated);
    saveRowVisibilitySettings("buyer_leaderboard", updated);
  };

  const isColVisible = (colId: string) =>
    !settings.hiddenColumns.includes(colId);

  const toggleBuyerHidden = (buyer: string) => {
    const isHidden = settings.hiddenItems.includes(buyer);
    const newHidden = isHidden
      ? settings.hiddenItems.filter((item) => item !== buyer)
      : [...settings.hiddenItems, buyer];
    const updated = { ...settings, hiddenItems: newHidden };
    setSettings(updated);
    saveRowVisibilitySettings("buyer_leaderboard", updated);
  };

  const buyerRanks = getBuyerRankings();
  const grandTotalRevenue = filteredRecords.reduce(
    (sum, r) => sum + r["Total Price"],
    0,
  );
  const totalInvoices = new Set(
    filteredRecords.map((r) => r.Invoice || r["Sales Order"]).filter(Boolean),
  ).size;

  // KPIs
  const topAccount = buyerRanks[0] || ["None", { sales: 0 }];

  // Top Industry
  const industryMap: Record<string, number> = {};
  filteredRecords.forEach((r) => {
    const group = r["Buyer Group"] || "General";
    industryMap[group] = (industryMap[group] || 0) + r["Total Price"];
  });
  const topIndustry = Object.entries(industryMap).sort(
    (a, b) => b[1] - a[1],
  )[0] || ["None", 0];

  // Top Branch
  const branchMap: Record<string, number> = {};
  filteredRecords.forEach((r) => {
    branchMap[r.Branch] = (branchMap[r.Branch] || 0) + r["Total Price"];
  });
  const topBranch = Object.entries(branchMap).sort(
    (a, b) => b[1] - a[1],
  )[0] || ["None", 0];

  const avgTicket = totalInvoices > 0 ? grandTotalRevenue / totalInvoices : 0;

  return (
    <div id="customer-insights-section" className="space-y-6 scroll-mt-24">
      {/* Customer Intelligence KPI Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Top Consumer Head",
            value: topAccount[0],
            metric: formatBDT((topAccount[1] as any).sales),
            ratio:
              grandTotalRevenue > 0
                ? ((topAccount[1] as any).sales / grandTotalRevenue) * 100
                : 0,
            icon: Users,
            color: "text-indigo-400",
          },
          {
            label: "Key Industry Focus",
            value: topIndustry[0],
            metric: formatBDT(topIndustry[1]),
            ratio:
              grandTotalRevenue > 0
                ? (topIndustry[1] / grandTotalRevenue) * 100
                : 0,
            icon: Briefcase,
            color: "text-purple-400",
          },
          {
            label: "Region / Branch Hub",
            value: topBranch[0],
            metric: formatBDT(topBranch[1]),
            ratio:
              grandTotalRevenue > 0
                ? (topBranch[1] / grandTotalRevenue) * 100
                : 0,
            icon: MapPin,
            color: "text-blue-400",
          },
          {
            label: "Ticket Delta Avg",
            value: "Average Transaction",
            metric: formatBDT(avgTicket),
            ratio:
              grandTotalRevenue > 0 && avgTicket > 0
                ? (avgTicket / grandTotalRevenue) * 100
                : 0,
            icon: CircleDollarSign,
            color: "text-emerald-400",
          },
        ].map((kpi, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} group transition-all hover:border-slate-700`}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className={`p-2 rounded-lg bg-slate-900/50 border border-slate-800 ${kpi.color}`}
              >
                <kpi.icon size={18} />
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-800">
                <PercentCircle size={10} className="text-slate-400" />
                <span className="font-mono text-[10px] font-bold text-slate-300">
                  {kpi.ratio.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 font-semibold">
                {kpi.label}
              </p>
              <p
                className={`text-sm font-bold truncate ${theme.textMain} mb-0.5`}
                title={kpi.value}
              >
                {kpi.value}
              </p>
              <p className="text-xs font-mono text-indigo-400/90 font-medium">
                {kpi.metric}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Insert Global Analysis Slicers after KPIs */}
      {filters && setFilters && (
        <div className="w-full">
          <Filters
            filters={filters}
            setFilters={setFilters}
            allRecords={allRecords}
            filteredRecords={filteredRecords}
            activeTab={activeTab || "customers"}
            collectionRecords={collectionRecords || []}
            filteredCollectionRecords={filteredCollectionRecords || []}
            funnelRecords={funnelRecords || []}
            filteredFunnelRecords={filteredFunnelRecords || []}
            theme={theme}
          />
        </div>
      )}

      {/* Enterprise Buyer Matrix */}
      <div
        className={`p-3 sm:p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4 mb-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-pink-500/10 rounded-xl border border-pink-500/20 text-pink-400 shrink-0">
              <Trophy size={15} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Enterprise Buyer Leaderboard
              </span>
              <span className="font-mono text-[9px] text-[#94A3B8] mt-0.5">
                Corporate accounts portfolio (Shown: {buyerRanks.length})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:justify-end w-full md:w-auto shrink-0 justify-between sm:justify-start">
            <button
              onClick={() => exportToExcel(buyerRanks.map(([name, data], idx) => ({
                Rank: idx + 1,
                "Corporate Account Name": name,
                "Industry Segment": data.group,
                "Assets Deployed": data.qty,
                "Invoice Count": data.invoiceCount,
                "Cumulative Value (BDT)": data.sales
              })), "Buyer_Leaderboard")}
              className="px-2.5 py-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold"
              title="Export to Excel"
            >
              <FileSpreadsheet size={13} />
              Export
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="px-2.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg border border-slate-700/60 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold group"
            >
              <Settings
                size={13}
                className={isOpen ? "animate-spin text-indigo-400" : "group-hover:rotate-90 transition-transform duration-500"}
              />
              Configure
            </button>
          </div>
        </div>

        {/* Configurations Sliding Expander */}
        {isOpen && (
          <div className="mb-5 p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 text-xs text-slate-300 transition-all">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Enable / Disable Dashboard Columns
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_COLUMNS.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => toggleColumnHidden(col.id)}
                      className={`px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all flex items-center gap-1.5 ${
                        isColVisible(col.id)
                          ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                          : "bg-slate-900 border-slate-800 text-slate-500 line-through opacity-60"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${isColVisible(col.id) ? "bg-indigo-400 animate-pulse" : "bg-slate-600"}`}
                      />
                      {col.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-sans leading-tight">
                  Toggling columns modifies the visual surface area and focus
                  of the leaderboard data grid.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Leaderboard Row Limit
                </label>
                <select
                  value={settings.limit}
                  onChange={(e) => updateLimit(parseInt(e.target.value, 10))}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-mono w-full md:w-40 cursor-pointer"
                >
                  <option value={3}>Top 3 accounts</option>
                  <option value={5}>Top 5 accounts</option>
                  <option value={8}>Top 8 accounts</option>
                  <option value={10}>Top 10 accounts</option>
                  <option value={15}>Top 15 accounts</option>
                  <option value={50}>Show All</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  Configures major high-value accounts displayed simultaneously
                  in leaderboard.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Select which Corporate Accounts to show
                </label>
                <p className="text-[10px] text-slate-500 mb-2">
                  Check or uncheck specific companies to modify ranks.
                </p>
                <div className="max-h-28 overflow-y-auto bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[10px]">
                  {Array.from(new Set(filteredRecords.map((r) => r.Buyer)))
                    .filter(Boolean)
                    .map((buyer) => {
                      const isChecked = !settings.hiddenItems.includes(buyer);
                      return (
                        <label
                          key={buyer}
                          className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleBuyerHidden(buyer)}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                          />
                          <span
                            className={
                              isChecked
                                ? "text-slate-200 font-medium"
                                : "text-slate-550 line-through"
                            }
                          >
                            {buyer}
                          </span>
                        </label>
                      );
                    })}
                  {filteredRecords.length === 0 && (
                    <span className="text-[10px] font-sans text-slate-500 italic block">
                      No accounts found.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-850 text-slate-400 uppercase font-mono text-[9px] sm:text-[10px]">
                {isColVisible("rank") && <th className="pb-2.5 w-8">#</th>}
                {isColVisible("buyer") && (
                  <th className="pb-2.5">Corporate Account</th>
                )}
                {isColVisible("industry") && (
                  <th className="pb-2.5 hidden md:table-cell">Industry</th>
                )}
                {isColVisible("qty") && (
                  <th className="pb-2.5 text-center hidden sm:table-cell">Assets</th>
                )}
                {isColVisible("invoices") && (
                  <th className="pb-2.5 text-center hidden lg:table-cell">Invoices</th>
                )}
                {isColVisible("revenue") && (
                  <th className="pb-2.5 text-right whitespace-nowrap pl-2">Value (BDT)</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {buyerRanks.map(([buyerName, data], idx) => (
                <tr
                  key={buyerName}
                  className="hover:bg-slate-900/60 transition group"
                >
                  {isColVisible("rank") && (
                    <td className="py-2 sm:py-3 font-mono font-bold text-indigo-400 text-[10px] sm:text-xs">
                      {String(idx + 1).padStart(2, "0")}
                    </td>
                  )}
                  {isColVisible("buyer") && (
                    <td className="py-2 sm:py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100 text-[11px] sm:text-xs break-all" title={buyerName}>
                          {buyerName}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono sm:hidden truncate max-w-[100px]">
                          {data.group} • {data.qty} Units
                        </span>
                      </div>
                    </td>
                  )}
                  {isColVisible("industry") && (
                    <td className="py-2 sm:py-3 hidden md:table-cell">
                      <span className="bg-purple-500/10 text-purple-300 text-[9px] px-1.5 py-0.5 rounded border border-purple-500/20 font-mono">
                        {data.group}
                      </span>
                    </td>
                  )}
                  {isColVisible("qty") && (
                    <td className="py-2 sm:py-3 text-center font-mono text-slate-300 hidden sm:table-cell">
                      {data.qty}
                    </td>
                  )}
                  {isColVisible("invoices") && (
                    <td className="py-2 sm:py-3 text-center hidden lg:table-cell">
                      <span className="font-mono text-[10px] font-bold text-slate-400">
                        {data.invoiceCount}
                      </span>
                    </td>
                  )}
                  {isColVisible("revenue") && (
                    <td className="py-2 sm:py-3 text-right font-mono text-amber-500 font-bold text-[11px] sm:text-xs pl-2">
                      {formatBDT(data.sales)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-800">
              <tr className="bg-slate-900/30 text-slate-100 font-bold">
                {isColVisible("rank") && <td className="py-2"></td>}
                {isColVisible("buyer") && (
                  <td className="py-2 text-[9px] uppercase font-mono px-1 text-slate-400">
                    Total
                  </td>
                )}
                {isColVisible("industry") && <td className="py-2 hidden md:table-cell"></td>}
                {isColVisible("qty") && (
                  <td className="py-2 text-center font-mono text-[9px] hidden sm:table-cell">
                    {buyerRanks.reduce((s, b) => s + b[1].qty, 0)}
                  </td>
                )}
                {isColVisible("invoices") && (
                  <td className="py-2 text-center font-mono text-[9px] hidden lg:table-cell">
                    {buyerRanks.reduce((s, b) => s + b[1].invoiceCount, 0)}
                  </td>
                )}
                {isColVisible("revenue") && (
                  <td className="py-2 text-right font-mono text-[10px] text-amber-400 pl-2">
                    {formatBDT(buyerRanks.reduce((s, b) => s + b[1].sales, 0))}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. FINANCIAL ANALYTICS PAGE
// ==========================================
export function FinancialAnalyticsPage({
  filteredRecords,
  allRecords,
  theme,
  collectionRecords: propCollectionRecords,
  filteredCollectionRecords,
  filters,
  setFilters,
  activeTab,
  funnelRecords,
  filteredFunnelRecords,
}: {
  filteredRecords: SalesRecord[];
  allRecords: SalesRecord[];
  theme: DashboardTheme;
  collectionRecords?: CollectionRecord[];
  filteredCollectionRecords?: CollectionRecord[];
  filters?: DashboardFilters;
  setFilters?: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  activeTab?: string;
  funnelRecords?: FunnelRecord[];
  filteredFunnelRecords?: FunnelRecord[];
}) {
  const collectionRecords = filteredCollectionRecords || propCollectionRecords || getLocalCollectionRecords();
  const [{ vat, tax }, setRates] = useState(() => getVatTaxRates());
  const [editingSettings, setEditingSettings] = useState(false);
  const [tempVat, setTempVat] = useState(vat.toString());
  const [tempTax, setTempTax] = useState(tax.toString());

  // --- Collection Period & Flow Metrics ---
  let totalDays = 0;
  let count = 0;
  const customerVelocity: Record<
    string,
    {
      totalDays: number;
      count: number;
      totalRevenue: number;
      totalCollected: number;
    }
  > = {};

  // First, initialize customer entries and accumulate totalRevenue only from filteredRecords
  filteredRecords.forEach((r) => {
    if (!customerVelocity[r.Buyer]) {
      customerVelocity[r.Buyer] = {
        totalDays: 0,
        count: 0,
        totalRevenue: 0,
        totalCollected: 0,
      };
    }
    customerVelocity[r.Buyer].totalRevenue += r["Total Price"] || 0;
  });

  // Track the collections for these customers in the filtered collection records
  collectionRecords.forEach((coll) => {
    if (!customerVelocity[coll.buyerName]) {
      customerVelocity[coll.buyerName] = {
        totalDays: 0,
        count: 0,
        totalRevenue: 0,
        totalCollected: 0,
      };
    }

    customerVelocity[coll.buyerName].totalCollected += coll.amountCollected;

    // Determine the relevant sale for date diffs
    let sale: SalesRecord | undefined;
    if (coll.invoiceNo) {
      sale = allRecords.find((s) => s.Invoice === coll.invoiceNo);
    } else {
      // Find sales of this buyer that occurred on or before the payment date and are closest to the payment date
      const buyerSales = allRecords.filter((s) => s.Buyer === coll.buyerName);
      const paymentTime = coll.paymentDate ? new Date(coll.paymentDate).getTime() : 0;
      
      const precedingSales = buyerSales
        .filter((s) => {
          const sDateParsed = s["Invoice Date"] || s["Sales Date"];
          const sTime = sDateParsed ? new Date(sDateParsed).getTime() : 0;
          return sTime > 0 && sTime <= paymentTime;
        })
        .sort((a, b) => {
          const aDate = a["Invoice Date"] || a["Sales Date"];
          const bDate = b["Invoice Date"] || b["Sales Date"];
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });
        
      sale = precedingSales[0] || buyerSales[0];
    }

    if (sale) {
      const sDateStr = sale["Invoice Date"] || sale["Sales Date"];
      const sDate = sDateStr ? new Date(sDateStr) : null;
      const cDate = coll.paymentDate ? new Date(coll.paymentDate) : null;

      if (sDate && cDate && !isNaN(sDate.getTime()) && !isNaN(cDate.getTime())) {
        const diff = Math.ceil(
          (cDate.getTime() - sDate.getTime()) / (1000 * 3600 * 24),
        );

        if (diff >= 0 && diff < 365) { // Only count realistic and non-negative offsets
          totalDays += diff;
          count++;
          customerVelocity[coll.buyerName].totalDays += diff;
          customerVelocity[coll.buyerName].count += 1;
        }
      }
    }
  });

  const avgAcp = count > 0 ? Math.round(totalDays / count) : 0;

  // Collection row & column visibility states from database
  const [collSettings, setCollSettings] = useState(() => {
    const s = getRowVisibilitySettings("buyer_collection");
    return {
      limit: s.rowsPerPage || 50,
      hiddenItems: s.hiddenItems || [],
      hiddenColumns: (s as any).hiddenColumns || [],
    };
  });
  const [isCollConfigOpen, setIsCollConfigOpen] = useState(false);

  const ALL_COLL_COLUMNS = [
    { id: "buyer", label: "Buyer Name" },
    { id: "invoiced", label: "Total Invoiced (BDT)" },
    { id: "collected", label: "Collected (BDT)" },
    { id: "outstanding", label: "Delta / Outstanding" },
    { id: "velocity", label: "Velocity (Days)" },
    { id: "rate", label: "Collection %" },
    { id: "contribution", label: "Contribution to Total %" },
  ];

  const updateCollLimit = (num: number) => {
    const updated = { ...collSettings, limit: num, rowsPerPage: num };
    setCollSettings(updated);
    saveRowVisibilitySettings("buyer_collection", updated);
  };

  const toggleCollColumnHidden = (colId: string) => {
    const isHidden = collSettings.hiddenColumns.includes(colId);
    const newHidden = isHidden
      ? collSettings.hiddenColumns.filter((id: string) => id !== colId)
      : [...collSettings.hiddenColumns, colId];

    const updated = { ...collSettings, hiddenColumns: newHidden };
    setCollSettings(updated);
    saveRowVisibilitySettings("buyer_collection", updated);
  };

  const isCollColVisible = (colId: string) =>
    !collSettings.hiddenColumns.includes(colId);

  const toggleCollBuyerHidden = (buyer: string) => {
    const isHidden = collSettings.hiddenItems.includes(buyer);
    const newHidden = isHidden
      ? collSettings.hiddenItems.filter((item) => item !== buyer)
      : [...collSettings.hiddenItems, buyer];
    const updated = { ...collSettings, hiddenItems: newHidden };
    setCollSettings(updated);
    saveRowVisibilitySettings("buyer_collection", updated);
  };

  // Pre-filter with hidden items first
  const velocityDataAll = Object.entries(customerVelocity)
    .filter(([name]) => !collSettings.hiddenItems.includes(name))
    .map(([name, data]) => ({
      name,
      avgDays: data.count > 0 ? Math.round(data.totalDays / data.count) : 0,
      ratio:
        data.totalRevenue > 0
          ? Math.round((data.totalCollected / data.totalRevenue) * 100)
          : 0,
      totalRevenue: data.totalRevenue,
      totalCollected: data.totalCollected,
    }))
    .sort((a, b) => b.avgDays - a.avgDays);

  const velocityData = collSettings.limit && collSettings.limit > 0
    ? velocityDataAll.slice(0, collSettings.limit)
    : velocityDataAll;

  const topSlowPayers = velocityDataAll.slice(0, 8);
  const topFastPayers = [...velocityDataAll].reverse().slice(0, 8);
  const totalRevenue = filteredRecords.reduce(
    (sum, r) => sum + r["Total Price"],
    0,
  );
  const totalCollected = collectionRecords.reduce((sum, c) => sum + c.amountCollected, 0);

  const overallRatio =
    totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0;

  // Branch row visibility states from database
  const [traceabilitySettings, setTraceabilitySettings] = useState(() => {
    const s = getRowVisibilitySettings("tax_traceability");
    const allUniqueBranches = Array.from(
      new Set(allRecords.map((r) => r.Branch)),
    )
      .filter(Boolean)
      .sort();
    return {
      hiddenItems: s.hiddenItems || [],
      hiddenColumns: (s as any).hiddenColumns || [],
      availableBranches: allUniqueBranches,
    };
  });
  const [isTaxConfigOpen, setIsTaxConfigOpen] = useState(false);

  const handleSaveRates = () => {
    const v = parseFloat(tempVat);
    const t = parseFloat(tempTax);
    if (!isNaN(v) && v >= 0 && !isNaN(t) && t >= 0) {
      saveVatTaxRates(v, t);
      setRates({ vat: v, tax: t });
      setEditingSettings(false);
      window.dispatchEvent(new Event("banglabiz_vat_tax_updated"));
    }
  };

  const isColVisible = (colId: string) =>
    !traceabilitySettings.hiddenColumns.includes(colId);

  const toggleBranchHidden = (branchName: string) => {
    const isHidden = traceabilitySettings.hiddenItems.includes(branchName);
    const newHidden = isHidden
      ? traceabilitySettings.hiddenItems.filter((item) => item !== branchName)
      : [...traceabilitySettings.hiddenItems, branchName];
    const updated = { ...traceabilitySettings, hiddenItems: newHidden };
    setTraceabilitySettings(updated);
    saveRowVisibilitySettings("tax_traceability", updated);
  };

  const branchSummary = traceabilitySettings.availableBranches
    .filter((b) => !traceabilitySettings.hiddenItems.includes(b))
    .map((branch) => {
      const branchRecords = filteredRecords.filter((r) => r.Branch === branch);
      const net = branchRecords.reduce(
        (sum, r) => sum + (r["Exclude Vat Tax"] || 0),
        0,
      );
      const bVat = branchRecords.reduce((sum, r) => sum + (r.Vat || 0), 0);
      const bTax = branchRecords.reduce((sum, r) => sum + (r.Tax || 0), 0);
      return {
        branch,
        net,
        vat: bVat,
        tax: bTax,
        total: net + bVat + bTax,
      };
    })
    .sort((a, b) => b.total - a.total);

  const netTotal = filteredRecords.reduce(
    (sum, r) => sum + (r["Exclude Vat Tax"] || 0),
    0,
  );
  const totalVatValue = filteredRecords.reduce(
    (sum, r) => sum + (r.Vat || 0),
    0,
  );
  const totalTaxValue = filteredRecords.reduce(
    (sum, r) => sum + (r.Tax || 0),
    0,
  );
  const treasuryYield = totalVatValue + totalTaxValue;

  const CustomCollectionTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const invoicedDelta = data.totalRevenue - data.totalCollected;
      const kpiScore = data.ratio;
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl shrink-0 min-w-[200px]">
          <p className="text-white font-bold mb-2 text-xs">{label}</p>
          <div className="space-y-1 text-[10px] font-mono">
             <p className="flex justify-between gap-4">
                <span className="text-slate-400">Avg Velocity:</span>
                <span className="text-indigo-400 font-bold">{data.avgDays} Days</span>
             </p>
             <p className="flex justify-between gap-4">
                <span className="text-slate-400">Effective Liquid Cash:</span>
                <span className="text-emerald-400 font-bold">{formatBDT(data.totalCollected, true, true)}</span>
             </p>
             <p className="flex justify-between gap-4">
                <span className="text-slate-400">Invoiced Delta:</span>
                <span className="text-rose-400 font-bold">{formatBDT(invoicedDelta, true, true)}</span>
             </p>
             <p className="flex justify-between gap-4">
                <span className="text-slate-400">KPI (Collection %):</span>
                <span className="text-amber-400 font-bold">{kpiScore}%</span>
             </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const VelocityBarLabel = (props: any) => {
    const { x, y, width, height, value, payload } = props;
    const displayValue = value || (payload && payload.name) || '';
    
    // Ensure we have valid coordinates
    if (x === undefined || y === undefined || Number.isNaN(x) || Number.isNaN(y)) {
      return null;
    }

    return (
      <text
        x={Number(x) + 8}
        y={Number(y) + Number(height) / 2 + 1}
        fill="#f8fafc"
        alignmentBaseline="middle"
        fontSize={10}
        fontWeight="bold"
      >
        {displayValue}
      </text>
    );
  };


  const [velocityFilter, setVelocityFilter] = useState<'slowest' | 'fastest'>('slowest');
  const displayVelocityData = velocityFilter === 'slowest' ? topSlowPayers : topFastPayers;

  return (
    <div className="space-y-6">
      {/* Collections KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <KpiCard
          title="Revenue Realization"
          value={formatBDT(totalRevenue, true, true)}
          subValue="Total volume of sales in selected period"
          icon={CircleDollarSign}
          colorClass="bg-indigo-500"
          theme={theme}
        />
        <KpiCard
          title="Total Collected"
          value={formatBDT(totalCollected, true, true)}
          subValue="Effective liquid cash received"
          icon={Wallet}
          colorClass="bg-emerald-500"
          theme={theme}
        />
        <KpiCard
          title="Treasury Yield (VAT/Tax)"
          value={formatBDT(treasuryYield, true, true)}
          subValue="Total statutory compliance volume"
          icon={Receipt}
          colorClass="bg-amber-500"
          theme={theme}
        />
        <KpiCard
          title="Avg Collection Cycle"
          value={`${avgAcp} Days`}
          subValue="Historical mean payment velocity"
          icon={Timer}
          colorClass="bg-violet-500"
          theme={theme}
        />
        <KpiCard
          title="Liquidity Ratio"
          value={`${overallRatio.toFixed(1)}%`}
          subValue="Efficiency of billing-to-cash lifecycle"
          icon={Activity}
          colorClass="bg-blue-500"
          theme={theme}
        />
      </div>

      {/* Insert Global Analysis Slicers after KPIs */}
      {filters && setFilters && (
        <div className="w-full">
          <Filters
            filters={filters}
            setFilters={setFilters}
            allRecords={allRecords}
            filteredRecords={filteredRecords}
            activeTab={activeTab || "financials"}
            collectionRecords={collectionRecords || []}
            filteredCollectionRecords={filteredCollectionRecords || []}
            funnelRecords={funnelRecords || []}
            filteredFunnelRecords={filteredFunnelRecords || []}
            theme={theme}
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Treasury Traceability Component */}
        <div
          className={`p-3 sm:p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}
        >
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h5 className="font-bold text-[10px] sm:text-xs uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <ShieldCheck size={15} className="text-amber-500 shrink-0" />
              <span className="truncate">Statutory Tax Traceability</span>
            </h5>
            <button
              onClick={() => setEditingSettings(!editingSettings)}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
              title="Tax Rates Config"
            >
              <Settings size={14} />
            </button>
          </div>

          {editingSettings && (
            <div className="mb-6 p-3 sm:p-4 bg-slate-900/50 rounded-xl border border-slate-800">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[9px] sm:text-[10px] uppercase font-mono text-slate-500 mb-1">
                    VAT Rate %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempVat}
                    onChange={(e) => setTempVat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 sm:py-1.5 text-white text-[11px] sm:text-xs outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] uppercase font-mono text-slate-500 mb-1">
                    AIT Tax %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tempTax}
                    onChange={(e) => setTempTax(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 sm:py-1.5 text-white text-[11px] sm:text-xs outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveRates}
                className="mt-3 w-full bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase transition-all"
              >
                Apply Standardization
              </button>
            </div>
          )}

          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] sm:text-[10px] uppercase font-mono text-slate-500 border-b border-slate-800">
                  <th className="pb-3 px-1 sm:px-2">Branch</th>
                  <th className="pb-3 text-right hidden lg:table-cell">Net Value</th>
                  <th className="pb-3 text-right text-amber-500/80 pl-2">VAT</th>
                  <th className="pb-3 text-right text-emerald-500/80 pl-2">
                    Tax
                  </th>
                  <th className="pb-3 text-right pl-2">Total (BDT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-[11px] sm:text-xs">
                {branchSummary.map((b) => (
                  <tr key={b.branch} className="hover:bg-white/5 transition group">
                    <td className="py-2.5 sm:py-3 px-1 sm:px-2 font-bold text-slate-200">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[80px] sm:max-w-none" title={b.branch}>{b.branch}</span>
                        <span className="text-[9px] text-slate-500 sm:hidden font-mono truncate">
                          Net: {formatBDT(b.net)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 sm:py-3 text-right font-mono text-slate-400 hidden lg:table-cell">
                      {formatBDT(b.net)}
                    </td>
                    <td className="py-2.5 sm:py-3 text-right font-mono text-amber-500 pl-2">
                      {formatBDT(b.vat)}
                    </td>
                    <td className="py-2.5 sm:py-3 text-right font-mono text-emerald-500 pl-2">
                      {formatBDT(b.tax)}
                    </td>
                    <td className="py-2.5 sm:py-3 text-right font-mono text-white font-bold pl-2">
                      {formatBDT(b.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Collection Efficiency Chart */}
        <div
          className={`p-3 sm:p-6 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
            <h5 className="font-bold text-[10px] sm:text-xs uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <PercentCircle size={15} className="text-emerald-500 shrink-0" />
              Collection Velocity (Days Average)
            </h5>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setVelocityFilter('slowest')}
                className={`flex-1 sm:flex-none px-2 py-1.5 sm:py-1 text-[9px] sm:text-[10px] uppercase font-mono rounded transition-all ${velocityFilter === 'slowest' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                Slowest
              </button>
              <button 
                onClick={() => setVelocityFilter('fastest')}
                className={`flex-1 sm:flex-none px-2 py-1.5 sm:py-1 text-[9px] sm:text-[10px] uppercase font-mono rounded transition-all ${velocityFilter === 'fastest' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                Fastest
              </button>
            </div>
          </div>
          <div className="h-48 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayVelocityData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 9 }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={false}
                  width={5}
                />
                <RechartsTooltip content={<CustomCollectionTooltip />} />
                <Bar
                  dataKey="avgDays"
                  fill={velocityFilter === 'slowest' ? '#f43f5e' : '#10b981'}
                  radius={[0, 4, 4, 0]}
                  barSize={12}
                  name="Days to Collect"
                  minPointSize={2}
                >
                  <LabelList 
                    dataKey="name" 
                    content={<VelocityBarLabel />}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 sm:mt-8 border-t border-slate-800 pt-4 sm:pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-center">
              <div className="p-2 sm:p-3 bg-slate-950/40 rounded-xl border border-slate-800">
                <div className="text-[9px] text-slate-500 uppercase font-mono mb-1">
                  Effective Liquid Cash
                </div>
                <div className="text-sm sm:text-base font-bold text-white font-mono">
                  {formatBDT(totalCollected)}
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-slate-950/40 rounded-xl border border-slate-800">
                <div className="text-[9px] text-slate-500 uppercase font-mono mb-1">
                  Invoiced Delta
                </div>
                <div className="text-sm sm:text-base font-bold text-rose-400 font-mono">
                  {formatBDT(totalRevenue - totalCollected)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buyer-Wise Collection Summary */}
      <div className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4 mb-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-violet-500/10 rounded-xl border border-violet-500/20 text-violet-400 shrink-0">
              <Users size={15} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Buyer-Wise Collection Summary
              </span>
              <span className="font-mono text-[9px] text-[#94A3B8] mt-0.5">
                Collection portfolio & aging (Shown: {velocityData.length})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:justify-end w-full md:w-auto shrink-0 justify-between sm:justify-start">
            <button
              onClick={() => exportToExcel(velocityData.map((d, idx) => {
                const contribution = totalCollected > 0 ? (d.totalCollected / totalCollected) * 100 : 0;
                return {
                  Rank: idx + 1,
                  "Buyer Name": d.name,
                  "Total Invoiced (BDT)": d.totalRevenue,
                  "Collected (BDT)": d.totalCollected,
                  "Delta / Outstanding (BDT)": Math.max(0, d.totalRevenue - d.totalCollected),
                  "Velocity (Days)": d.avgDays,
                  "Collection Rate (%)": d.ratio + "%",
                  "Contribution to Total (%)": contribution.toFixed(1) + "%"
                };
              }), "Buyer_Collection_Summary")}
              className="px-2.5 py-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold font-semibold"
              title="Export to Excel"
            >
              <FileSpreadsheet size={13} />
              Export
            </button>
            <button
              onClick={() => setIsCollConfigOpen(!isCollConfigOpen)}
              className="px-2.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg border border-slate-700/60 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold group font-semibold"
              title="Configure Rows & Columns"
            >
              <Settings
                size={13}
                className={isCollConfigOpen ? "animate-spin text-indigo-400" : "group-hover:rotate-90 transition-transform duration-500"}
              />
              Configure
            </button>
          </div>
        </div>

        {/* Configurations Sliding Expander */}
        {isCollConfigOpen && (
          <div className="mb-5 p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 text-xs text-slate-300 transition-all">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Enable / Disable Dashboard Columns
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_COLL_COLUMNS.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => toggleCollColumnHidden(col.id)}
                      className={`px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                        isCollColVisible(col.id)
                          ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300 font-bold"
                          : "bg-slate-900 border-slate-800 text-slate-500 line-through opacity-60"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${isCollColVisible(col.id) ? "bg-indigo-400 animate-pulse" : "bg-slate-600"}`}
                      />
                      {col.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-sans leading-tight">
                  Toggling columns modifies the visual surface area and focus of the aging lifecycle data grid.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Visible Row Limit
                </label>
                <select
                  value={collSettings.limit}
                  onChange={(e) => updateCollLimit(parseInt(e.target.value, 10))}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-mono w-full md:w-40 cursor-pointer"
                >
                  <option value={3}>Top 3 buyers</option>
                  <option value={5}>Top 5 buyers</option>
                  <option value={10}>Top 10 buyers</option>
                  <option value={15}>Top 15 buyers</option>
                  <option value={20}>Top 20 buyers</option>
                  <option value={50}>Top 50 buyers</option>
                  <option value={100}>Show All</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  Limits the maximum number of buyer portfolio and collection records displayed.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Select which Buyer Accounts to show
                </label>
                <p className="text-[10px] text-slate-500 mb-2">
                  Check or uncheck specific companies to modify ranks.
                </p>
                <div className="max-h-28 overflow-y-auto bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[10px]">
                  {Array.from(new Set(filteredRecords.map((r) => r.Buyer)))
                    .filter(Boolean)
                    .map((buyer) => {
                      const isChecked = !collSettings.hiddenItems.includes(buyer);
                      return (
                        <label key={buyer} className="flex items-center gap-2 cursor-pointer hover:text-white select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCollBuyerHidden(buyer)}
                            className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                          <span className={isChecked ? "text-slate-300" : "text-slate-500 line-through"}>
                            {buyer}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#0f172a] z-10">
                <tr className="text-[10px] uppercase font-mono text-slate-500 border-b border-slate-800">
                  {isCollColVisible("buyer") && <th className="pb-3 px-2">Buyer Name</th>}
                  {isCollColVisible("invoiced") && <th className="pb-3 text-right">Total Invoiced (BDT)</th>}
                  {isCollColVisible("collected") && <th className="pb-3 text-right text-emerald-500">Collected (BDT)</th>}
                  {isCollColVisible("outstanding") && <th className="pb-3 text-right text-rose-400">Delta / Outstanding</th>}
                  {isCollColVisible("velocity") && <th className="pb-3 text-right">Velocity (Days)</th>}
                  {isCollColVisible("rate") && <th className="pb-3 text-center">Collection %</th>}
                  {isCollColVisible("contribution") && <th className="pb-3 text-center text-indigo-400">Contribution to Total %</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs text-slate-300">
                {velocityData.map((d) => {
                  const contribution = totalCollected > 0 ? (d.totalCollected / totalCollected) * 100 : 0;
                  return (
                    <tr key={d.name} className="hover:bg-white/5 transition">
                      {isCollColVisible("buyer") && (
                        <td className="py-3 px-2 font-semibold text-slate-200">
                          {d.name}
                        </td>
                      )}
                      {isCollColVisible("invoiced") && (
                        <td className="py-3 text-right font-mono">
                          {formatBDT(d.totalRevenue, true, true)}
                        </td>
                      )}
                      {isCollColVisible("collected") && (
                        <td className="py-3 text-right font-mono text-emerald-400">
                          {formatBDT(d.totalCollected, true, true)}
                        </td>
                      )}
                      {isCollColVisible("outstanding") && (
                        <td className="py-3 text-right font-mono text-rose-400">
                          {formatBDT(Math.max(0, d.totalRevenue - d.totalCollected), true, true)}
                        </td>
                      )}
                      {isCollColVisible("velocity") && (
                        <td className="py-3 text-right font-mono">
                          {d.avgDays}
                        </td>
                      )}
                      {isCollColVisible("rate") && (
                        <td className="py-3 text-center font-mono font-bold">
                          {d.ratio}%
                        </td>
                      )}
                      {isCollColVisible("contribution") && (
                        <td className="py-3 text-center font-mono font-bold text-indigo-400">
                          {contribution.toFixed(1)}%
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-700 bg-slate-900/60 font-bold sticky bottom-0 z-10">
                <tr>
                  {isCollColVisible("buyer") && (
                    <td className="py-3 px-2 text-slate-100 uppercase text-[10px] font-mono">
                      Grand Totals ({velocityData.length} Buyers)
                    </td>
                  )}
                  {isCollColVisible("invoiced") && (
                    <td className="py-3 text-right font-mono text-slate-100">
                      {formatBDT(velocityData.reduce((s, d) => s + d.totalRevenue, 0), true, true)}
                    </td>
                  )}
                  {isCollColVisible("collected") && (
                    <td className="py-3 text-right font-mono text-emerald-400">
                      {formatBDT(velocityData.reduce((s, d) => s + d.totalCollected, 0), true, true)}
                    </td>
                  )}
                  {isCollColVisible("outstanding") && (
                    <td className="py-3 text-right font-mono text-rose-400">
                      {formatBDT(velocityData.reduce((s, d) => s + Math.max(0, d.totalRevenue - d.totalCollected), 0), true, true)}
                    </td>
                  )}
                  {isCollColVisible("velocity") && (
                    <td className="py-3 text-right font-mono text-slate-100">
                      {Math.round(velocityData.reduce((s, d) => s + d.avgDays, 0) / (velocityData.length || 1))}
                    </td>
                  )}
                  {isCollColVisible("rate") && (
                    <td className="py-3 text-center font-mono text-amber-400">
                      {(() => {
                        const rev = velocityData.reduce((s, d) => s + d.totalRevenue, 0);
                        const col = velocityData.reduce((s, d) => s + d.totalCollected, 0);
                        return rev > 0 ? ((col / rev) * 100).toFixed(1) : "0.0";
                      })()}%
                    </td>
                  )}
                  {isCollColVisible("contribution") && (
                    <td className="py-3 text-center font-mono text-indigo-400">
                      100.0%
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
      </div>
    </div>
  );
}

// ==========================================
// 6. PIPELINE & TARGET ANALYTICS PAGE
// ==========================================
export function TargetAnalyticsPage({
  filteredRecords,
  allRecords,
  theme,
  filteredCollectionRecords = [],
  filters,
}: PageProps & { filteredCollectionRecords?: CollectionRecord[] }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [settings, setSettings] = useState(() => {
    const s = getRowVisibilitySettings("target_board");
    return {
      hiddenItems: s.hiddenItems || [],
      hiddenColumns: (s as any).hiddenColumns || [],
    };
  });
  const [isOpen, setIsOpen] = useState(false);

  const ALL_COLUMNS = [
    { id: "rep", label: "Representative Name" },
    { id: "quota", label: "Target quota (BDT)" },
    { id: "actual", label: "Gross sales BDT" },
    { id: "achievement", label: "Achievement %" },
    { id: "deficit", label: "Quota Deficit" },
  ];

  const representativeTargets = getRepresentativeTargets(
    filteredRecords,
    filteredCollectionRecords || [],
    filters,
  ).filter((t) => !settings.hiddenItems.includes(t.branchOrName));

  const toggleColumnHidden = (colId: string) => {
    const isHidden = settings.hiddenColumns.includes(colId);
    const newHidden = isHidden
      ? settings.hiddenColumns.filter((id: string) => id !== colId)
      : [...settings.hiddenColumns, colId];

    const updated = { ...settings, hiddenColumns: newHidden };
    setSettings(updated);
    saveRowVisibilitySettings("target_board", updated);
  };

  const isColVisible = (colId: string) =>
    !settings.hiddenColumns.includes(colId);

  const toggleRepHidden = (repName: string) => {
    const isHidden = settings.hiddenItems.includes(repName);
    const newHidden = isHidden
      ? settings.hiddenItems.filter((item) => item !== repName)
      : [...settings.hiddenItems, repName];

    const updated = { ...settings, hiddenItems: newHidden };
    setSettings(updated);
    saveRowVisibilitySettings("target_board", updated);
  };

  return (
    <div className="space-y-6">
      {/* Representative / Salespeople Target Breakdowns */}
      <div
        id="target-performance-section"
        className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} scroll-mt-24`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4 mb-5 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-[#34d399] shrink-0">
              <Trophy size={15} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Sales Representative Target Achievements
              </span>
              <span className="font-mono text-[9px] text-[#94A3B8] mt-0.5">
                Account representative audit
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:justify-end w-full md:w-auto shrink-0 justify-between sm:justify-start">
            <button
              onClick={() => exportToExcel(representativeTargets.map((col, idx) => {
                const deficit = col.target - col.actual;
                const achievement = col.target > 0 ? (col.actual / col.target) * 100 : 0;
                return {
                  Rank: idx + 1,
                  "Representative Name": col.branchOrName,
                  "Target Quota (BDT)": col.target,
                  "Gross Sales (BDT)": col.actual,
                  "Achievement (%)": achievement.toFixed(1) + "%",
                  "Quota Deficit": deficit
                };
              }), "Sales_Rep_Target_Achievements")}
              className="px-2.5 py-1 text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold font-semibold"
              title="Export to Excel"
            >
              <FileSpreadsheet size={13} />
              Export
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="px-2.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg border border-slate-700/60 transition-all flex items-center gap-1 cursor-pointer uppercase font-mono font-bold group"
            >
              <Settings
                size={13}
                className={isOpen ? "animate-spin text-indigo-400" : "group-hover:rotate-90 transition-transform duration-500"}
              />
              Configure
            </button>
          </div>
        </div>

        {/* Configurations Sliding Expander */}
        {isOpen && (
          <div className="mb-5 p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 text-xs text-slate-300 transition-all">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Configure Columns
                </label>
                <div className="bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[9px]">
                  {ALL_COLUMNS.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isColVisible(col.id)}
                        onChange={() => toggleColumnHidden(col.id)}
                        className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                      />
                      <span
                        className={
                          isColVisible(col.id)
                            ? "text-slate-200"
                            : "text-slate-500"
                        }
                      >
                        {col.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5 font-semibold">
                  Select which Representatives to show
                </label>
                <div className="max-h-28 overflow-y-auto bg-slate-950/80 rounded border border-slate-800 p-2 space-y-1.5 font-mono text-[9px]">
                  {getRepresentativeTargets(allRecords).map((rep) => {
                    const isChecked = !settings.hiddenItems.includes(
                      rep.branchOrName,
                    );
                    return (
                      <label
                        key={rep.branchOrName}
                        className="flex items-center gap-2 hover:bg-slate-900/40 p-0.5 rounded cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRepHidden(rep.branchOrName)}
                          className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                        />
                        <span
                          className={
                            isChecked
                              ? "text-slate-200"
                              : "text-slate-500 line-through"
                          }
                        >
                          {rep.branchOrName}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto text-xs text-slate-300">
          <table className="w-full text-left font-sans">
            <thead>
              <tr className="border-b border-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                {isColVisible("rep") && (
                  <th className="pb-2.5">Representative Name</th>
                )}
                {isColVisible("quota") && (
                  <th className="pb-2.5 text-right w-64">Target quota (BDT)</th>
                )}
                {isColVisible("actual") && (
                  <th className="pb-2.5 text-right">Gross sales BDT</th>
                )}
                {isColVisible("achievement") && (
                  <th className="pb-2.5 text-center">Achievement %</th>
                )}
                {isColVisible("deficit") && (
                  <th className="pb-2.5 text-right">Quota Deficit</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {representativeTargets.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-slate-500 font-mono text-[10px] italic"
                  >
                    No accountability data found or visibility filtered. Please
                    check your config.
                  </td>
                </tr>
              ) : (
                representativeTargets.map((col) => {
                  const deficit = col.target - col.actual;
                  return (
                    <tr
                      key={col.branchOrName}
                      className="hover:bg-slate-900/60 transition"
                    >
                      {isColVisible("rep") && (
                        <td className="py-3 font-semibold text-slate-200">
                          {col.branchOrName}
                        </td>
                      )}
                      {isColVisible("quota") && (
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 group font-mono">
                            <span>{formatBDT(col.target, true, true)}</span>
                          </div>
                        </td>
                      )}
                      {isColVisible("actual") && (
                        <td className="py-3 text-right font-mono text-emerald-400 font-semibold">
                          {formatBDT(col.actual, true, true)}
                        </td>
                      )}
                      {isColVisible("achievement") && (
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-mono font-bold text-slate-200">
                              {col.achievementRate}%
                            </span>
                            <div className="w-12 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-900">
                              <div
                                className="bg-emerald-500 h-1.5"
                                style={{
                                  width: `${Math.min(100, col.achievementRate)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      )}
                      {isColVisible("deficit") && (
                        <td className="py-3 text-right font-mono text-rose-400">
                          {formatBDT(deficit, true, true)}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {representativeTargets.length > 0 && (
              <tfoot className="border-t border-slate-800">
                <tr className="bg-slate-900/30 text-slate-100 font-bold">
                  {isColVisible("rep") && (
                    <td className="py-3 text-[10px] uppercase font-mono px-2 text-slate-400">
                      National Total
                    </td>
                  )}
                  {isColVisible("quota") && (
                    <td className="py-3 text-right font-mono text-[10px]">
                      {formatBDT(
                        representativeTargets.reduce((s, r) => s + r.target, 0),
                        true,
                        true,
                      )}
                    </td>
                  )}
                  {isColVisible("actual") && (
                    <td className="py-3 text-right font-mono text-emerald-400 text-[10px]">
                      {formatBDT(
                        representativeTargets.reduce((s, r) => s + r.actual, 0),
                        true,
                        true,
                      )}
                    </td>
                  )}
                  {isColVisible("achievement") && (
                    <td className="py-3 text-center">
                      <span className="font-mono text-[10px]">
                        {(() => {
                          const t = representativeTargets.reduce(
                            (s, r) => s + r.target,
                            0,
                          );
                          const a = representativeTargets.reduce(
                            (s, r) => s + r.actual,
                            0,
                          );
                          return t > 0 ? Math.round((a / t) * 1000) / 10 : 0;
                        })()}
                        %
                      </span>
                    </td>
                  )}
                  {isColVisible("deficit") && (
                    <td className="py-3 text-right font-mono text-rose-400 text-[10px]">
                      {formatBDT(
                        representativeTargets.reduce(
                          (s, r) => s + (r.target - r.actual),
                          0,
                        ),
                        true,
                        true,
                      )}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 7. OPERATIONAL ANALYTICS PAGE
// ==========================================
export function OperationalAnalyticsPage({
  filteredRecords,
  theme,
}: PageProps) {
  // Identify uninvoiced (pending billing, i.e., empty Invoice cells) orders
  const pendingBillsList = filteredRecords.filter((r) => !r.Invoice);

  return (
    <div className="space-y-6">
      {/* Delayed Invoice warnings and process tracker */}
      <div
        id="operational-alerts-section"
        className={`p-5 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow} scroll-mt-24`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertOctagon size={15} className="text-rose-400" />
            <h5 className="font-bold text-xs uppercase tracking-wider text-slate-200">
              Pending Corporate Billing & Invoice Delays (Awaiting Settlement)
            </h5>
          </div>
          <span className="font-mono text-[9px] text-[#94A3B8]">
            {pendingBillsList.length} Delayed Accounts
          </span>
        </div>

        {pendingBillsList.length === 0 ? (
          <div className="text-center py-10">
            <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
            <h6 className="text-slate-100 font-bold text-xs">
              All channels completely billed!
            </h6>
            <p className="text-[10px] text-slate-500 mt-1">
              Excellent operations alignment. Zero revenue leakage reported.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-rose-500/5 text-rose-300 border border-rose-500/10 text-xs rounded-lg flex items-start gap-2 max-w-2xl leading-relaxed">
              <AlertTriangle className="shrink-0 mt-0.5" size={14} />
              <span>
                These contracts show physical hardware delivery or sales
                registration, but do not contain mapping invoice IDs. Urgent
                coordination with CFO registry is required to file standard VAT
                reports to NBR.
              </span>
            </div>

            <div className="overflow-x-auto text-xs text-slate-300">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="pb-2.5">Sales date</th>
                    <th className="pb-2.5">Sales Order</th>
                    <th className="pb-2.5">Client & Outlet Branch</th>
                    <th className="pb-2.5">Deployed technology Asset</th>
                    <th className="pb-2.5">Account Manager</th>
                    <th className="pb-2.5 text-right">Contract Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {pendingBillsList.slice(0, 8).map((r) => (
                    <tr key={r.No} className="hover:bg-slate-900/60 transition">
                      <td className="py-2.5 font-mono text-[11px] whitespace-nowrap">
                        {formatDate(r["Invoice Date"] || r["Sales Date"])}
                      </td>
                      <td className="py-2.5 font-mono text-[11px] font-bold text-slate-100">
                        {r["Sales Order"]}
                      </td>
                      <td className="py-2.5">
                        <span className="font-semibold block">{r.Buyer}</span>
                        <span className="text-[10px] text-slate-400">
                          {r.Branch}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className="font-semibold block">{r.Product}</span>
                        <span className="text-[10px] text-slate-400">
                          {r.Brand}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-200">
                        {r["Sales Person"]}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-rose-400">
                        {formatBDT(r["Total Price"], true, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-800">
                  <tr className="bg-slate-900/30 text-slate-100 font-bold">
                    <td
                      className="py-3 text-[10px] uppercase font-mono px-2 text-slate-400"
                      colSpan={5}
                    >
                      Total Delayed Exposure
                    </td>
                    <td className="py-3 text-right font-mono text-[10px] text-rose-500">
                      {formatBDT(
                        pendingBillsList.reduce(
                          (s, r) => s + r["Total Price"],
                          0,
                        ),
                        true,
                        true,
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 8. DATA INTEGRATION HUB & TEMPLATE GUIDE
// ==========================================
export function DataTemplatePage({ theme }: { theme: DashboardTheme }) {
  return (
    <div className="space-y-6">
      <div
        id="mapping-instruction-panel"
        className={`p-8 rounded-2xl border ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-500/20 rounded-xl">
              <Package size={24} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Unified Data Schema Mapping
              </h2>
              <p className={`text-sm ${theme.textMuted}`}>
                Corporate Excel structure for Sales, Collections, and Targets
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Sheet 1 */}
            <div
              className={`p-5 rounded-2xl border bg-slate-950/40 border-slate-800`}
            >
              <div className="flex items-center gap-2 mb-4 text-indigo-400">
                <div className="w-5 h-5 rounded bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </div>
                <h3 className="font-bold text-sm">Sheet: SALES</h3>
              </div>
              <ul className="space-y-2 text-[11px] text-slate-400 font-mono h-48 overflow-y-auto pr-2 pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <li>
                  • <span className="text-slate-200">SL:</span> Serial Number
                </li>
                <li>
                  • <span className="text-slate-200">Branch</span>
                </li>
                <li>
                  • <span className="text-slate-200">Sales Person</span>
                </li>
                <li>
                  • <span className="text-slate-200">Buyer Group</span>
                </li>
                <li>
                  • <span className="text-slate-200">Sales Order</span>
                </li>
                <li>
                  • <span className="text-slate-200">Invoice:</span> Unique Key
                </li>
                <li>
                  • <span className="text-slate-200">Remarks</span>
                </li>
                <li>
                  • <span className="text-slate-200">Buyer:</span> Customer Name
                </li>
                <li>
                  • <span className="text-slate-200">Brand</span>
                </li>
                <li>
                  • <span className="text-slate-200">Group</span>
                </li>
                <li>
                  • <span className="text-slate-200">Product</span>
                </li>
                <li>
                  • <span className="text-slate-200">Quantity</span>
                </li>
                <li>
                  • <span className="text-slate-200">Unit Price</span>
                </li>
                <li>
                  • <span className="text-slate-200">Exclude Vat Tax</span>
                </li>
                <li>
                  • <span className="text-slate-200">Vat</span>
                </li>
                <li>
                  • <span className="text-slate-200">Tax</span>
                </li>
                <li>
                  • <span className="text-slate-200">Vat & Tax</span>
                </li>
                <li>
                  • <span className="text-slate-200">Total Price:</span> Gross Amount
                </li>
                <li>
                  • <span className="text-slate-200">Invoice Date:</span> YYYY-MM-DD
                </li>
                <li>
                  • <span className="text-slate-200">Product Manager</span>
                </li>
              </ul>
            </div>

            {/* Sheet 2 */}
            <div
              className={`p-5 rounded-2xl border bg-slate-950/40 border-slate-800`}
            >
              <div className="flex items-center gap-2 mb-4 text-emerald-400">
                <div className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                  2
                </div>
                <h3 className="font-bold text-sm">Sheet: COLLECTION</h3>
              </div>
              <ul className="space-y-2 text-[11px] text-slate-400 font-mono h-48 overflow-y-auto pr-2 pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <li>
                  • <span className="text-slate-200">SL:</span> Serial Number
                </li>
                <li>
                  • <span className="text-slate-200">Payment Date:</span> Reference
                </li>
                <li>
                  • <span className="text-slate-200">Transaction No:</span> Reference
                </li>
                <li>
                  • <span className="text-slate-200">Buyer Name:</span> Mapping Key
                </li>
                <li>
                  • <span className="text-slate-200">Payment Method:</span> Cash/TT/PDC/EFT/RTGS/NPSB
                </li>
                <li>
                  • <span className="text-slate-200">Invoice No:</span> Linking Key
                </li>
                <li>
                  • <span className="text-slate-200">Amount Collected</span>
                </li>
                <li>
                  • <span className="text-slate-200">Status:</span> Initial/Approved/Cancelled
                </li>
              </ul>
            </div>

            {/* Sheet 3 */}
            <div
              className={`p-5 rounded-2xl border bg-slate-950/40 border-slate-800`}
            >
              <div className="flex items-center gap-2 mb-4 text-amber-400">
                <div className="w-5 h-5 rounded bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">
                  3
                </div>
                <h3 className="font-bold text-sm">Sheet: TARGETS</h3>
              </div>
              <ul className="space-y-2 text-[11px] text-slate-400 font-mono h-48 overflow-y-auto pr-2 pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <li>
                  • <span className="text-slate-200">SL:</span> Serial Number
                </li>
                <li>
                  • <span className="text-slate-200">KAM:</span> Key Account Manager Name
                </li>
                <li>
                  • <span className="text-slate-200">Branch:</span> Region/Branch Name
                </li>
                <li>
                  • <span className="text-slate-200">Month:</span> 1 - 12
                </li>
                <li>
                  • <span className="text-slate-200">Year:</span> Fiscal Year
                </li>
                <li>
                  • <span className="text-slate-200">Sales Target</span>
                </li>
                <li>
                  • <span className="text-slate-200">Collection Target</span>
                </li>
              </ul>
            </div>

            {/* Sheet 4 */}
            <div
              className={`p-5 rounded-2xl border bg-slate-950/40 border-slate-800`}
            >
              <div className="flex items-center gap-2 mb-4 text-cyan-400">
                <div className="w-5 h-5 rounded bg-cyan-500 text-white flex items-center justify-center text-[10px] font-bold">
                  4
                </div>
                <h3 className="font-bold text-sm">Sheet: FUNNEL</h3>
              </div>
              <ul className="space-y-2 text-[11px] text-slate-400 font-mono h-48 overflow-y-auto pr-2 pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <li>
                  • <span className="text-slate-200">SL:</span> Serial Number
                </li>
                <li>
                  • <span className="text-slate-200">Partner:</span> Client/Customer Name
                </li>
                <li>
                  • <span className="text-slate-200">Salesman:</span> Key Account Manager (KAM)
                </li>
                <li>
                  • <span className="text-slate-200">Quarter:</span> Q1/Q2/Q3/Q4 Fiscal Quarter
                </li>
                <li>
                  • <span className="text-slate-200">Start Date:</span> Deal Kick-off
                </li>
                <li>
                  • <span className="text-slate-200">End Date:</span> Expected Target Closing
                </li>
                <li>
                  • <span className="text-slate-200">Brand:</span> Partner Technology Brand
                </li>
                <li>
                  • <span className="text-slate-200">Amount:</span> Estimated Deal Value (BDT)
                </li>
                <li>
                  • <span className="text-slate-200">Status:</span> Deal Pipeline Stage
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
            <h4 className="text-sm font-bold text-indigo-300 mb-3 flex items-center gap-2">
              <AlertOctagon size={16} />
              Logical Mapping Information
            </h4>
            <div className="text-xs text-slate-400 space-y-4 leading-relaxed">
              <p>
                The application calculates{" "}
                <span className="text-indigo-200 font-semibold underline decoration-indigo-500/40">
                  Performance vs Target
                </span>{" "}
                by aggregating all **Sales Sheet** records where the month
                matches the assigned target in the **Targets Sheet**.
              </p>
              <p>
                Collection metrics use a{" "}
                <span className="text-emerald-200 font-semibold underline decoration-emerald-500/40">
                  Temporal Delta Mapping
                </span>
                . By matching the `Invoice No` in Collections to the `Invoice`
                in Sales, the system automatically derives **Payment Velocity
                (Days to Pay)** and identifies delinquency risks without manual
                entry of aging buckets.
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => {
                const workbook = XLSX.utils.book_new();

                // Sales Sheet
                const salesData = [
                  [
                    "SL",
                    "Branch",
                    "Sales Person",
                    "Buyer Group",
                    "Sales Order",
                    "Invoice",
                    "Remarks",
                    "Buyer",
                    "Brand",
                    "Group",
                    "Product",
                    "Quantity",
                    "Unit Price",
                    "Exclude Vat Tax",
                    "Vat",
                    "Tax",
                    "Vat & Tax",
                    "Total Price",
                    "Invoice Date",
                    "Product Manager",
                  ],
                  [
                    1,
                    "Dhaka HQ",
                    "Unassigned",
                    "Conglomerate",
                    "SO-1029",
                    "INV-001",
                    "Standard",
                    "Sample Enterprise Ltd",
                    "Cisco",
                    "Networking",
                    "Catalyst Switch",
                    1,
                    150000,
                    142857,
                    7143,
                    0,
                    7143,
                    150000,
                    "2026-05-27",
                    "Ahmed M.",
                  ],
                ];
                const salesWs = XLSX.utils.aoa_to_sheet(salesData);
                XLSX.utils.book_append_sheet(workbook, salesWs, "SALES");

                // Collection Sheet
                const collData = [
                  [
                    "SL",
                    "Payment Date",
                    "Transaction No",
                    "Buyer Name",
                    "Payment Method",
                    "Invoice No",
                    "Amount Collected",
                    "Status",
                  ],
                  [
                    1,
                    "2026-06-15",
                    "TXN-00123",
                    "Sample Enterprise Ltd",
                    "TT",
                    "INV-001",
                    150000,
                    "Approved",
                  ],
                ];
                const collWs = XLSX.utils.aoa_to_sheet(collData);
                XLSX.utils.book_append_sheet(workbook, collWs, "COLLECTION");

                // Targets Sheet
                const targetData = [
                  [
                    "SL",
                    "KAM",
                    "Branch",
                    "Year",
                    "Annual Sales Target",
                    "Annual Collection Target",
                  ],
                  [1, "Ahmed M.", "Unassigned", 2026, 1200000000, 1000000000],
                  [2, "Unassigned", "Chattogram Hub", 2026, 800000000, 750000000],
                ];
                const targetWs = XLSX.utils.aoa_to_sheet(targetData);
                XLSX.utils.book_append_sheet(workbook, targetWs, "TARGETS");

                // Funnel Sheet
                const funnelData = [
                  [
                    "SL",
                    "Partner",
                    "Salesman",
                    "Quarter",
                    "Start Date",
                    "End Date",
                    "Brand",
                    "Amount",
                    "Status",
                  ],
                  [1, "Southeast Bank Ltd", "Unassigned", "25-26 Q1", "2026-05-10", "2026-07-15", "Cisco", 4500000, "Commercial Pitch"],
                  [2, "Dhaka Metro Rail", "Farzana Ahmed", "25-26 Q2", "2026-05-18", "2026-08-30", "Fortinet", 8200000, "Qualified Lead"],
                ];
                const funnelWs = XLSX.utils.aoa_to_sheet(funnelData);
                XLSX.utils.book_append_sheet(workbook, funnelWs, "FUNNEL");

                XLSX.writeFile(workbook, "SalesPulse_Data_Template.xlsx");
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-950/40 cursor-pointer"
            >
              <Download size={15} />
              Download Excel Template (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
