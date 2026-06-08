/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDateFormat, getMonthsList } from "../db/localDb";

/**
 * Formats a number into Bangladeshi Taka format with Lakhs and Crores rules.
 * Examples:
 * - ৳ 1.2K (if < 1,00,000)
 * - ৳ 5.4L (if >= 1,00,000 and < 1,00,00,000)
 * - ৳ 2.8Cr (if >= 1,00,00,000)
 */
export function formatBDT(value: number, short = true, includeSymbol = true): string {
  const prefix = includeSymbol ? "৳ " : "";

  if (!short) {
    // Standard full Bangladeshi format with commas (e.g., 12,34,567)
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    
    // Round to 2 decimal places to avoid floating point representation issues
    const roundedStr = absValue.toFixed(2);
    const parts = roundedStr.split(".");
    let integerPart = parts[0];
    const decimalPart = parts[1] === "00" ? "" : "." + parts[1];

    if (integerPart.length > 3) {
      const lastThree = integerPart.substring(integerPart.length - 3);
      const remaining = integerPart.substring(0, integerPart.length - 3);
      // Group remaining by twos (Bangladeshi system)
      const grouped: string[] = [];
      for (let i = remaining.length; i > 0; i -= 2) {
        const start = Math.max(0, i - 2);
        grouped.unshift(remaining.substring(start, i));
      }
      integerPart = grouped.join(",") + "," + lastThree;
    }

    return `${isNegative ? "-" : ""}${prefix}${integerPart}${decimalPart}`;
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 10000000) {
    // 1 Crore = 10,000,000 (10 Million)
    const crValue = absValue / 10000000;
    const formattedCr = Number(crValue.toFixed(2));
    return `${sign}${prefix}${formattedCr} Cr`;
  } else if (absValue >= 100000) {
    // 1 Lakh = 100,000 (100 Thousand)
    const lValue = absValue / 100000;
    const formattedL = Number(lValue.toFixed(2));
    return `${sign}${prefix}${formattedL} L`;
  } else if (absValue >= 1000) {
    const kValue = absValue / 1000;
    const formattedK = Number(kValue.toFixed(2));
    return `${sign}${prefix}${formattedK} K`;
  }

  const formattedVal = Number(absValue.toFixed(2));
  return `${sign}${prefix}${formattedVal}`;
}

/**
 * Generates an SVG path string for a sparkline chart given a series of data points.
 * @param data Array of numbers
 * @param width Overall sparkline width
 * @param height Overall sparkline height
 */
export function generateSparklinePath(data: number[], width = 120, height = 30): string {
  if (data.length < 2) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2; // Keep padding
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M ${points.join(" L ")}`;
}

/**
 * Formats a YYYY-MM-DD string into the user preferred format.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "N/A";
  
  try {
    const [y, m, d] = dateStr.split("-");
    const format = getDateFormat();
    
    const day = d.padStart(2, '0');
    const month = m.padStart(2, '0');
    const year = y;
    
    const monthsShort = getMonthsList();
    const monthIndex = parseInt(m, 10) - 1;
    const monthMMM = monthsShort[monthIndex] || "???";

    switch (format) {
      case "DD-MMM-YYYY":
        return `${day}-${monthMMM}-${year}`;
      case "DD/MM/YYYY":
        return `${day}/${month}/${year}`;
      case "MM/DD/YYYY":
        return `${month}/${day}/${year}`;
      case "DD-MM-YYYY":
        return `${day}-${month}-${year}`;
      case "YYYY-MM-DD":
      default:
        return `${year}-${month}-${day}`;
    }
  } catch {
    return dateStr;
  }
}

/**
 * Robustly parses a cell value as a number, stripping commas, whitespace, 
 * currency symbols (৳, $, etc.), and converting Bengali numeral characters if present.
 */
export function parseNumeric(val: any, defaultVal = 0): number {
  if (val === null || val === undefined || val === '') return defaultVal;
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;
  
  let str = String(val);
  
  // Convert Bengali numerals to Western numerals if present
  const bengaliNumerals = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  bengaliNumerals.forEach((b, idx) => {
    str = str.replace(new RegExp(b, 'g'), String(idx));
  });

  // Strip currency symbols, commas, and formatting spaces
  const sanitized = str.replace(/[৳$,\s]/g, "").trim();
  const num = Number(sanitized);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Normalizes entity/branch names to facilitate comparison,
 * ignoring common qualifiers like 'branch', extra spaces, and non-alphanumeric chars.
 */
export function normalizeName(name: string): string {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(/\bbranch\b/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .trim();
}
