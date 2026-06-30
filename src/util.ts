/** Small shared input-parsing/validation helpers (no React, no Firebase). */

export type HeightUnit = "cm" | "m";

/** Parse a controlled-input string to a finite number, or null if blank/invalid. */
export function num(s: string): number | null {
  if (s.trim() === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Plausible height bounds per unit, used to reject typos. */
export const heightRange = (u: HeightUnit) =>
  u === "cm" ? { min: 50, max: 250 } : { min: 0.5, max: 2.5 };

/** Convert a height value in the given unit to metres. */
export const toMeters = (value: number, unit: HeightUnit): number =>
  unit === "cm" ? value / 100 : value;

/** Today's date as a local "YYYY-MM-DD" string (timezone-safe, date only). */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Render a "YYYY-MM-DD" date string in Italian locale (e.g. "12 mar 2025"). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
