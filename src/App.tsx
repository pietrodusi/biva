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
import { useAuth } from "./auth";
import { useGlobalSettings } from "./data";
import "./styles.css";

type HeightUnit = "cm" | "m";

const REF_FIELDS: Array<{ key: keyof RefParams; label: string; unit: string; step: number }> = [
  { key: "meanRH", label: "media R/H", unit: "Ω/m", step: 0.1 },
  { key: "meanXcH", label: "media Xc/H", unit: "Ω/m", step: 0.1 },
  { key: "sdRH", label: "DS R/H", unit: "Ω/m", step: 0.1 },
  { key: "sdXcH", label: "DS Xc/H", unit: "Ω/m", step: 0.1 },
  { key: "r", label: "correlazione r", unit: "", step: 0.01 },
];

// Plausible-input guards.
const heightRange = (u: HeightUnit) => (u === "cm" ? { min: 50, max: 250 } : { min: 0.5, max: 2.5 });

function num(s: string): number | null {
  if (s.trim() === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export default function App() {
  const { user, signOutUser } = useAuth();

  const [sex, setSex] = useState<Sex>("male");
  const [setId, setSetId] = useState<string>(DEFAULT_SET_ID);

  const [R, setR] = useState("");
  const [Xc, setXc] = useState("");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");

  // Per (dataset, sex) overrides of the published reference values, persisted to
  // the account (global device tuning). Editing a field stores an override;
  // "Reset to study values" clears it. Saved automatically (debounced).
  const { overrides, setOverrides, saveStatus } = useGlobalSettings(user?.uid);

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
  if (R !== "" && (rVal === null || rVal <= 0)) errors.push("La resistenza deve essere un numero positivo.");
  if (Xc !== "" && (xcVal === null || xcVal <= 0)) errors.push("La reattanza deve essere un numero positivo.");
  if (height !== "" && (hVal === null || hVal < hr.min || hVal > hr.max))
    errors.push(`L'altezza deve essere compresa tra ${hr.min} e ${hr.max} ${heightUnit}.`);
  if (ref.r <= -1 || ref.r >= 1) errors.push("La correlazione r deve essere compresa tra -1 e 1.");
  if (ref.sdRH <= 0 || ref.sdXcH <= 0) errors.push("Le deviazioni standard devono essere positive.");

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
      <div className="account-bar no-print">
        <span className="account-user">{user?.email}</span>
        <button className="btn-link" onClick={() => void signOutUser()}>
          Esci
        </button>
      </div>

      <header className="app-header">
        <h1>Grafico R-Xc BIVA</h1>
        <p className="subtitle">
          Analisi vettoriale dell'impedenza bioelettrica — traccia il vettore di impedenza
          normalizzato per l'altezza rispetto alle ellissi di tolleranza del 50 / 75 / 95%.
        </p>
        <button className="btn print-btn no-print" onClick={() => window.print()}>
          🖨 Stampa / Salva come PDF
        </button>
      </header>

      <main className="layout">
        {/* ---------------- Inputs ---------------- */}
        <section className="panel inputs no-print" aria-label="Dati inseriti">
          <h2>Misurazione del paziente</h2>
          <div className="grid">
            <label>
              Resistenza R (Ω)
              <input inputMode="decimal" value={R} onChange={(e) => setR(e.target.value)} placeholder="es. 500" />
            </label>
            <label>
              Reattanza Xc (Ω)
              <input inputMode="decimal" value={Xc} onChange={(e) => setXc(e.target.value)} placeholder="es. 55" />
            </label>
            <label>
              Altezza
              <input
                inputMode="decimal"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder={heightUnit === "cm" ? "es. 175" : "es. 1.75"}
              />
            </label>
            <label>
              Unità
              <select value={heightUnit} onChange={(e) => setHeightUnit(e.target.value as HeightUnit)}>
                <option value="cm">cm</option>
                <option value="m">m</option>
              </select>
            </label>
            <label>
              Sesso
              <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                <option value="male">Uomo</option>
                <option value="female">Donna</option>
              </select>
            </label>
          </div>

          <h2>Popolazione di riferimento</h2>
          <label className="full">
            Dataset di riferimento
            <select value={setId} onChange={(e) => setSetId(e.target.value)}>
              {REFERENCE_SETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <p className="source-note">
            <strong>Fonte:</strong> {refSet.citation}{" "}
            <a href={refSet.url} target="_blank" rel="noreferrer">
              doi:{refSet.doi}
            </a>
            <br />
            <span className="muted">
              {refSet.population}. I valori presuppongono: {refSet.device}.
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
              {isEdited ? "Modificato — differisce dai valori pubblicati" : `Valori pubblicati (n=${published.n})`}
            </span>
            {isEdited && (
              <button className="btn-link" onClick={resetRef}>
                Ripristina i valori dello studio
              </button>
            )}
          </div>
          <p className={`save-status small ${saveStatus === "error" ? "save-error" : "muted"}`}>
            {saveStatus === "saving"
              ? "Salvataggio…"
              : saveStatus === "saved"
                ? "✓ Salvato nel tuo account"
                : saveStatus === "error"
                  ? "⚠ Salvataggio non riuscito — riprova"
                  : "I parametri sono salvati automaticamente nel tuo account."}
          </p>

          <p className="caveat">
            ⚠ Il set di riferimento deve corrispondere al dispositivo e al protocollo BIA utilizzati. I
            valori grezzi di Xc e l'angolo di fase variano tra le marche dei dispositivi e tra analizzatori
            in posizione supina e in piedi — un vettore confrontato con il riferimento sbagliato è
            fuorviante. Per usare un'altra popolazione (pediatrica, sportiva, patologica), leggi i cinque
            parametri dalla figura corrispondente in{" "}
            <a href={COMPILATION_REFERENCE.url} target="_blank" rel="noreferrer">
              Serafini et al. 2025
            </a>{" "}
            e inseriscili qui sopra.
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
        <section className="panel output" aria-label="Risultato">
          <RxcPlot ref95={ref} point={result?.point ?? null} sexLabel={sex} />

          {result ? (
            <div className="results">
              <div className="result-grid">
                <Metric label="R/H" value={`${result.point.rh.toFixed(1)} Ω/m`} />
                <Metric label="Xc/H" value={`${result.point.xch.toFixed(1)} Ω/m`} />
                <Metric label="Angolo di fase" value={`${result.phase.toFixed(1)}°`} />
                <Metric label="D di Mahalanobis" value={result.distance.toFixed(2)} />
              </div>
              <p className="zone">
                <span className={`zone-badge zone-${result.zone}`}>{ZONE_LABEL[result.zone]}</span>
              </p>
              <p className="interpretation">{result.interpretation.text}</p>
              <p className="print-meta">
                Riferimento: {refSet.label}
                {isEdited ? " (valori modificati)" : ""} · Sesso: {sex === "male" ? "Uomo" : "Donna"} · Altezza:{" "}
                {height || "—"} {heightUnit}
              </p>
            </div>
          ) : (
            <p className="placeholder">
              Inserisci resistenza, reattanza e altezza per tracciare il vettore del paziente.
            </p>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <p>
          La BIVA è un metodo qualitativo: traccia il vettore di impedenza grezzo, normalizzato per
          l'altezza, e non stima la massa grassa o la massa muscolare. Questo strumento è un ausilio al
          calcolo e alla rappresentazione grafica, non un dispositivo diagnostico. L'interpretazione è
          responsabilità del clinico.
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
