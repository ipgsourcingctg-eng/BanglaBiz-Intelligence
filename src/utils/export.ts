/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from "jspdf";
import domtoimage from "dom-to-image";
import pptxgen from "pptxgenjs";
import * as XLSX from "xlsx";
import { SalesRecord } from "../types";
import { formatBDT } from "./format";

/**
 * Exports data to an Excel (.xlsx) file
 */
export function exportToExcel(data: any[], fileName: string) {
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${fileName.toLowerCase().replace(/ /g, "_")}_${Date.now()}.xlsx`);
  } catch (error) {
    console.error("Excel export failed:", error);
  }
}

/**
 * Exports a specified DOM element to a standard high-quality PDF document (Multi-page or single landscape page)
 */
export async function exportDashboardToPdf(elementId: string, title = "SalesPulse Analytical Report") {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error("DOM element not found for PDF export", elementId);
    return;
  }

  try {
    const dataUrl = await domtoimage.toPng(container, {
        bgcolor: "#0d0e12"
    });
    
    const pdf = new jsPDF("l", "mm", "a4");
    const imgWidth = 297;
    const pageHeight = 210;
    
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => { img.onload = resolve; });
    
    const imgHeight = (img.height * imgWidth) / img.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(img.src, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(img.src, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;
    }

    const pdfData = pdf.output("blob");
    const fileName = `${title.toLowerCase().replace(/ /g, "_")}_${Date.now()}.pdf`;
    
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfData], fileName, { type: "application/pdf" })] })) {
      try {
        await navigator.share({
          files: [new File([pdfData], fileName, { type: "application/pdf" })],
          title: title,
        });
      } catch (err) {
        console.warn("Share failed, falling back to download:", err);
        pdf.save(fileName);
      }
    } else {
      pdf.save(fileName);
    }
  } catch (error) {
    console.error("Failed to generate PDF export", error);
  }
}

/**
 * Automates an executive presentation (.pptx) deck creation using pptxgenjs
 * Enhanced to capture real KPI cards and Dynamic Charts as images
 */
export async function exportDashboardToSlides(
  filteredRecords: SalesRecord[],
  totals: {
    revenue: number;
    netSales: number;
    orders: number;
    quantity: number;
    vatTax: number;
    activeBuyers: number;
  },
  branchBreakdown: { name: string; sales: number; percent: number }[],
  topProducts: { name: string; sales: number; quantity: number }[]
) {
  const pptx = new pptxgen();
  
  const captureSection = async (id: string): Promise<string | null> => {
    const el = document.getElementById(id);
    if (!el) return null;
    try {
      return await domtoimage.toPng(el, {
        bgcolor: "#0F172A"
      });
    } catch (e) {
      console.warn(`Failed to capture ${id}:`, e);
      return null;
    }
  };

  const kpiImg = await captureSection("kpi-reporting-section");
  const chartsImg = await captureSection("analytical-charts-suite");

  pptx.layout = "LAYOUT_16x9";
  pptx.defineSlideMaster({
    title: "SALESPULSE_MASTER",
    background: { fill: "0F172A" },
    slideNumber: { x: 12.5, y: 7.0, color: "94A3B8" }
  });

  // Slide 1: Welcome & Executive Title
  let slide1 = pptx.addSlide({ masterName: "SALESPULSE_MASTER" });
  slide1.addText("SALESPULSE BI PRESENTATION", {
    x: 1.0, y: 2.2, w: 11.3, h: 0.8,
    fontSize: 42, bold: true, color: "F59E0B", fontFace: "Arial"
  });
  slide1.addText("National Distribution & Sales Analytics Executive Audit", {
    x: 1.0, y: 3.1, w: 11.3, h: 0.5,
    fontSize: 20, color: "E2E8F0", fontFace: "Arial"
  });
  
  // Slide 2: KPI Dashboard Snapshot (Visual)
  if (kpiImg) {
    let slideKpi = pptx.addSlide({ masterName: "SALESPULSE_MASTER" });
    slideKpi.addImage({ data: kpiImg, x: 0.5, y: 0.5, w: 12.3, h: 6.5 });
  }
 
  // Slide 3: Charts Visual
  if (chartsImg) {
    let slideCharts = pptx.addSlide({ masterName: "SALESPULSE_MASTER" });
    slideCharts.addImage({ data: chartsImg, x: 0.5, y: 0.5, w: 12.3, h: 6.5 });
  }

  // Slide 4: Strategic Advisory
  let slide5 = pptx.addSlide({ masterName: "SALESPULSE_MASTER" });
  slide5.addText("STRATEGIC ADVISORY", {
    x: 0.8, y: 0.6, w: 11.0, h: 0.4,
    fontSize: 22, bold: true, color: "F472B6" 
  });
  const bulletPoints = [
    "Regional Optimization: Direct sales resources toward high-growth corridors.",
    "Inventory Management: Focus on high-margin core products.",
    "Receivables Acceleration: Expedite invoice cycle management.",
    "Pipeline conversion: Maintain focus on active high-value opportunities."
  ];
  bulletPoints.forEach((point, idx) => {
    slide5.addText("● " + point, {
      x: 1.0, y: 1.6 + idx * 1.1, w: 11.3, h: 0.8,
      fontSize: 15, color: "F1F5F9", fontFace: "Arial"
    });
  });

  const pptxBlob = await pptx.write({ outputType: "blob" });
  const fileName = `SalesPulse_Executive_Deck_${Date.now()}.pptx`;
    
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pptxBlob], fileName, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })] })) {
    try {
      await navigator.share({
        files: [new File([pptxBlob], fileName, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })],
        title: "SalesPulse Executive Deck",
      });
    } catch (err) {
      console.warn("Share failed, falling back to download:", err);
      pptx.writeFile({ fileName });
    }
  } else {
    pptx.writeFile({ fileName });
  }
}
