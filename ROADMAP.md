# ROADMAP — accounts, patient records & history

Planned evolution of the BIVA tool from a stateless single-shot calculator into a
patient-record app backed by Google sign-in + Firebase. This is a design/planning
doc; nothing here is built yet. Decisions locked with the owner are marked **[decided]**.

The current app stays the source of truth for the *maths* (`biva.ts`) and the
*plot* (`RxcPlot.tsx`) — both stay pure and presentational. Everything below is
additive plumbing and a UI restructure around them.

## Goals

1. **Google sign-in** for the nutritionist; her data is private to her account.
2. **Persistent storage** of patients and their measurements (Firebase/Firestore).
3. **Patient-specific** graphs: pick a patient, see their vector.
4. **Date-specific** graph: each dated measurement plots its own R-Xc vector.
5. **History graph**: all of one patient's vectors on the classic R-Xc graph,
   connected in date order, showing the trajectory over time.
6. **UI restructure** into three data tiers (see below) + a bigger plot.

## Decisions [decided]

- **Three data tiers.**
  - **Global (account-wide):** the five tunable reference-ellipse parameters
    (mean R/H, mean Xc/H, SD R/H, SD Xc/H, r), per `(dataset, sex)` — tuned once
    to match the practice's BIA device. This is today's in-memory override map,
    promoted to persisted account settings.
  - **Per-patient (stable across visits):** sex, height, and which reference
    dataset (Campa 2023 adult vs Campa 2025 elderly) applies.
  - **Per-analysis (one per date):** resistance R, reactance Xc, measurement date.
- **Patient identity:** store the patient's **full name** as the identifier
  (owner accepted the GDPR exposure trade-off; see Privacy below).
- **Hosting:** stay on **GitHub Pages**. Firebase is used only as the auth + data
  backend — no hosting migration, no change to Vite `base: '/biva/'`.
- **Single practitioner:** one account, her own data silo. No patient sharing
  between accounts.

## Firestore data model

Per-user silo, enforced by security rules (`request.auth.uid == uid`):

```
users/{uid}
  settings/global                       // single doc
    referenceOverrides: {               // keyed "datasetId:sex"
      "campa2023:male":   { meanRH, meanXcH, sdRH, sdXcH, r },
      "campa2023:female": { ... }, ...
    }
    deviceNote?: string
    updatedAt

  patients/{patientId}
    name: string                        // full name [decided]
    sex: "male" | "female"
    heightCm: number
    referenceSetId: "campa2023" | "campa2025"
    createdAt, updatedAt

    analyses/{analysisId}               // subcollection, one per visit
      date: Timestamp                   // measurement date (the axis of history)
      r:  number                        // resistance, Ω
      xc: number                        // reactance, Ω
      note?: string
      createdAt
```

Why this shape:
- `analyses` as a subcollection → trivial "all of a patient's measurements,
  ordered by `date`" query, which is exactly the history graph's input.
- R/H and Xc/H are **derived**, never stored: `vector = (r / hMeters, xc / hMeters)`
  with `hMeters` from the patient's height. Editing a patient's height recomputes
  every historical point — acceptable under the per-patient-height decision.
- Global overrides keyed `datasetId:sex` mirror today's `overrideKey` exactly, so
  `biva.ts` is untouched; only the *source* of the params changes (account doc
  instead of React state).

### Security rules (starting point)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Optional hardening: lock writes to a single allowed UID/email so no other Google
user can sign in and create a silo (cost + abuse control). Add later if desired.

## New source layout

```
src/
  biva.ts          UNCHANGED — pure maths.
  references.ts    UNCHANGED — built-in published datasets (the defaults).
  RxcPlot.tsx      Extended: accepts MULTIPLE points + optional trajectory path.
  firebase.ts      NEW — initialise app, export `auth` + `db` (config via env).
  auth.tsx         NEW — useAuth() hook (onAuthStateChanged), sign in/out, gate.
  data.ts          NEW — Firestore repo: patients/analyses/settings CRUD + hooks
                   (onSnapshot live queries). Keep React-free helpers testable.
  App.tsx          Restructured into shell + the three-tier panels (see UI).
  components/      NEW — PatientList, PatientForm, AnalysisForm, GlobalSettings,
                   HistoryView, AuthGate (split out of today's monolith App).
  main.tsx         UNCHANGED entry.
  styles.css       Extended for the new shell, sidebar, wider plot.
```

