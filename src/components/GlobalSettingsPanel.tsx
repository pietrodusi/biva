import { useState, type Dispatch, type SetStateAction } from "react";
import {
  COMPILATION_REFERENCE,
  getReferenceSet,
  overrideKey,
  publishedParams,
  REFERENCE_SETS,
  type ReferenceSet,
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
 * the BIA device/protocol, so they are tuned here (once per account) for each
 * published dataset + sex. The dataset itself is chosen per patient, not here.
 */
export function GlobalSettingsPanel({ overrides, setOverrides, saveStatus, onClose }: Props) {
  const [sex, setSex] = useState<Sex>("male");

  return (
    <section className="panel" aria-label="Impostazioni globali del dispositivo">
      <div className="panel-head">
        <h2>Parametri di riferimento (dispositivo)</h2>
        <button className="btn-link" onClick={onClose}>
          ← Torna
        </button>
      </div>

      <p className="muted small">
        Questi parametri descrivono le popolazioni di riferimento e dipendono dal dispositivo BIA.
        Vengono salvati a livello di account. Il dataset da usare si sceglie per ogni singolo
        paziente.
      </p>

      <label className="full">
        Sesso
        <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
          <option value="male">Uomo</option>
          <option value="female">Donna</option>
        </select>
      </label>

      {REFERENCE_SETS.map((set) => (
        <DatasetParams
          key={set.id}
          set={set}
          sex={sex}
          overrides={overrides}
          setOverrides={setOverrides}
        />
      ))}

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
        e inseriscili qui.
      </p>
    </section>
  );
}

interface DatasetProps {
  set: ReferenceSet;
  sex: Sex;
  overrides: ReferenceOverrides;
  setOverrides: Dispatch<SetStateAction<ReferenceOverrides>>;
}

/** The five editable params for one dataset + sex, with reset + validation. */
function DatasetParams({ set, sex, overrides, setOverrides }: DatasetProps) {
  const key = overrideKey(set.id, sex);
  const published = getReferenceSet(set.id).params[sex];
  const ref: RefParams = overrides[key] ?? publishedParams(set.id, sex);
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
    <div className="dataset-block">
      <h3 className="subhead">{set.label}</h3>
      <p className="source-note">
        <strong>Fonte:</strong> {set.citation}{" "}
        <a href={set.url} target="_blank" rel="noreferrer">
          doi:{set.doi}
        </a>
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
    </div>
  );
}
