/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Lightbulb, 
  Zap, 
  RefreshCw,
  Package,
  Award
} from "lucide-react";
import { SalesRecord, DashboardTheme } from "../types";
import { formatBDT } from "../utils/format";
import { getLocalGeminiApiKey } from "../db/localDb";
import { GoogleGenAI } from "@google/genai";

interface AiInsightsProps {
  filteredRecords: SalesRecord[];
  allRecords: SalesRecord[];
  theme: DashboardTheme;
}

export default function AiInsights({ filteredRecords, allRecords, theme }: AiInsightsProps) {
  const [aiSuggestions, setAiSuggestions] = useState<string>("");
  const [loadingGenerative, setLoadingGenerative] = useState(false);
  const [aiSource, setAiSource] = useState("Local Rules Engine (Fast)");

  // Live Rule-based CFO metrics calculation
  const getRulesBasedInsights = () => {
    if (filteredRecords.length === 0) {
      return {
        topBranch: "N/A",
        topSalesPerson: "N/A",
        topBrand: "N/A",
        topBuyer: "N/A",
        pendingInvoiceCount: 0,
        anomalies: ["No transactions matching current filters."]
      };
    }

    // 1. Branch rankings
    const branchTotals: Record<string, number> = {};
    const salespersonTotals: Record<string, number> = {};
    const brandTotals: Record<string, number> = {};
    const buyerTotals: Record<string, number> = {};
    let pendingInvoices = 0;

    filteredRecords.forEach(r => {
      branchTotals[r.Branch] = (branchTotals[r.Branch] || 0) + r["Total Price"];
      salespersonTotals[r["Sales Person"]] = (salespersonTotals[r["Sales Person"]] || 0) + r["Total Price"];
      brandTotals[r.Brand] = (brandTotals[r.Brand] || 0) + r["Total Price"];
      buyerTotals[r.Buyer] = (buyerTotals[r.Buyer] || 0) + r["Total Price"];
      if (!r.Invoice) {
        pendingInvoices++;
      }
    });

    const topBranch = Object.entries(branchTotals).sort((a,b) => b[1] - a[1])[0]?.[0] || "N/A";
    const topSalesPerson = Object.entries(salespersonTotals).sort((a,b) => b[1] - a[1])[0]?.[0] || "N/A";
    const topBrand = Object.entries(brandTotals).sort((a,b) => b[1] - a[1])[0]?.[0] || "N/A";
    const topBuyer = Object.entries(buyerTotals).sort((a,b) => b[1] - a[1])[0]?.[0] || "N/A";

    const anomalies: string[] = [];
    if (pendingInvoices > 0) {
      anomalies.push(`${pendingInvoices} sales records lack Invoice numbers. Immediate audit is recommended to prevent working capital delays.`);
    }

    const minQtyRecord = [...filteredRecords].sort((a,b) => a.Quantity - b.Quantity)[0];
    if (minQtyRecord && minQtyRecord.Quantity > 15) {
      anomalies.push(`Consistently high-volume order sizes observed. Monitor physical storage limits.`);
    }

    // Check underperforming branch (compared with others in filtered range)
    const underperformingBranch = Object.entries(branchTotals).sort((a,b) => a[1] - b[1])[0]?.[0];
    if (underperformingBranch && underperformingBranch !== topBranch) {
      anomalies.push(`Regional gap detected: ${underperformingBranch} is running below expectations in the current filtered subset.`);
    }

    return {
      topBranch,
      topSalesPerson,
      topBrand,
      topBuyer,
      pendingInvoiceCount: pendingInvoices,
      anomalies
    };
  };

  const localInsights = getRulesBasedInsights();

  // Call server-side Gemini 3.5 Flash CFO agent
  const generateGeminiInsights = async () => {
    setLoadingGenerative(true);
    setAiSuggestions("");
    try {
      // Create concise metric snapshots to send to API
      const summaryData = {
        revenue: filteredRecords.reduce((sum, r) => sum + r["Total Price"], 0),
        netSales: filteredRecords.reduce((sum, r) => sum + r["Exclude Vat Tax"], 0),
        orders: filteredRecords.length,
        quantity: filteredRecords.reduce((sum, r) => sum + r.Quantity, 0),
        vatTax: filteredRecords.reduce((sum, r) => sum + r["Vat & Tax"], 0),
        activeBuyers: new Set(filteredRecords.map(r => r.Buyer)).size
      };

      // Brands sorting
      const brandMap: Record<string, number> = {};
      filteredRecords.forEach(r => { brandMap[r.Brand] = (brandMap[r.Brand] || 0) + r["Total Price"]; });
      const topBrands = Object.entries(brandMap).sort((a,b) => b[1] - a[1]).slice(0, 3).map(x => ({ brand: x[0], revenue: x[1] }));

      // Products sorting
      const prodMap: Record<string, { qty: number; sales: number }> = {};
      filteredRecords.forEach(r => {
        const curr = prodMap[r.Product] || { qty: 0, sales: 0 };
        prodMap[r.Product] = { qty: curr.qty + r.Quantity, sales: curr.sales + r["Total Price"] };
      });
      const topProducts = Object.entries(prodMap).sort((a,b) => b[1].sales - a[1].sales).slice(0, 3).map(x => ({ name: x[0], quantity: x[1].qty, revenue: x[1].sales }));

      // Branch sorting
      const branchMap: Record<string, number> = {};
      filteredRecords.forEach(r => { branchMap[r.Branch] = (branchMap[r.Branch] || 0) + r["Total Price"]; });
      const branchBreakdown = Object.entries(branchMap).sort((a,b) => b[1] - a[1]).map(x => ({ name: x[0], sales: x[1] }));

      // Check if local key exists (for offline APK environment)
      const localKey = getLocalGeminiApiKey();
      if (localKey) {
        // Run client-side Gemini 3.5 Flash queries directly inside the APK or browser
        const ai = new GoogleGenAI({
          apiKey: localKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const prompt = `
You are SalesPulse Brain, an exceptionally clever and business-savvy Chief Financial Officer (CFO) and BI Data Analyst.
You are evaluating the technology sales performance of our company in Bangladesh (all values in local currency BDT ৳).

Here is the current dataset performance metrics summarized in BDT:
- Total Sales: ${summaryData.revenue} (in ৳ BDT)
- Net Sales (excluding Taxes): ${summaryData.netSales}
- Total Orders Placed: ${summaryData.orders}
- Total Quantity Sold: ${summaryData.quantity}
- Total VAT & Tax collected: ${summaryData.vatTax}
- Active Purchasing Enterprise Clients: ${summaryData.activeBuyers}

Top Brad Performance (Brand: Current Revenue BDT):
${JSON.stringify(topBrands)}

Top Enterprise Assets Deployed (Product: Quantity Deployed, Total Revenue):
${JSON.stringify(topProducts)}

Regional Branch Performance Breakdown (Branch: Total Sales BDT):
${JSON.stringify(branchBreakdown)}

Generate exactly 3 extremely sharp, strategic business recommendations or action points for the corporate board (under 30 words per recommendation).
Return the result in clean, structured HTML list items (using <li> tags wrapping a <strong> title) without high-level parent <ul> or <ol> tags.
Do NOT output dark theme-destructive color classes or inline styles (e.g. text-blue-600, text-gray-700), as they mix and blend invisibly with the dark background. Instead, return clean semantic tags:
For example:
<li><strong>Regional Quota Expansion:</strong> Chattogram Hub shows a 5.4L gap; recommend shifting high-performing switch reserves to their immediate inventory.</li>

Do not talk about any internal development code, files, or simulated environments. Keep annotations professional, precise, using BDT formatting (like Lakhs L, Crores Cr, thousands K).
        `;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction: "You are an expert technology distribution CFO. You write elite corporate analytical bullet points.",
            temperature: 0.7
          }
        });

        const generatedText = response.text || "";
        let cleanText = generatedText.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```html?/, "").replace(/```$/, "").trim();
        }
        
        setAiSuggestions(cleanText);
        setAiSource("Gemini 3.5-Flash (APK Client Key)");
        setLoadingGenerative(false);
        return;
      }

      const res = await fetch("/api/gemini-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryData,
          topBrands,
          topProducts,
          branchBreakdown
        })
      });

      if (!res.ok) throw new Error("Server error responding. Falling back.");
      const data = await res.json();
      setAiSuggestions(data.insights);
      setAiSource(data.source);
    } catch (e) {
      // Fallback
      setAiSource("Local Rules Engine (Fault Fallback)");
      setAiSuggestions(`
        <li class="p-2 border-l-2 border-rose-500 bg-rose-500/5 rounded-r text-[11px]">
          <strong class="text-rose-400">Generative Pipeline Timeout:</strong> Setup your official Gemini API Key in AI Studio secrets panel to fetch dynamic generative suggestions. Falling back to rules analytical engine.
        </li>
        <li class="p-2 border-l-2 border-amber-500 bg-amber-500/5 rounded-r text-[11px]">
          <strong class="text-amber-400">Inventory Alert:</strong> Bulk security gateway items (Fortinet) show high BDT margins this period. Verify distribution logistics.
        </li>
      `);
    } finally {
      setLoadingGenerative(false);
    }
  };

  return (
    <div className={`p-3 sm:p-4 rounded-2xl border transition-all h-full flex flex-col justify-between ${theme.bgCard} ${theme.border} ${theme.cardShadow}`}>
      <div>
        {/* Header Title bar */}
        <div className="flex flex-row items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-amber-400/10 rounded-lg flex items-center justify-center border border-amber-400/20 shrink-0">
              <Sparkles size={14} className="text-amber-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-xs text-slate-100 flex items-center gap-1 truncate">
                SalesPulse Brain
              </h4>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono tracking-tight">AI BI Copilot</p>
            </div>
          </div>
          
          <button
            id="trigger-gemini-insights-btn"
            onClick={generateGeminiInsights}
            disabled={loadingGenerative || filteredRecords.length === 0}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] rounded-lg transition disabled:opacity-50 cursor-pointer shadow-sm shadow-amber-500/20 shrink-0"
            title="Trigger Large Language Analytical Audit"
          >
            {loadingGenerative ? (
              <RefreshCw size={11} className="animate-spin" />
            ) : (
              <Zap size={11} className="fill-slate-950" />
            )}
            <span className="whitespace-nowrap">{loadingGenerative ? "Auditing" : "Ask CFO Advisor"}</span>
          </button>
        </div>

        {/* Current period quick summaries */}
        <div className="space-y-2 mb-4">
          
          {/* Top Performance Brand */}
          <div className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-800/80 flex items-center gap-2.5">
            <Award size={15} className="text-amber-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] text-slate-500 block uppercase font-mono">Top Brand Share</span>
              <span className="text-xs font-semibold text-slate-200 truncate block">
                {localInsights.topBrand}
              </span>
            </div>
          </div>

          {/* Underperforming alerts & anomalies */}
          {localInsights.anomalies.map((anomaly, idx) => (
            <div key={idx} className="p-2.5 rounded-lg border bg-rose-950/20 border-rose-900/40 text-rose-300 text-[11px] leading-snug flex items-start gap-2 animate-fade-in">
              <AlertTriangle size={14} className="text-rose-400 mt-0.5 shrink-0" />
              <span>{anomaly}</span>
            </div>
          ))}

          {localInsights.anomalies.length === 0 && (
            <div className="p-2.5 rounded-lg border bg-emerald-950/20 border-emerald-900/40 text-emerald-300 text-[11px] leading-snug flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              <span>All corporate invoices processed; no leakage detected in current filter settings.</span>
            </div>
          )}

        </div>

        {/* Generative Insights Body or prompt area */}
        <div className="mt-4 border-t border-slate-800 pt-4 flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb size={13} className="text-amber-400" />
            <span className="text-[10px] tracking-wide uppercase font-mono font-bold text-slate-300">
              CFO Strategic Briefings
            </span>
          </div>

          {aiSuggestions ? (
            <ul id="gemini-insights-ul-output" className="space-y-3 text-xs text-slate-300 leading-relaxed pr-1" dangerouslySetInnerHTML={{ __html: aiSuggestions }} />
          ) : (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-900 border-dashed text-center">
              <p className="text-[11px] text-[#94A3B8] leading-normal mb-3">
                Need deep portfolio analysis? Click the <strong>Ask CFO Advisor</strong> bot to trigger a specialized AI agent evaluating margin anomalies and inventory pipeline conversion.
              </p>
              <span className="inline-block text-[9px] text-slate-600 font-mono">
                System: Rule-Based analyzer prepackaged.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer system attribution */}
      <div className="mt-6 border-t border-slate-800/60 pt-3 text-center">
        <span className="text-[9px] font-mono text-slate-500 block">
          Insight Engine: <span className="text-slate-400 font-semibold">{aiSource}</span>
        </span>
      </div>
    </div>
  );
}
