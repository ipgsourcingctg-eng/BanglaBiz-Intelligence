var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
var aiClient = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not configured or holds a placeholder value.");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
app.get("/api/sheets-proxy", async (req, res) => {
  const sheetUrl = req.query.url;
  if (!sheetUrl) {
    return res.status(400).json({ error: "Missing Google Sheet publication URL." });
  }
  try {
    if (!sheetUrl.startsWith("https://docs.google.com/spreadsheets/")) {
      return res.status(400).json({ error: "Invalid google sheets URL pattern." });
    }
    let targetFetchUrl = sheetUrl.trim();
    if (targetFetchUrl.includes("/pubhtml")) {
      targetFetchUrl = targetFetchUrl.replace("/pubhtml", "/pub");
    }
    if (targetFetchUrl.includes("/pub")) {
      if (targetFetchUrl.includes("output=")) {
        targetFetchUrl = targetFetchUrl.replace(/output=[a-zA-Z0-9_-]+/g, "output=xlsx");
      } else {
        targetFetchUrl = targetFetchUrl + (targetFetchUrl.includes("?") ? "&" : "?") + "output=xlsx";
      }
    } else if (targetFetchUrl.includes("/edit")) {
      const editIndex = targetFetchUrl.indexOf("/edit");
      targetFetchUrl = targetFetchUrl.substring(0, editIndex) + "/export?format=xlsx";
    } else if (targetFetchUrl.includes("/htmlview")) {
      const viewIndex = targetFetchUrl.indexOf("/htmlview");
      targetFetchUrl = targetFetchUrl.substring(0, viewIndex) + "/export?format=xlsx";
    }
    const response = await fetch(targetFetchUrl);
    if (!response.ok) {
      throw new Error(`Sheets failed to retrieve Excel content: Status code ${response.status}`);
    }
    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader("Content-Type", contentType);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: `Failed to proxy sheet data: ${error.message}` });
  }
});
app.post("/api/gemini-insights", async (req, res) => {
  const { summaryData, topBrands, topProducts, branchBreakdown } = req.body;
  try {
    const ai = getGeminiClient();
    const prompt = `
You are BanglaBiz Brain, an exceptionally clever and business-savvy Chief Financial Officer (CFO) and BI Data Analyst.
You are evaluating the technology sales performance of our company in Bangladesh (all values in local currency BDT \u09F3).

Here is the current dataset performance metrics summarized in BDT:
- Total Sales: ${summaryData.revenue} (in \u09F3 BDT)
- Net Sales (excluding Taxes): ${summaryData.netSales}
- Total Orders Placed: ${summaryData.orders}
- Total Quantity Sold: ${summaryData.quantity}
- Total VAT & Tax collected: ${summaryData.vatTax}
- Active Purchasing Enterprise Clients: ${summaryData.activeBuyers}

Top Brad Performance (Brand: Current Revenue BDT):
${JSON.stringify(topBrands)}

Top Enterprise Assets Sold (Product: Quantity Deployed, Total Revenue):
${JSON.stringify(topProducts)}

Regional Branch Performance Breakdown (Branch: Total Sales BDT):
${JSON.stringify(branchBreakdown)}

Generate exactly 3 extremely sharp, strategic business recommendations or action points for the corporate board (under 30 words per recommendation).
Return the result in structured HTML list items (with <li> tags), including standard Tailwind classes for text colors but without parent <ul> tags.
For example:
<li><strong>Regional Quota Expansion:</strong> Chattogram Hub shows 5.4L gap; shift 2 high-performing switches to their inventory...</li>

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
    const aiText = response.text || "<li>No insights generated.</li>";
    res.json({ insights: aiText, source: "Gemini 3.5 Flash Model" });
  } catch (error) {
    console.warn("Gemini service unavailable. Activating rules-based fallback engine.", error.message);
    const topProdName = topProducts?.[0]?.name || "Core switch gear";
    const leadBranch = branchBreakdown?.[0]?.name || "Dhaka Head Office";
    const fallbackHtml = `
      <li class="p-2 border-l-2 border-amber-500 bg-amber-500/5 rounded-r">
        <strong class="text-amber-400">Inventory Distribution Alignment:</strong>
        Asset records show heavy concentration in <span class="text-slate-100 font-semibold">${leadBranch}</span>. Consider re-allocating <span class="text-slate-100 font-semibold">${topProdName}</span> buffers to meet high demand in secondary branches.
      </li>
      <li class="p-2 border-l-2 border-emerald-500 bg-emerald-500/5 rounded-r">
        <strong class="text-emerald-400">NBR Compliance Optimizations:</strong>
        With VAT/Tax values sitting at <span class="text-slate-100 font-semibold">\u09F3 ${(summaryData.vatTax / 1e5).toFixed(1)} Lakhs</span>, ensure automated audit reports are parsed and exported to prevent processing or filing bottlenecks.
      </li>
      <li class="p-2 border-l-2 border-sky-500 bg-sky-500/5 rounded-r">
        <strong class="text-sky-400">Account Pipeline Priorities:</strong>
        Address underperforming regions to prevent quota gaps; recommend immediate deployment of security licenses in lagging branch offices.
      </li>
    `;
    res.json({
      insights: fallbackHtml,
      source: "Local Rules-Based Analytical fallback",
      message: "Setup GEMINI_API_KEY in secrets panel for custom generative CFO suggestions."
    });
  }
});
async function bootServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SYS] Server running locally on http://localhost:${PORT}`);
  });
}
bootServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
