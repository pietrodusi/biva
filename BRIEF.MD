# Project brief: BIVA R-Xc graph tool

## Goal
A single, self-contained HTML file (no build step, no server, no internet) that a
nutritionist can open by double-clicking it in any browser. It plots a patient's
bioelectrical impedance vector on an R-Xc graph against 50%, 75%, and 95% tolerance
ellipses. It is a Bioelectrical Impedance Vector Analysis (BIVA) tool.

Keep everything (HTML, CSS, JS) in one `index.html`. No external libraries unless
strictly necessary; if a charting need arises, prefer drawing the plot directly on a
`<canvas>` or with inline SVG so the file stays fully offline.

## Background the build needs to respect
- A bioimpedance device outputs two raw numbers: Resistance (R, ohms) and
  Reactance (Xc, ohms).
- BIVA does NOT convert these into body-fat/muscle estimates. It plots them directly.
- Both values are first **normalized by the subject's height in meters**: the plotted
  point is (R/H, Xc/H), in ohms/meter. The X axis is R/H, the Y axis is Xc/H.
- The "tolerance ellipses" are a fixed backdrop derived from a reference population.
  They are fully defined by FIVE numbers (per sex): mean R/H, mean Xc/H, SD of R/H,
  SD of Xc/H, and the correlation r between R/H and Xc/H.
- The ellipses are bivariate-normal probability regions. The 50/75/95% contours are
  obtained from the chi-square distribution with 2 degrees of freedom (scale factor
  = sqrt(chi2inv(p, 2))): roughly 1.177 for 50%, 1.665 for 75%, and 2.448 for 95%.
  The ellipse axes/orientation come from the eigen-decomposition of the 2x2
  covariance matrix built from the SDs and r. (These are the standard tolerance
  ellipses, not confidence ellipses for the mean — do not divide by sqrt(n).)
- Interpretation to label on the chart:
  - Long (major) axis of the ellipses = hydration. Toward the upper pole =
    dehydration; toward the lower pole = hyperhydration / edema.
  - Short (minor) axis = cell mass / membrane integrity. Left = more cell mass;
    right = less. Vector length overall is inversely related to total body water.

## Inputs the page must expose (all editable in the UI)
1. Patient measurements: Resistance R (ohm), Reactance Xc (ohm), Height (allow cm or m),
   and Sex (male / female).
2. Reference parameters, as editable number fields (one set per sex, or a single set
   that switches with the Sex selector): mean R/H, mean Xc/H, SD R/H, SD Xc/H, r.
   These MUST be user-editable — the nutritionist reads them off whichever reference
   study matches his population and device and types them in.

Ship with placeholder default values that are CLEARLY LABELED in the UI as
"illustrative defaults — replace with values from your reference study". Do not
present the defaults as clinically valid. Include a short note on the page pointing to
where real values come from (see References below) and a reminder that the reference
set must match the BIA device used (raw Xc and phase angle differ between device
brands and between supine vs. standing analyzers).

## Output / behavior
- Draw the three nested ellipses, axis labels (R/H, Xc/H in ohm/m), and the patient's
  point clearly marked.
- Show computed values: R/H, Xc/H, phase angle = arctan(Xc/R) in degrees, and which
  ellipse the point falls within (inside 50% / between 50-75% / 75-95% / outside 95%).
- Add a one-line plain-language interpretation based on where the point sits relative
  to the two axes (hydration and cell-mass direction).
- A "Print / Save as PDF" button so a result can be handed to the patient.
- Sensible input validation (positive numbers, height in a plausible range).

## Constraints
- Fully offline and self-contained in one file.
- Clean, legible, clinical look. Mobile-friendly is a plus but desktop is primary.
- Comment the ellipse math clearly so it can be audited.

## References (for the nutritionist to source real parameter values)
- General adults (current recommended reference): Campa et al. 2023, Clinical Nutrition,
  "New bioelectrical impedance vector references ... in 4,367 adults" (open access).
- Older adults (65+): Campa et al. 2025, Frontiers in Nutrition,
  doi 10.3389/fnut.2025.1640407 (open access).
- Compilation across populations (general/pediatric/athletic/pathological):
  Serafini et al. 2025 scoping review, J. Funct. Morphol. Kinesiol.,
  doi 10.3390/jfmk10040415 (open access) — tabulates the five parameters for many
  reference sets.
Note: the five parameters are printed inside the figure panels of these papers; read
them off the figure for the sex/population that matches the clientele and device.
