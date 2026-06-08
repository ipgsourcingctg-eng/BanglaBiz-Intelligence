/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DashboardTheme, ThemeType } from "../types";

export const CUSTOM_THEMES: Record<ThemeType, DashboardTheme> = {
  "sophisticated-dark": {
    variant: "sophisticated-dark",
    name: "Sophisticated Dark",
    isDark: true,
    primary: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    secondary: "text-[#a1a1aa] bg-[#18181b]",
    bgMain: "bg-[#0c0c0e] text-[#fafafa]",
    bgCard: "bg-[#18181b] border-[#27272a]",
    border: "border-[#27272a]",
    textMuted: "text-[#71717a]",
    textMain: "text-[#fafafa]",
    cardShadow: "shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
  },
  "dark-elegant": {
    variant: "dark-elegant",
    name: "Elegant Dark",
    isDark: true,
    primary: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    secondary: "text-slate-300 bg-slate-800/80",
    bgMain: "bg-slate-950 text-slate-100",
    bgCard: "bg-slate-900/90 border-slate-800/80",
    border: "border-slate-800/80",
    textMuted: "text-slate-400",
    textMain: "text-slate-100",
    cardShadow: "shadow-[0_8px_30px_rgb(0,0,0,0.6)]"
  },
  "midnight-blue": {
    variant: "midnight-blue",
    name: "Midnight Blue",
    isDark: true,
    primary: "text-sky-400 bg-sky-400/10 border-sky-400/30",
    secondary: "text-indigo-200 bg-indigo-950/80",
    bgMain: "bg-slate-950 text-indigo-50",
    bgCard: "bg-slate-900 border-indigo-950/60",
    border: "border-indigo-950/60",
    textMuted: "text-indigo-300/70",
    textMain: "text-indigo-50",
    cardShadow: "shadow-[0_8px_30px_rgb(8,17,44,0.7)]"
  },
  "forest-green": {
    variant: "forest-green",
    name: "Forest Green",
    isDark: true,
    primary: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    secondary: "text-stone-300 bg-stone-900",
    bgMain: "bg-stone-950 text-stone-100",
    bgCard: "bg-emerald-950/30 border-emerald-900/30",
    border: "border-emerald-900/30",
    textMuted: "text-stone-400/80",
    textMain: "text-stone-100",
    cardShadow: "shadow-[0_8px_30px_rgb(2,18,8,0.6)]"
  },
  "corporate-light": {
    variant: "corporate-light",
    name: "Corporate Light",
    isDark: false,
    primary: "text-blue-700 bg-blue-50 border-blue-200",
    secondary: "text-slate-700 bg-slate-100",
    bgMain: "bg-slate-50 text-slate-900",
    bgCard: "bg-white border-slate-200",
    border: "border-slate-300",
    textMuted: "text-slate-600",
    textMain: "text-slate-900",
    cardShadow: "shadow-[0_4px_20px_rgb(0,0,0,0.08)]"
  },
  "royal-purple": {
    variant: "royal-purple",
    name: "Royal Purple",
    isDark: true,
    primary: "text-purple-400 bg-purple-400/10 border-purple-400/30",
    secondary: "text-zinc-300 bg-zinc-900",
    bgMain: "bg-zinc-950 text-zinc-100",
    bgCard: "bg-zinc-900/90 border-purple-950/50",
    border: "border-purple-950/50",
    textMuted: "text-zinc-400",
    textMain: "text-zinc-100",
    cardShadow: "shadow-[0_8px_30px_rgb(24,2,38,0.6)]"
  },
  "executive-black": {
    variant: "executive-black",
    name: "Executive Black",
    isDark: true,
    primary: "text-neutral-200 bg-neutral-800 border-neutral-700",
    secondary: "text-neutral-400 bg-neutral-900",
    bgMain: "bg-black text-white",
    bgCard: "bg-[#0b0b0b] border-[#1f1f1f]",
    border: "border-[#1f1f1f]",
    textMuted: "text-neutral-500",
    textMain: "text-neutral-100",
    cardShadow: "shadow-[0_8px_40px_rgba(0,0,0,0.95)]"
  }
};
