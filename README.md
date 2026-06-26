# BIVA R-Xc Graph Tool

A small single-page app for **Bioelectrical Impedance Vector Analysis (BIVA)**. It
plots a patient's height-normalised bioimpedance vector `(R/H, Xc/H)` against the
50 / 75 / 95 % tolerance ellipses of a reference population, on the classic R-Xc graph.

BIVA is a *qualitative* method: it plots the raw impedance vector directly and does
**not** estimate body fat or muscle mass.

**Live site:** https://pietrodusi.github.io/biva/

## What it does

- Inputs: Resistance R (Ω), Reactance Xc (Ω), Height (cm or m), Sex.
- Reference parameters (mean R/H, mean Xc/H, SD R/H, SD Xc/H, correlation r) are
  pre-filled with **real published values** and remain fully editable.
- Outputs: R/H, Xc/H, phase angle, Mahalanobis distance, which tolerance ellipse the
  point falls in, and a one-line plain-language interpretation (hydration / cell mass).
- Print / Save-as-PDF for handing a result to the patient.

## Reference datasets shipped

Values are transcribed verbatim from the figure panels of the source papers. All use a
phase-sensitive, foot-to-hand (whole-body, supine) analyser at 50 kHz.

| Dataset | Population | Source |
| --- | --- | --- |
| Campa 2023 (default) | General adults 18–65 | Clin. Nutr. 2023;42:1749–1758, [doi:10.1016/j.clnu.2023.07.025](https://doi.org/10.1016/j.clnu.2023.07.025) |
| Campa 2025 | Older adults 65+ | Front. Nutr. 2025;12:1640407, [doi:10.3389/fnut.2025.1640407](https://doi.org/10.3389/fnut.2025.1640407) |

For other populations (pediatric, athletic, pathological) see the Serafini et al. 2025
scoping review ([doi:10.3390/jfmk10040415](https://doi.org/10.3390/jfmk10040415)) and type
the five parameters into the editable fields.

> ⚠ The reference set must match the BIA device and protocol used. Raw Xc and phase angle
> differ between device brands and between supine and standing analyzers.

## The maths

All formulas live in [`src/biva.ts`](src/biva.ts) and are commented for audit:

- Covariance `Σ = [[sd_R², r·sd_R·sd_Xc], [r·sd_R·sd_Xc, sd_Xc²]]`.
- Tolerance-ellipse scale factor `k = √(chi2inv(p, 2)) = √(−2·ln(1−p))` →
  1.177 (50 %), 1.665 (75 %), 2.448 (95 %). These are **tolerance** ellipses (spread of
  individuals), not confidence ellipses for the mean — the covariance is **not** divided by √n.
- Ellipses are drawn parametrically from the eigen-decomposition of `Σ`.
- Classification uses the Mahalanobis distance of the point from the reference mean.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the app and
publishes `dist/` to GitHub Pages. The Vite `base` is set to `/biva/` for production.

## Disclaimer

This is a calculation and plotting aid, not a diagnostic device. Interpretation is the
clinician's responsibility.
