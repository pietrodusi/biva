import { useMemo, useState } from "react";
import {
  classify,
  interpret,
  mahalanobis,
  phaseAngleDeg,
  ZONE_LABEL,
  type RefParams,
  type Vector,
} from "./biva";
import {
  COMPILATION_REFERENCE,
  DEFAULT_SET_ID,
  getReferenceSet,
  REFERENCE_SETS,
  type Sex,
} from "./references";
import { RxcPlot } from "./RxcPlot";
import "./styles.css";

type HeightUnit = "cm" | "m";

const REF_FIELDS: Array<{ key: keyof RefParams; label: string; unit: string; step: number }> = [
  { key: "meanRH", label: "mean R/H", unit: "Ω/m", step: 0.1 },
  { key: "meanXcH", label: "mean Xc/H", unit: "Ω/m", step: 0.1 },
  { key: "sdRH", label: "SD R/H", unit: "Ω/m", step: 0.1 },
  { key: "sdXcH", label: "SD Xc/H", unit: "Ω/m", step: 0.1 },
  { key: "r", label: "correlation r", unit: "", step: 0.01 },
];

// Plausible-input guards.
const heightRange = (u: HeightUnit) => (u === "cm" ? { min: 50, max: 250 } : { min: 0.5, max: 2.5 });

