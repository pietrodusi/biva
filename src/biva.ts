/**
 * BIVA (Bioelectrical Impedance Vector Analysis) maths.
 *
 * The whole file is written to be auditable: every formula is the standard
 * tolerance-ellipse construction used in the BIVA literature (Piccoli 1994;
 * Campa 2023). Nothing here estimates body fat or muscle — BIVA plots the raw,
 * height-normalised impedance vector and compares it to a reference population.
 *
 * Coordinate system used throughout:
 *   x = R/H  (resistance / height, ohm/m)  -> horizontal axis
 *   y = Xc/H (reactance / height, ohm/m)   -> vertical axis
 */

/** The five numbers that fully define a sex-specific reference population. */
export interface RefParams {
  meanRH: number; // mean of R/H   (ohm/m)
  meanXcH: number; // mean of Xc/H (ohm/m)
  sdRH: number; // SD of R/H       (ohm/m)
  sdXcH: number; // SD of Xc/H     (ohm/m)
  r: number; // Pearson correlation between R/H and Xc/H (dimensionless, -1..1)
}

/** A height-normalised impedance point. */
export interface Vector {
  rh: number; // R/H  (ohm/m)
  xch: number; // Xc/H (ohm/m)
}

/**
 * Tolerance-ellipse scale factors.
 *
 * A bivariate-normal probability region at confidence p is the set of points
 * whose squared Mahalanobis distance is <= chi2inv(p, 2 df). The ellipse drawn
 * on the R-Xc graph is therefore the reference covariance scaled by
 *   k = sqrt(chi2inv(p, 2)).
 *
 * For 2 degrees of freedom the chi-square quantile has a closed form:
 *   chi2inv(p, 2) = -2 * ln(1 - p)
 * so k = sqrt(-2 * ln(1 - p)). This reproduces the textbook values
 *   50% -> 1.1774, 75% -> 1.6651, 95% -> 2.4477.
 *
 * NOTE: these are *tolerance* ellipses (spread of individuals in the reference
 * population), NOT *confidence* ellipses for the mean. We deliberately do NOT
 * divide the covariance by sqrt(n).
 */
export function ellipseK(p: number): number {
  return Math.sqrt(-2 * Math.log(1 - p));
}

export const LEVELS = [
  { p: 0.5, k: ellipseK(0.5) },
  { p: 0.75, k: ellipseK(0.75) },
  { p: 0.95, k: ellipseK(0.95) },
] as const;

export const K50 = ellipseK(0.5);
export const K75 = ellipseK(0.75);
export const K95 = ellipseK(0.95);

/**
 * Build the 2x2 covariance matrix [[a, b], [b, c]] from the SDs and r.
 *   a = Var(R/H)            = sdRH^2
 *   c = Var(Xc/H)           = sdXcH^2
 *   b = Cov(R/H, Xc/H)      = r * sdRH * sdXcH
 */
export function covariance(ref: RefParams): { a: number; b: number; c: number } {
  return {
    a: ref.sdRH * ref.sdRH,
    c: ref.sdXcH * ref.sdXcH,
    b: ref.r * ref.sdRH * ref.sdXcH,
  };
}

export interface Eigen {
  l1: number; // larger eigenvalue  -> variance along the MAJOR axis
  l2: number; // smaller eigenvalue -> variance along the MINOR axis
  v1: [number, number]; // unit eigenvector for l1 (major axis direction)
  v2: [number, number]; // unit eigenvector for l2 (minor axis direction)
}

/**
 * Eigen-decomposition of a symmetric 2x2 matrix [[a, b], [b, c]].
 *
 * Eigenvalues: lambda = (a + c)/2 +/- sqrt(((a - c)/2)^2 + b^2).
 * Eigenvector for lambda satisfies (a - lambda) x + b y = 0, giving the
 * direction (b, lambda - a) — equivalently (lambda - c, b). We use the latter
 * and fall back to the coordinate axes when the matrix is already diagonal.
 */
export function eigenSym2(a: number, b: number, c: number): Eigen {
  const tr = a + c;
  const disc = Math.sqrt(((a - c) / 2) * ((a - c) / 2) + b * b);
  const l1 = tr / 2 + disc;
  const l2 = tr / 2 - disc;

  let v1: [number, number];
  if (Math.abs(b) > 1e-12) {
    v1 = [l1 - c, b];
  } else {
    // Diagonal matrix: axes are the eigenvectors. The major axis follows
    // whichever variance is larger.
    v1 = a >= c ? [1, 0] : [0, 1];
  }
  const n1 = Math.hypot(v1[0], v1[1]) || 1;
  v1 = [v1[0] / n1, v1[1] / n1];

  // The minor axis is orthogonal to the major axis.
  const v2: [number, number] = [-v1[1], v1[0]];
  return { l1, l2, v1, v2 };
}

/**
 * Squared Mahalanobis distance of a point from the reference mean:
 *   d^2 = [dx dy] * Sigma^-1 * [dx dy]^T
 * with Sigma^-1 = (1/det) [[c, -b], [-b, a]]. Expanded:
 *   d^2 = (c*dx^2 - 2*b*dx*dy + a*dy^2) / det.
 * d itself is directly comparable to the ellipse scale factors k.
 */
export function mahalanobis(point: Vector, ref: RefParams): number {
  const { a, b, c } = covariance(ref);
  const det = a * c - b * b;
  const dx = point.rh - ref.meanRH;
  const dy = point.xch - ref.meanXcH;
  const d2 = (c * dx * dx - 2 * b * dx * dy + a * dy * dy) / det;
  return Math.sqrt(Math.max(0, d2));
}

