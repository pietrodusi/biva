import { useMemo, useState } from "react";
import {
  classify,
  interpret,
  mahalanobis,
  phaseAngleDeg,
  ZONE_LABEL,
  type RefParams,
  type Vector,
} from "../biva";
import { getReferenceSet } from "../references";
import { RxcPlot } from "../RxcPlot";
import { createAnalysis, deleteAnalysis, useAnalyses, type Analysis, type Patient } from "../data";
import { formatDate, num, todayISO } from "../util";

interface Props {
  uid: string;
  patient: Patient;
  /** Reference params resolved for this patient (published or device-tuned). */
  ref95: RefParams;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * The per-patient workspace: record dated measurements, browse past visits, and
 * plot the selected visit's vector. Height/sex/reference come from the patient.
 */
export function PatientWorkspace({ uid, patient, ref95, onEdit, onDelete }: Props) {
  const { analyses } = useAnalyses(uid, patient.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // New-analysis form.
  const [date, setDate] = useState(todayISO());
  const [R, setR] = useState("");
  const [Xc, setXc] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const hMeters = patient.heightCm / 100;
  const refSet = getReferenceSet(patient.referenceSetId);

  // Selected visit: explicit pick, else the most recent (list is oldest-first).
  const selected: Analysis | null =
    analyses.find((a) => a.id === selectedId) ?? analyses[analyses.length - 1] ?? null;

  const rVal = num(R);
  const xcVal = num(Xc);
  const formErrors: string[] = [];
  if (R !== "" && (rVal === null || rVal <= 0)) formErrors.push("La resistenza deve essere un numero positivo.");
  if (Xc !== "" && (xcVal === null || xcVal <= 0)) formErrors.push("La reattanza deve essere un numero positivo.");
  const canSave = rVal !== null && rVal > 0 && xcVal !== null && xcVal > 0 && date !== "" && !saving;

  const save = async () => {
    if (!canSave || rVal === null || xcVal === null) return;
    setSaving(true);
    try {
      const id = await createAnalysis(uid, patient.id, {
        date,
        r: rVal,
        xc: xcVal,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSelectedId(id);
      setR("");
      setXc("");
      setNote("");
      setDate(todayISO());
    } finally {
      setSaving(false);
    }
  };

  const removeAnalysis = async (a: Analysis) => {
    if (!window.confirm(`Eliminare l'analisi del ${formatDate(a.date)}?`)) return;
    await deleteAnalysis(uid, patient.id, a.id);
    if (selectedId === a.id) setSelectedId(null);
  };

  const result = useMemo(() => {
    if (!selected) return null;
    const point: Vector = { rh: selected.r / hMeters, xch: selected.xc / hMeters };
    const distance = mahalanobis(point, ref95);
    return {
      point,
      phase: phaseAngleDeg(selected.r, selected.xc),
      distance,
      zone: classify(distance),
      interpretation: interpret(point, ref95),
    };
  }, [selected, hMeters, ref95]);

  return (
    <section className="panel output" aria-label="Analisi del paziente">
      <div className="panel-head">
        <div>
          <h2 className="patient-title">{patient.name}</h2>
          <p className="muted small patient-subtitle">
            {patient.sex === "male" ? "Uomo" : "Donna"} · {patient.heightCm} cm · {refSet.label}
          </p>
        </div>
        <div className="patient-actions no-print">
          <button className="btn-link" onClick={onEdit}>
            Modifica
          </button>
          <button className="btn-link btn-danger" onClick={onDelete}>
            Elimina
          </button>
        </div>
      </div>

      <div className="new-analysis no-print">
        <h3 className="subhead">Nuova analisi</h3>
        <div className="grid">
          <label>
            Data
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Resistenza R (Ω)
            <input inputMode="decimal" value={R} onChange={(e) => setR(e.target.value)} placeholder="es. 500" />
          </label>
          <label>
            Reattanza Xc (Ω)
            <input inputMode="decimal" value={Xc} onChange={(e) => setXc(e.target.value)} placeholder="es. 55" />
          </label>
          <label className="full">
            Nota (facoltativa)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. a digiuno" />
          </label>
        </div>
        {formErrors.length > 0 && (
          <ul className="errors">
            {formErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="form-actions">
          <button className="btn" disabled={!canSave} onClick={() => void save()}>
            {saving ? "Salvataggio…" : "Salva analisi"}
          </button>
        </div>
      </div>

      {analyses.length > 0 && (
        <div className="visit-list no-print">
          <h3 className="subhead">Analisi registrate</h3>
          <ul>
            {[...analyses].reverse().map((a) => (
              <li key={a.id} className={a.id === selected?.id ? "active" : ""}>
                <button className="visit-item" onClick={() => setSelectedId(a.id)}>
                  <span className="visit-date">{formatDate(a.date)}</span>
                  <span className="muted small">
                    R {a.r} · Xc {a.xc}
                    {a.note ? ` · ${a.note}` : ""}
                  </span>
                </button>
                <button
                  className="btn-link btn-danger visit-del"
                  title="Elimina"
                  onClick={() => void removeAnalysis(a)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RxcPlot ref95={ref95} point={result?.point ?? null} sexLabel={patient.sex} />

      {result && selected ? (
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
            {patient.name} · {patient.sex === "male" ? "Uomo" : "Donna"} · {patient.heightCm} cm · Data:{" "}
            {formatDate(selected.date)} · Riferimento: {refSet.label}
          </p>
        </div>
      ) : (
        <p className="placeholder">Aggiungi un'analisi per tracciare il vettore.</p>
      )}
    </section>
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