function num(s: string): number | null {
  if (s.trim() === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export default function App() {
  const [sex, setSex] = useState<Sex>("male");
  const [setId, setSetId] = useState<string>(DEFAULT_SET_ID);

  const [R, setR] = useState("");
  const [Xc, setXc] = useState("");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");

  // Per (dataset, sex) overrides of the published reference values. Editing a
  // field stores an override; "Reset to study values" clears it.
  const [overrides, setOverrides] = useState<Record<string, RefParams>>({});

  const refSet = getReferenceSet(setId);
  const overrideKey = `${setId}:${sex}`;
  const published = refSet.params[sex];
  const ref: RefParams = overrides[overrideKey] ?? {
    meanRH: published.meanRH,
    meanXcH: published.meanXcH,
    sdRH: published.sdRH,
    sdXcH: published.sdXcH,
    r: published.r,
  };
  const isEdited = overrideKey in overrides;

  const updateRef = (key: keyof RefParams, value: string) => {
    const v = num(value);
    setOverrides((prev) => ({
      ...prev,
      [overrideKey]: { ...ref, [key]: v ?? 0 },
    }));
  };
  const resetRef = () =>
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[overrideKey];
      return next;
    });

  // --- Validation + derived patient values ---------------------------------
  const rVal = num(R);
  const xcVal = num(Xc);
  const hVal = num(height);
  const hr = heightRange(heightUnit);

  const errors: string[] = [];
  if (R !== "" && (rVal === null || rVal <= 0)) errors.push("Resistance must be a positive number.");
  if (Xc !== "" && (xcVal === null || xcVal <= 0)) errors.push("Reactance must be a positive number.");
  if (height !== "" && (hVal === null || hVal < hr.min || hVal > hr.max))
    errors.push(`Height must be between ${hr.min} and ${hr.max} ${heightUnit}.`);
  if (ref.r <= -1 || ref.r >= 1) errors.push("Correlation r must be between -1 and 1.");
  if (ref.sdRH <= 0 || ref.sdXcH <= 0) errors.push("Standard deviations must be positive.");

  const complete =
    rVal !== null &&
    rVal > 0 &&
    xcVal !== null &&
    xcVal > 0 &&
    hVal !== null &&
    hVal >= hr.min &&
    hVal <= hr.max &&
    ref.sdRH > 0 &&
    ref.sdXcH > 0 &&
    Math.abs(ref.r) < 1;

  const result = useMemo(() => {
    if (!complete || rVal === null || xcVal === null || hVal === null) return null;
    const hMeters = heightUnit === "cm" ? hVal / 100 : hVal;
    const point: Vector = { rh: rVal / hMeters, xch: xcVal / hMeters };
    const distance = mahalanobis(point, ref);
    return {
      point,
      hMeters,
      phase: phaseAngleDeg(rVal, xcVal),
      distance,
      zone: classify(distance),
      interpretation: interpret(point, ref),
    };
  }, [complete, rVal, xcVal, hVal, heightUnit, ref]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>BIVA R-Xc Graph</h1>
        <p className="subtitle">
          Bioelectrical Impedance Vector Analysis — plots the height-normalised impedance vector
          against 50 / 75 / 95% tolerance ellipses.
        </p>
        <button className="btn print-btn no-print" onClick={() => window.print()}>
          🖨 Print / Save as PDF
        </button>
      </header>

      <main className="layout">
        {/* ---------------- Inputs ---------------- */}
        <section className="panel inputs no-print" aria-label="Inputs">
          <h2>Patient measurement</h2>
          <div className="grid">
            <label>
              Resistance R (Ω)
              <input inputMode="decimal" value={R} onChange={(e) => setR(e.target.value)} placeholder="e.g. 500" />
            </label>
            <label>
              Reactance Xc (Ω)
              <input inputMode="decimal" value={Xc} onChange={(e) => setXc(e.target.value)} placeholder="e.g. 55" />
            </label>
            <label>
              Height
              <input
                inputMode="decimal"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder={heightUnit === "cm" ? "e.g. 175" : "e.g. 1.75"}
              />
            </label>
            <label>
              Unit
              <select value={heightUnit} onChange={(e) => setHeightUnit(e.target.value as HeightUnit)}>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </label>
            <label>
              Sex
              <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
          </div>

          <h2>Reference population</h2>
          <label className="full">
            Reference dataset
            <select value={setId} onChange={(e) => setSetId(e.target.value)}>
              {REFERENCE_SETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <p className="source-note">
            <strong>Source:</strong> {refSet.citation}{" "}
            <a href={refSet.url} target="_blank" rel="noreferrer">
              doi:{refSet.doi}
            </a>
            <br />
            <span className="muted">
              {refSet.population}. Values assume: {refSet.device}.
            </span>
          </p>

          <div className="ref-grid">
            {REF_FIELDS.map((f) => (
              <label key={f.key}>
                {f.label} {f.unit && <span className="unit">({f.unit})</span>}
                <input
                  inputMode="decimal"
                  step={f.step}
                  value={String(ref[f.key])}
                  onChange={(e) => updateRef(f.key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="ref-actions">
            <span className={isEdited ? "edited-tag" : "muted small"}>
              {isEdited ? "Edited — differs from published values" : `Published values (n=${published.n})`}
            </span>
            {isEdited && (
              <button className="btn-link" onClick={resetRef}>
                Reset to study values
              </button>
            )}
          </div>

          <p className="caveat">
            ⚠ The reference set must match your BIA device and protocol. Raw Xc and phase angle differ
            between device brands and between supine and standing analyzers — a vector compared to the
            wrong reference is misleading. To use another population (pediatric, athletic, pathological),
            read the five parameters off the matching figure in{" "}
            <a href={COMPILATION_REFERENCE.url} target="_blank" rel="noreferrer">
              Serafini et al. 2025
            </a>{" "}
            and type them in above.
          </p>

          {errors.length > 0 && (
            <ul className="errors">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------- Output ---------------- */}
        <section className="panel output" aria-label="Result">
          <RxcPlot ref95={ref} point={result?.point ?? null} sexLabel={sex} />

          {result ? (
            <div className="results">
              <div className="result-grid">
                <Metric label="R/H" value={`${result.point.rh.toFixed(1)} Ω/m`} />
                <Metric label="Xc/H" value={`${result.point.xch.toFixed(1)} Ω/m`} />
                <Metric label="Phase angle" value={`${result.phase.toFixed(1)}°`} />
                <Metric label="Mahalanobis D" value={result.distance.toFixed(2)} />
              </div>
              <p className="zone">
                <span className={`zone-badge zone-${result.zone}`}>{ZONE_LABEL[result.zone]}</span>
              </p>
              <p className="interpretation">{result.interpretation.text}</p>
              <p className="print-meta">
                Reference: {refSet.label}
                {isEdited ? " (values edited)" : ""} · Sex: {sex} · Height:{" "}
                {height || "—"} {heightUnit}
              </p>
            </div>
          ) : (
            <p className="placeholder">
              Enter resistance, reactance and height to plot the patient vector.
            </p>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <p>
          BIVA is a qualitative method: it plots the raw, height-normalised impedance vector and does
          not estimate body fat or muscle mass. This tool is a calculation/plotting aid, not a
          diagnostic device. Interpretation is the clinician's responsibility.
        </p>
      </footer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}
