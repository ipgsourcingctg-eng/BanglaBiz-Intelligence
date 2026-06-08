import React, { useMemo } from "react";
import { 
  ArrowLeftRight, CheckSquare, Coins, TrendingUp, AlertTriangle, 
  ChevronRight, ChevronLeft, Calendar 
} from "lucide-react";
import { DashboardTheme, SoftwareSubscription } from "../../types";

interface PipelineSubProps {
  subscriptions: SoftwareSubscription[];
  theme: DashboardTheme;
  onUpdateSubStage: (subId: string, newStage: SoftwareSubscription["renewal_stage"]) => void;
}

const STAGES: SoftwareSubscription["renewal_stage"][] = [
  "Not Started",
  "Customer Contacted",
  "Quotation Sent",
  "Negotiation",
  "PO Expected",
  "PO Received",
  "Renewed",
  "Lost"
];

export default function PipelineSub({ subscriptions, theme, onUpdateSubStage }: PipelineSubProps) {
  
  // Aggregate Calculations
  const stageStats = useMemo(() => {
    const stats: Record<SoftwareSubscription["renewal_stage"], { count: number; value: number }> = {
      "Not Started": { count: 0, value: 0 },
      "Customer Contacted": { count: 0, value: 0 },
      "Quotation Sent": { count: 0, value: 0 },
      "Negotiation": { count: 0, value: 0 },
      "PO Expected": { count: 0, value: 0 },
      "PO Received": { count: 0, value: 0 },
      "Renewed": { count: 0, value: 0 },
      "Lost": { count: 0, value: 0 }
    };

    subscriptions.forEach(sub => {
      if (stats[sub.renewal_stage]) {
        stats[sub.renewal_stage].count += 1;
        stats[sub.renewal_stage].value += sub.total_value;
      }
    });

    return stats;
  }, [subscriptions]);

  const totalClosedWon = stageStats["Renewed"].value;
  const totalClosedLost = stageStats["Lost"].value;
  const totalActivePipeline = subscriptions
    .filter(s => s.renewal_stage !== "Renewed" && s.renewal_stage !== "Lost")
    .reduce((acc, s) => acc + s.total_value, 0);

  const totalClosedVal = totalClosedWon + totalClosedLost;
  const winPercent = totalClosedVal > 0 ? (totalClosedWon / totalClosedVal) * 100 : 85; // fallback defaults
  const lossPercent = totalClosedVal > 0 ? (totalClosedLost / totalClosedVal) * 100 : 15;

  const handleStageShift = (subId: string, currentStage: SoftwareSubscription["renewal_stage"], dir: "forward" | "backward") => {
    const idx = STAGES.indexOf(currentStage);
    if (dir === "forward" && idx < STAGES.length - 1) {
      onUpdateSubStage(subId, STAGES[idx + 1]);
    } else if (dir === "backward" && idx > 0) {
      onUpdateSubStage(subId, STAGES[idx - 1]);
    }
  };

  const formatBDT = (val: number) => {
    if (val >= 10000000) return `৳ ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `৳ ${(val / 100000).toFixed(1)} L`;
    return `৳ ${(val / 1000).toFixed(0)} K`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Value Stat Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Closed Renewed Deals</span>
          <h4 className="text-xl font-extrabold mt-1 text-emerald-400">{formatBDT(totalClosedWon)}</h4>
          <div className="text-[10px] font-mono mt-1 text-slate-450">
            Probability adjusted success rates
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Active Pipeline Value</span>
          <h4 className="text-xl font-extrabold mt-1 text-indigo-400">{formatBDT(totalActivePipeline)}</h4>
          <div className="text-[10px] font-mono mt-1 text-slate-450">
            In-progress pre-expiry discussions
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Win / Retention Rate</span>
          <h4 className="text-xl font-extrabold mt-1 text-indigo-300">{winPercent.toFixed(1)}%</h4>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-indigo-450 h-full" style={{ width: `${winPercent}%` }} />
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${theme.bgCard} ${theme.border}`}>
          <span className="text-[10px] uppercase font-mono tracking-wider opacity-60">Decline / Churn Rate</span>
          <h4 className="text-xl font-extrabold mt-1 text-rose-400">{lossPercent.toFixed(1)}%</h4>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-rose-500 h-full" style={{ width: `${lossPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Kanban Board Layout */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
            <ArrowLeftRight size={15} /> Active Stage Renewal Kanban Board
          </h3>
          <p className="text-[10px] font-mono opacity-60">Click buttons inside cards to advance/reverse stages</p>
        </div>

        {/* Dynamic horizontal scrolling deck safe on mobile */}
        <div className="flex gap-4 overflow-x-auto pb-4 pr-2 no-scrollbar scroll-smooth">
          {STAGES.map((stage) => {
            const stageDeals = subscriptions.filter(s => s.renewal_stage === stage);
            const totalValue = stageDeals.reduce((sum, s) => sum + s.total_value, 0);

            return (
              <div 
                key={stage}
                className={`w-[260px] shrink-0 p-3 rounded-xl border flex flex-col justify-between min-h-[460px] ${
                  theme.isDark ? "bg-slate-950/40 border-slate-900" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div>
                  {/* Stage title */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/20 mb-3">
                    <span className="font-bold text-xs max-w-[150px] truncate block text-slate-200">{stage}</span>
                    <span className="text-[10px] py-0.5 px-2 rounded-full font-bold bg-indigo-500/10 text-indigo-400 font-mono">
                      {stageDeals.length}
                    </span>
                  </div>

                  {/* Stage Metrics */}
                  <div className="mb-4 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Active value</span>
                    <span className="font-bold text-slate-300">{formatBDT(totalValue)}</span>
                  </div>

                  {/* Cards stack */}
                  <div className="space-y-3 max-h-[360px] overflow-y-auto no-scrollbar pr-1">
                    {stageDeals.length === 0 ? (
                      <div className="py-8 text-center text-[10px] text-slate-500 font-semibold border border-dashed border-slate-850/30 rounded-lg">
                        No Deals
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <div 
                          key={deal.id}
                          className={`p-3 rounded-lg border text-xs shadow-md transition-all duration-300 relative group ${
                            stage === "Renewed" ? "border-emerald-900/30 bg-emerald-950/10" :
                            stage === "Lost" ? "border-red-900/30 bg-red-950/5 text-slate-400" :
                            "border-slate-800 bg-slate-900/40 hover:bg-slate-900/70"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-bold text-slate-100 block py-0.5 break-words">
                              {deal.account_name}
                            </span>
                            <span className={`text-[8px] font-mono font-bold px-1.5 rounded py-0.5 ${
                              deal.renewal_probability >= 80 ? "bg-emerald-500/10 text-emerald-400" :
                              deal.renewal_probability >= 50 ? "bg-amber-500/10 text-amber-400" :
                              "bg-red-500/10 text-red-400"
                            }`}>
                              {deal.renewal_probability}%
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-400 font-mono mt-1.5 leading-tight truncate">
                            {deal.brand_oem} — {deal.local_vendor} — {deal.product_name}
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/10">
                            <span className="font-extrabold text-[11px] text-slate-200">
                              {formatBDT(deal.total_value)}
                            </span>
                            
                            {/* Fast-move controllers inside Kanban */}
                            <div className="flex items-center gap-1">
                              <button
                                disabled={stage === STAGES[0]}
                                onClick={() => handleStageShift(deal.id, stage, "backward")}
                                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-[10px] min-w-[18px]"
                              >
                                &lt;
                              </button>
                              <button
                                disabled={stage === STAGES[STAGES.length - 1]}
                                onClick={() => handleStageShift(deal.id, stage, "forward")}
                                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer text-[10px] min-w-[18px]"
                              >
                                &gt;
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-3 text-[9px] font-semibold text-slate-500 text-center uppercase font-mono tracking-widest pt-2 border-t border-slate-900/20">
                  {stageStats[stage].count} pipeline cards
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
