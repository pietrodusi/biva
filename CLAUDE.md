# CLAUDE.md

Guidance for working in this repo. Keep this file current when the design changes.

## What this is

A single-page **BIVA** (Bioelectrical Impedance Vector Analysis) tool for a
nutritionist. It plots a patient's height-normalised bioimpedance vector
`(R/H, Xc/H)` against the 50 / 75 / 95 % tolerance ellipses of a reference
population on the classic R-Xc graph.

BIVA is **qualitative**: it plots the raw, height-normalised impedance vector
directly. It does **not** estimate body fat or muscle mass — never add such
conversions.

- Live: https://pietrodusi.github.io/biva/
- Repo: https://github.com/pietrodusi/biva (public)

## Stack & commands

Vite + React 18 + TypeScript. No UI/charting libraries — the plot is hand-drawn
inline SVG (crisp, prints cleanly, zero deps). The only runtime dependency
beyond React is the **Firebase** SDK (Google auth + Firestore; see ROADMAP.md).

Firebase config is read from `VITE_FIREBASE_*` env vars. For local dev, copy
`.env.example` to `.env.local` and fill it in — without it the app shows a
"not configured" screen instead of the sign-in button (`firebaseConfigured`).

```bash
npm install
npm run dev      # local dev server
npm run build    # tsc -b && vite build  -> dist/
npm run preview  # serve the production build
```

`npm run build` type-checks (project references `tsconfig.app.json` +
`tsconfig.node.json`) and is the gate that must pass before committing.

## Architecture

```
src/
  biva.ts        Pure maths. No React. The auditable core.
  references.ts  Reference datasets + overrideKey / publishedParams helpers.
  util.ts        Shared input-parsing + date helpers (no React/Firebase).
  RxcPlot.tsx    Presentational SVG plot: a single point or a history trajectory.
  firebase.ts    Firebase app init; exports `auth` + `db` (config via env).
  auth.tsx       Auth context: `useAuth()` (user, loading, sign in/out).
  AuthGate.tsx   Sign-in screen; renders the app only once signed in.
  data.ts        Firestore data layer: global settings, patients, analyses
                 (load/save helpers + live hooks). The only file touching Firestore.
  App.tsx        Shell: auth + data + selection state + layout.
  components/    PatientPicker (header dropdown), PatientForm, PatientWorkspace,
                 GlobalSettingsPanel.
  main.tsx       React entry — wraps App in AuthProvider + AuthGate.
  styles.css     All styling, including the @media print rules.
```

The UI is in Italian (`<html lang="it">`); it is the only language.

Data flow: `App` resolves the signed-in user, loads global settings + patients
(`data.ts`), and holds selection state. The selected patient + its dated analyses
feed `PatientWorkspace`, which derives the `Vector`(s) and `RefParams`, calls
`biva.ts`, and passes results to `RxcPlot`. Keep `biva.ts` free of React,
`RxcPlot` free of business logic, and `data.ts` the only place touching Firestore.

**Three data tiers** (the structural backbone): *global* device-tuned reference
params (per account), *per-patient* sex/height/reference-set (stable across
visits), *per-analysis* date/R/Xc (one per visit). R/H and Xc/H are always derived
(`r ÷ heightMetres`), never stored.

## Design decisions (the important part)

**Coordinates.** Everywhere: `x = R/H` (horizontal), `y = Xc/H` (vertical), in
Ω/m. Both raw R and Xc are divided by **height in metres** before plotting.

**The five parameters.** A reference population is fully defined per sex by:
mean R/H, mean Xc/H, SD R/H, SD Xc/H, and correlation `r`. Everything the plot
draws derives from these via the covariance matrix
`Σ = [[sd_R², r·sd_R·sd_Xc], [r·sd_R·sd_Xc, sd_Xc²]]`.

**Tolerance ellipses, not confidence ellipses.** Scale factor
`k = √(chi2inv(p, 2)) = √(−2·ln(1−p))` → 1.177 / 1.665 / 2.448. These describe
the spread of *individuals*; do **not** divide Σ by √n. Ellipses are drawn
parametrically from the eigen-decomposition of Σ (avoids SVG rotate/y-flip bugs).

**Classification** uses the Mahalanobis distance of the point from the reference
mean, compared against the same three `k` factors.

**Interpretation** projects the deviation onto the eigen-axes: major axis =
hydration (upper pole = dehydration, lower = over-hydration/oedema); minor axis =
cell mass (left = more, right = less). See the comments in `interpret()`.

**Reference data is real and sourced — not placeholder.** The original brief
asked for clearly-labelled illustrative defaults; that was overridden. Defaults
are real published values, each shown with its citation + DOI, and remain fully
editable (with reset). The device-matching caveat stays because raw Xc/phase
angle differ by device brand and supine-vs-standing protocol.

> Provenance: the five params are printed **inside the figure panels** of the
> source papers (not in tables/text). To add or verify a dataset, render the PDF
> figure and read it visually. Current sets: Campa 2023 (general adults 18–65,
> default) and Campa 2025 (older adults 65+).

## Conventions

- All maths lives in `biva.ts` and stays unit-testable in isolation. When you
  touch a formula, keep the explanatory comment truthful and re-verify against a
  known case (mean → distance 0; a point on the 95 % ellipse → d ≈ k95).
- Inputs are controlled strings; parse + validate in the form components using
  the `util.ts` helpers. Reject non-positive R/Xc and implausible heights; the
  plot only renders a point when inputs are complete and valid.
- Anything that must not appear on the printed handout gets the `no-print` class.

## Deployment

Push to `main` → `.github/workflows/deploy.yml` builds and publishes `dist/` to
GitHub Pages. Vite `base` is `/biva/` for production (`/` in dev) — keep this in
sync with the repo name; if the repo is renamed, update `vite.config.ts`.

The deploy workflow injects `VITE_FIREBASE_*` from GitHub Actions **secrets**
(Settings → Secrets and variables → Actions) into the `npm run build` step. For
Google sign-in to work on the live site, `pietrodusi.github.io` must be added to
the Firebase project's **Authentication → Settings → Authorized domains**.

**Firestore.** Data lives per account under `users/{uid}/...`:
- `settings/global` — `{ referenceOverrides: { "<datasetId>:<sex>": RefParams }, updatedAt }`
- `patients/{id}` — `{ name, sex, heightCm, referenceSetId, createdAt, updatedAt }`
- `patients/{id}/analyses/{id}` — `{ date: "YYYY-MM-DD", r, xc, note?, createdAt }`

Firestore must be enabled in the console and `firestore.rules` (per-UID access)
published via the console Rules tab or the Firebase CLI. Dates are stored as
date-only `"YYYY-MM-DD"` strings (timezone-safe; sort chronologically). The
phased delivery plan is in `ROADMAP.md`.

## Local-tooling gotchas (Windows)

- `npm` is **not** on the Bash tool's PATH (fails with exit 127). Invoke Vite
  directly: `node node_modules/vite/bin/vite.js preview`. `node` itself is fine.
- Headless Chrome routes `localhost` through a system proxy and 404s
  vite-preview sub-resources. For browser checks, serve `dist/` with a plain
  IPv4 static server on a **safe** port (8080 — Chrome blocks 5050/5060 etc.)
  or just test against the live URL.
- PDF figures: `pip install pymupdf` then render pages to PNG (`pdftoppm` is
  absent; `pdftotext` exists but can't read text baked into figures).
