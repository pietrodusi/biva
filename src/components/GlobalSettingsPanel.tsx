import { useState, type Dispatch, type SetStateAction } from "react";
import {
  COMPILATION_REFERENCE,
  DEFAULT_SET_ID,
  getReferenceSet,
  overrideKey,
  publishedParams,
  REFERENCE_SETS,
  type Sex,
} from "../references";
import type { RefParams } from "../biva";
import type { ReferenceOverrides, SaveStatus } from "../data";
import { num } from "../util";

const REF_FIELDS: Array<{ key: keyof RefParams; label: string; unit: string; step: number }> = [
  { key: "meanRH", label: "media R/H", unit: "Ω/m", step: 0.1 },
  { key: "meanXcH", label: "media Xc/H", unit: "Ω/m", step: 0.1 },
  { key: "sdRH", label: "DS R/H", unit: "Ω/m", step: 0.1 },
  { key: "sdXcH", label: "DS Xc/H", unit: "Ω/m", step: 0.1 },
  { key: "r", label: "correlazione r", unit: "", step: 0.01 },
];

interface Props {
  overrides: ReferenceOverrides;
  setOverrides: Dispatch<SetStateAction<ReferenceOverrides>>;
  saveStatus: SaveStatus;
  onClose: () => void;
}

/**
 * Account-wide device tuning. The five reference-ellipse parameters depend on
 * the BIA device/protocol, so they are edited once here (per dataset + sex) and
 * persisted globally — patients then just pick which dataset applies to them.
 */
export function GlobalSettingsPanel({ overrides, setOverrides, saveStatus, onClose }: Props) {
  const [setId, setSetId] = useState<string>(DEFAULT_SET_ID);
  const [sex, setSex] = useState<Sex>("male");

  const refSet = getReferenceSet(setId);
  const key = overrideKey(setId, sex);
  const published = refSet.params[sex];
  const ref: RefParams = overrides[key] ?? publishedParams(setId, sex);
  const isEdited = key in overrides;

  const paramErrors: string[] = [];
  if (ref.sdRH <= 0 || ref.sdXcH <= 0)
    paramErrors.push("Le deviazioni standard devono essere positive.");
  if (ref.r <= -1 || ref.r >= 1) paramErrors.push("La correlazione r deve essere compresa tra -1 e 1.");

  const updateRef = (field: keyof RefParams, value: string) => {
    const v = num(value);
    setOverrides((prev) => ({ ...prev, [key]: { ...ref, [field]: v ?? 0 } }));
  };
  const resetRef = () =>
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  return (
    <section className="panel" aria-label="Impostazioni globali del dispositivo">
      <div className="panel-head">
        <h2>Parametri di riferimento (dispositivo)</h2>
        <button className="btn-link" onClick={onClose}>
          ← Torna
        </button>
      </div>

      <p className="muted small">
        Questi cinque parametri descrivono la popolazione di riferimento e dipendono dal dispositivo
        BIA. Vengono salvati a livello di account e usati per tutti i pazienti che adottano lo stesso
        dataset.
      </p>

      <div className="grid">
        <label>
          Dataset di riferimento
          <select value={setId} onChange={(e) => setSetId(e.target.value)}>
            {REFERENCE_SETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
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
          {isEdited
            ? "Modificato — differisce dai valori pubblicati"
            : `Valori pubblicati (n=${published.n})`}
        </span>
        {isEdited && (
          <button className="btn-link" onClick={resetRef}>
            Ripristina i valori dello studio
          </button>
        )}
      </div>
      {paramErrors.length > 0 && (
        <ul className="errors">
          {paramErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
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
        valori grezzi di Xc e l'angolo di fase variano tra le marche dei dispositivi e tra
        analizzatori in posizione supina e in piedi — un vettore confrontato con il riferimento
        sbagliato è fuorviante. Per usare un'altra popolazione (pediatrica, sportiva, patologica),
        leggi i cinque parametri dalla figura corrispondente in{" "}
        <a href={COMPILATION_REFERENCE.url} target="_blank" rel="noreferrer">
          Serafini et al. 2025
        </a>{" "}
        e inseriscili qui sopra.
      </p>
    </section>
  );
}
