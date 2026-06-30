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
