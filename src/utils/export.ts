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
export async function exportDashboardToPdf(
  elementId: string, 
  title = "SalesPulse Analytical Report",
  filteredRecords: SalesRecord[] = [],
  totals: any = {},
  branchBreakdown: any[] = [],
  topProducts: any[] = []
) {
  try {
    const captureSection = async (id: string): Promise<string | null> => {
      const el = document.getElementById(id);
      if (!el) return null;
      try {
        return await domtoimage.toPng(el, { bgcolor: "#0F172A" });
      } catch (e) {
        console.warn(`Failed to capture ${id}:`, e);
        return null;
      }
    };

    const kpiImg = await captureSection("kpi-reporting-section");
    const chartsImg = await captureSection("analytical-charts-suite");

    const pdf = new jsPDF("l", "mm", "a4");
    const currentYear = new Date().getFullYear();
    
    // Background color #0F172A
    pdf.setFillColor(15, 23, 42);

    // Slide 1: Welcome Title
    pdf.rect(0, 0, 297, 210, "F");
    pdf.setTextColor(245, 158, 11);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(42);
    pdf.text("SALESPULSE BI PRESENTATION", 148.5, 90, { align: "center" });
    
    pdf.setTextColor(226, 232, 240);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(20);
    pdf.text("National Distribution & Sales Analytics", 148.5, 110, { align: "center" });

    const addPdfSlide = (title: string, textLines?: string[], image?: string | null) => {
      pdf.addPage();
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, 297, 210, "F");
      
      pdf.setTextColor(244, 114, 182);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(32);
      pdf.text(title, 15, 30);
      
      if (image) {
        // Draw image (scaled to fit approx 267x150 mm)
        pdf.addImage(image, "PNG", 15, 45, 267, 150, undefined, "FAST");
      } else if (textLines) {
        pdf.setTextColor(241, 245, 249);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(16);
        let y = 50;
        textLines.forEach(line => {
          pdf.text(line, 20, y);
          y += 10;
        });
      } else {
        pdf.setTextColor(241, 245, 249);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(20);
        pdf.text("• Space for your contents (Exported as PDF).", 20, 60);
        pdf.text("• Note: For optimal autofit text box editing, use the PPTX export.", 20, 75);
      }
    };

    addPdfSlide("Team Intro");
    addPdfSlide("Sales Target", ["• Target Data goes here", "• Replace with your goals"]);
    
    const achievementsText = [
      `• Total Revenue: BDT ${formatBDT(totals.revenue || 0)}`,
      `• Net Sales: BDT ${formatBDT(totals.netSales || 0)}`,
      `• Total Orders: ${totals.orders || 0}`,
      `• Units Sold: ${totals.quantity || 0}`,
      `• Active Buyers: ${totals.activeBuyers || 0}`,
      ``,
      `Top Products:`,
      ...topProducts.slice(0, 3).map(p => `  - ${p.name}: BDT ${formatBDT(p.sales)} (${p.quantity} units)`),
      ``,
      `Top Branches:`,
      ...branchBreakdown.slice(0, 3).map(b => `  - ${b.name}: BDT ${formatBDT(b.sales)} (${(b.percent || 0).toFixed(1)}%)`)
    ];
    
    addPdfSlide("Achievements (KPI Summary)", achievementsText);
    if (kpiImg) addPdfSlide("Achievements (Dashboard View)", undefined, kpiImg);
    if (chartsImg) addPdfSlide("Achievements (Charts)", undefined, chartsImg);

    addPdfSlide("Shortfall");
    addPdfSlide("Collection");
    addPdfSlide(`Sales Target for ${currentYear}`);
    addPdfSlide(`Team Strategy for Year ${currentYear}`);
    addPdfSlide("Thoughts & Ideas for overall growth");

    const pdfData = pdf.output("blob");
    const fileName = `SalesPulse_Presentation_${Date.now()}.pdf`;
    
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfData], fileName, { type: "application/pdf" })] })) {
      try {
        await navigator.share({
          files: [new File([pdfData], fileName, { type: "application/pdf" })],
          title: "SalesPulse Presentation",
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
  totals: any,
  branchBreakdown: any[],
  topProducts: any[]
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

  const currentYear = new Date().getFullYear();

  // Slide 1: Welcome Title
  let slide1 = pptx.addSlide({ masterName: "SALESPULSE_MASTER" });
  slide1.addText("SALESPULSE BI PRESENTATION", {
    x: 1.0, y: 2.2, w: 11.3, h: 0.8,
    fontSize: 42, bold: true, color: "F59E0B", fontFace: "Arial", autoFit: true
  });
  slide1.addText("National Distribution & Sales Analytics", {
    x: 1.0, y: 3.1, w: 11.3, h: 0.5,
    fontSize: 20, color: "E2E8F0", fontFace: "Arial", autoFit: true
  });

  const addContentSlide = (title: string, textObj?: any, image?: string | null) => {
    let slide = pptx.addSlide({ masterName: "SALESPULSE_MASTER" });
    slide.addText(title, {
      x: 0.5, y: 0.5, w: 12.3, h: 0.8,
      fontSize: 32, bold: true, color: "F472B6", fontFace: "Arial", autoFit: true
    });
    if (image) {
      slide.addImage({ data: image, x: 0.5, y: 1.5, w: 12.3, h: 5.0, sizing: { type: "contain", w: 12.3, h: 5.0 } });
    } else if (textObj) {
      slide.addText(textObj.text, {
        x: 0.5, y: 1.5, w: 12.3, h: 5.5,
        fontSize: textObj.fontSize || 20, color: "F1F5F9", fontFace: "Arial", valign: "top", bullet: textObj.bullet, autoFit: true
      });
    } else {
      slide.addText("• Click here to add your contents\n• The text will autofit based on the contents you add.", {
        x: 0.5, y: 1.5, w: 12.3, h: 5.5,
        fontSize: 20, color: "F1F5F9", fontFace: "Arial", valign: "top", bullet: true, autoFit: true
      });
    }
  }

  addContentSlide("Team Intro");
  addContentSlide("Sales Target", { text: "• Target Data goes here\n• Replace with your goals" }, null);
  
  const achievementsText = [
    `• Total Revenue: ৳ ${formatBDT(totals.revenue)}`,
    `• Net Sales: ৳ ${formatBDT(totals.netSales)}`,
    `• Total Orders: ${totals.orders}`,
    `• Units Sold: ${totals.quantity}`,
    `• Active Buyers: ${totals.activeBuyers}`,
    `\nTop Products:`,
    ...topProducts.slice(0, 3).map(p => `  - ${p.name}: ৳ ${formatBDT(p.sales)} (${p.quantity} units)`),
    `\nTop Branches:`,
    ...branchBreakdown.slice(0, 3).map(b => `  - ${b.name}: ৳ ${formatBDT(b.sales)} (${b.percent.toFixed(1)}%)`)
  ].join("\n");
  
  addContentSlide("Achievements (KPI Summary)", { text: achievementsText, fontSize: 18, bullet: false });
  if (kpiImg) addContentSlide("Achievements (Dashboard View)", null, kpiImg);
  if (chartsImg) addContentSlide("Achievements (Charts)", null, chartsImg);

  addContentSlide("Shortfall");
  addContentSlide("Collection");
  addContentSlide(`Sales Target for ${currentYear}`);
  addContentSlide(`Team Strategy for Year ${currentYear}`);
  addContentSlide("Thoughts & Ideas for overall growth");

  const pptxBlob = await pptx.write({ outputType: "blob" });
  const fileName = `SalesPulse_Presentation_${Date.now()}.pptx`;
    
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pptxBlob], fileName, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })] })) {
    try {
      await navigator.share({
        files: [new File([pptxBlob], fileName, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })],
        title: "SalesPulse Presentation",
      });
    } catch (err) {
      console.warn("Share failed, falling back to download:", err);
      pptx.writeFile({ fileName });
    }
  } else {
    pptx.writeFile({ fileName });
  }
}
