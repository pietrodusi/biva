import type { RefParams } from "./biva";

export type Sex = "male" | "female";

export interface ReferenceSet {
  id: string;
  label: string; // short label for the selector
  population: string; // who it describes
  device: string; // measurement protocol the values assume
  citation: string; // human-readable citation
  doi: string;
  url: string;
  /** The five tolerance-ellipse parameters per sex, read from the source. */
  params: Record<Sex, RefParams & { n: number }>;
}

/**
 * Real, published BIVA reference values.
 *
 * The five parameters per sex (mean R/H, mean Xc/H, SD R/H, SD Xc/H, r) are
 * printed inside the figure panels of the source papers and are transcribed
 * here verbatim. All sets below use a phase-sensitive, foot-to-hand
 * (whole-body, supine) analyser at 50 kHz — make sure your device matches.
 */
export const REFERENCE_SETS: ReferenceSet[] = [
  {
    id: "campa2023",
    label: "General adults 18–65 — Campa 2023",
    population: "Apparently healthy general adults, 18–65 y (Italy, multicentre)",
    device: "Phase-sensitive foot-to-hand BIA, 50 kHz (supine)",
    citation:
      "Campa F, Coratella G, et al. New bioelectrical impedance vector references and phase angle centile curves in 4,367 adults. Clinical Nutrition 2023;42:1749–1758.",
    doi: "10.1016/j.clnu.2023.07.025",
    url: "https://doi.org/10.1016/j.clnu.2023.07.025",
    // Values from Fig. 2, panels A (male) and C (female).
    params: {
      male: { meanRH: 265.7, meanXcH: 32.1, sdRH: 35.1, sdXcH: 4.9, r: 0.6, n: 2137 },
      female: { meanRH: 337.2, meanXcH: 35.9, sdRH: 47.8, sdXcH: 5.5, r: 0.67, n: 2230 },
    },
  },
  {
    id: "campa2025",
    label: "Older adults 65+ — Campa 2025",
    population: "Community-dwelling older adults, 65–97 y",
    device: "Phase-sensitive foot-to-hand BIA, 50 kHz (supine)",
    citation:
      "Campa F, et al. Bioelectrical impedance vector analysis in older adults: reference standards from a cross-sectional study. Frontiers in Nutrition 2025;12:1640407.",
    doi: "10.3389/fnut.2025.1640407",
    url: "https://doi.org/10.3389/fnut.2025.1640407",
    // Values from Fig. 1 data tables (men / women, lower panels).
    params: {
      male: { meanRH: 280.2, meanXcH: 26.8, sdRH: 47.9, sdXcH: 4.1, r: 0.6, n: 363 },
      female: { meanRH: 363.8, meanXcH: 30.6, sdRH: 63.9, sdXcH: 6.1, r: 0.7, n: 472 },
    },
  },
];

export const DEFAULT_SET_ID = "campa2023";

export function getReferenceSet(id: string): ReferenceSet {
  return REFERENCE_SETS.find((s) => s.id === id) ?? REFERENCE_SETS[0];
}

/** A further compilation the nutritionist can consult for other populations. */
export const COMPILATION_REFERENCE = {
  citation:
    "Serafini S, et al. Reference Tolerance Ellipses in Bioelectrical Impedance Vector Analysis Across General, Pediatric, Pathological, and Athletic Populations: A Scoping Review. J. Funct. Morphol. Kinesiol. 2025;10:415.",
  doi: "10.3390/jfmk10040415",
  url: "https://doi.org/10.3390/jfmk10040415",
};