export type Zone = "inside50" | "between50and75" | "between75and95" | "outside95";

export function classify(distance: number): Zone {
  if (distance <= K50) return "inside50";
  if (distance <= K75) return "between50and75";
  if (distance <= K95) return "between75and95";
  return "outside95";
}

export const ZONE_LABEL: Record<Zone, string> = {
  inside50: "Inside the 50% ellipse",
  between50and75: "Between the 50% and 75% ellipses",
  between75and95: "Between the 75% and 95% ellipses",
  outside95: "Outside the 95% ellipse",
};

/**
 * Sample points along one tolerance ellipse, in data (R/H, Xc/H) coordinates.
 *
 * Parametric form (avoids any rotate-transform / y-flip bookkeeping):
 *   P(t) = mean + k*sqrt(l1)*cos(t)*v1 + k*sqrt(l2)*sin(t)*v2,  t in [0, 2pi)
 * where (l1, v1) and (l2, v2) are the eigenpairs of the covariance matrix.
 */
export function ellipsePoints(ref: RefParams, k: number, steps = 160): Array<[number, number]> {
  const { a, b, c } = covariance(ref);
  const { l1, l2, v1, v2 } = eigenSym2(a, b, c);
  const s1 = k * Math.sqrt(Math.max(0, l1));
  const s2 = k * Math.sqrt(Math.max(0, l2));
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    pts.push([
      ref.meanRH + s1 * ct * v1[0] + s2 * st * v2[0],
      ref.meanXcH + s1 * ct * v1[1] + s2 * st * v2[1],
    ]);
  }
  return pts;
}

/** Phase angle (degrees) = arctan(Xc / R). Uses raw R and Xc (height cancels). */
export function phaseAngleDeg(R: number, Xc: number): number {
  return (Math.atan2(Xc, R) * 180) / Math.PI;
}

export type Tendency = "low" | "normal" | "high";

export interface Interpretation {
  /** Standardised position along the major (hydration) axis, SD units, +up. */
  zHydration: number;
  /** Standardised position along the minor (cell-mass) axis, SD units, +right. */
  zCellMass: number;
  hydration: Tendency; // high = dehydration pole, low = oedema pole
  cellMass: Tendency; // high = more cell mass (left), low = less (right)
  text: string; // one-line plain-language summary
}

const magnitudeWord = (z: number): string => {
  const a = Math.abs(z);
  if (a < 1) return "slightly";
  if (a < 2) return "moderately";
  return "markedly";
};

/**
 * Plain-language interpretation from the point's position relative to the two
 * ellipse axes (see the brief):
 *   - Major axis = hydration. Upper pole = dehydration, lower pole = oedema.
 *   - Minor axis = cell mass / membrane integrity. Left = more, right = less.
 *
 * We project the deviation (point - mean) onto each unit eigenvector and
 * standardise by that axis's SD (sqrt of the eigenvalue) so the result is in
 * comparable "how many SDs along this axis" units.
 */
export function interpret(point: Vector, ref: RefParams): Interpretation {
  const { a, b, c } = covariance(ref);
  const { l1, l2, v1, v2 } = eigenSym2(a, b, c);

  // Orient the major axis so it points toward the UPPER pole (increasing Xc/H).
  const major: [number, number] = v1[1] >= 0 ? v1 : [-v1[0], -v1[1]];
  // Orient the minor axis so it points to the RIGHT (increasing R/H).
  const minor: [number, number] = v2[0] >= 0 ? v2 : [-v2[0], -v2[1]];

  const dx = point.rh - ref.meanRH;
  const dy = point.xch - ref.meanXcH;

  const projMajor = dx * major[0] + dy * major[1];
  const projMinor = dx * minor[0] + dy * minor[1];

  const zHydration = projMajor / Math.sqrt(Math.max(l1, 1e-12));
  const zCellMass = projMinor / Math.sqrt(Math.max(l2, 1e-12));

  const tendency = (z: number): Tendency => (z > 1 ? "high" : z < -1 ? "low" : "normal");
  const hydration = tendency(zHydration);
  // For cell mass, "high" should mean MORE cell mass, which is the LEFT pole
  // (negative projection along the right-pointing minor axis). Flip the sign.
  const cellMass = tendency(-zCellMass);

  // Hydration noun-phrase (toward upper pole = dehydration; lower = oedema).
  let hydrationText: string;
  if (hydration === "normal") {
    hydrationText = "typical hydration";
  } else if (hydration === "high") {
    hydrationText = `${magnitudeWord(zHydration)} reduced total body water (toward the dehydration pole)`;
  } else {
    hydrationText = `${magnitudeWord(zHydration)} excess fluid (toward the over-hydration / oedema pole)`;
  }

  // Cell-mass noun-phrase (left = more cell mass; right = less).
  let cellText: string;
  if (cellMass === "normal") {
    cellText = "typical cell mass";
  } else if (cellMass === "high") {
    cellText = `${magnitudeWord(zCellMass)} greater cell mass (higher reactance)`;
  } else {
    cellText = `${magnitudeWord(zCellMass)} reduced cell mass (lower reactance)`;
  }

  const text =
    hydration === "normal" && cellMass === "normal"
      ? "The vector sits close to the reference mean: hydration and cell mass are both within the typical range."
      : `Relative to the reference population, this vector suggests ${hydrationText} and ${cellText}.`;

  return { zHydration, zCellMass, hydration, cellMass, text };
}