Dependency stance (matches the repo's "minimal deps" ethos): add **only** the
Firebase modular SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`).
No router (use local state: `selectedPatientId` + `view`), no charting lib (the
plot stays hand-drawn SVG), no state library (React state + Firestore listeners).
If deep-linking to a patient becomes desired, revisit `react-router` then.

## UI restructure

Today: `420px | 1fr` two-column grid inside a 1180px-max shell; the plot lives in
the right `1fr` track. Target IA:

```
┌ Header: title · signed-in user · sign out · Print ───────────────────────────┐
├ Sidebar (narrow) ──────────────┬ Main (wide) ───────────────────────────────┤
│ • Patient list + "New patient" │  Patient header: name · sex · height ·       │
│ • Selected patient's settings  │    reference set   (edit → patient form)     │
│   (sex, height, reference set) │  ┌ Tabs: [This visit] [History] ───────────┐ │
│ • ⚙ Global device params       │  │ This visit: date picker + R + Xc inputs, │ │
│   (modal/screen)               │  │   then the classic R-Xc plot + metrics + │ │
│                                │  │   zone + interpretation for that date.   │ │
│                                │  │ History: every visit's vector on one     │ │
│                                │  │   plot, connected oldest→newest.         │ │
│                                │  └──────────────────────────────────────────┘ │
└────────────────────────────────┴──────────────────────────────────────────────┘
```

- **Bigger plot.** Raise `.app` max-width (~1180 → ~1400) and give the plot the
  dominant column; move inputs to the narrow sidebar. The SVG is already
  responsive (`width:100%`, `preserveAspectRatio`), so the plot grows with its
  container — the win is layout, not the SVG. Revisit the fixed `W=640/H=520`
  viewBox aspect ratio if we want it taller on wide screens.
- **Global device params** move out of the per-analysis flow into a settings
  screen/modal, loaded from `settings/global`, with the existing "edited vs
  published / reset" affordance preserved.
- **Per-patient** sex/height/reference set live on the patient record and persist
  across visits (entered once in the patient form, not re-typed each analysis).
- **Per-analysis** inputs shrink to date + R + Xc.
- Keep the `no-print` discipline; the printed handout = current patient header +
  the active plot (single visit or history) + interpretation.

## History graph

Extend `RxcPlot` (don't fork it) to optionally take an ordered list of points:

- New prop e.g. `points: Array<{ rh; xch; date; label? }>` (the single-visit view
  passes a one-element list).
- Draw a polyline through the points in date order; marker at each; **oldest
  faded → newest emphasized** (opacity/size ramp) so direction reads at a glance;
  optional arrowhead on the latest segment.
- Axis auto-grow already widens the frame to contain an out-of-range point
  (`RxcPlot.tsx:51-60`); feed it **all** history points so none clip.
- Ellipses + interpretation axes are unchanged (they depend only on the reference
  params). Interpretation text: show the **latest** visit's; history conveys the
  trend visually. Optionally annotate first→last deltas later.

## Build phases

Each phase is independently shippable and keeps `npm run build` green.

0. **Firebase bootstrap.** Create project; enable Google auth; add
   `pietrodusi.github.io` to authorized domains; `firebase.ts` + env-injected
   config (GitHub Actions secrets → `VITE_FIREBASE_*`); auth gate wraps the app.
   No data yet — existing in-memory flow still works once signed in.
1. **Global settings.** Persist the five params to `settings/global`; move them to
   a settings screen; load on sign-in.
2. **Patients.** Patient CRUD + sidebar list; move sex/height/reference set onto
   the patient record; "This visit" reads patient context.
3. **Analyses.** Dated R/Xc CRUD per patient; single-date plot from a stored
   analysis; visit list.
4. **History view.** Multi-point `RxcPlot` + trajectory; tab to switch.
5. **Polish.** Wider responsive layout, navigation, print for both views,
   empty/loading/error states.

## Risks & notes

- **GitHub Pages + Firebase Auth:** `signInWithPopup` needs the Pages domain in
  Firebase's authorized-domains list; works over HTTPS. No server needed.
- **Config in a public repo:** Firebase *web* config keys are not secrets, but
  inject them via Actions env (`VITE_FIREBASE_*`) to keep the repo clean and allow
  rotation/domain-restriction. Security is enforced by auth + Firestore rules,
  not by hiding the key.
- **Privacy / GDPR:** storing full patient names means a breach of the account
  exposes identifiable health data. Mitigations to keep in mind: strict per-UID
  rules (above), an optional single-UID allowlist, a privacy note in the footer,
  and considering Firebase App Check later. (Pseudonymous codes were offered and
  declined; revisit if requirements change.)
- **Height over time:** fixed per patient by decision; changing it recomputes all
  historical vectors. If real height drift matters later, add a per-analysis
  height override without breaking the model.
- **Bundle size:** the modular Firebase SDK (auth + firestore) adds ~100–150 kB
  gzip. Acceptable; tree-shaken via per-module imports.
- **BIVA scope unchanged:** still qualitative — no body-fat/muscle conversions,
  ever, including in history/trend views.
```
