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
import {
  createAnalysis,
  deleteAnalysis,
  updateAnalysis,
  useAnalyses,
  type Analysis,
  type Patient,
} from "../data";
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
 * The per-patient workspace. The form edits one analysis at a time: clicking a
 * recorded analysis loads it for editing; "Nuova analisi" starts a fresh one.
 * Height/sex/reference come from the patient record.
 */
export function PatientWorkspace({ uid, patient, ref95, onEdit, onDelete }: Props) {
  const { analyses } = useAnalyses(uid, patient.id);
  const [view, setView] = useState<"visit" | "history">("visit");

  // The analysis currently loaded in the form: an existing id, or null for a new
  // (unsaved) one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [R, setR] = useState("");
  const [Xc, setXc] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const hMeters = patient.heightCm / 100;
  const refSet = getReferenceSet(patient.referenceSetId);

  const loadAnalysis = (a: Analysis) => {
    setEditingId(a.id);
    setDate(a.date);
    setR(String(a.r));
    setXc(String(a.xc));
    setNote(a.note ?? "");
    setView("visit");
  };

  const newAnalysis = () => {
    setEditingId(null);
    setDate(todayISO());
    setR("");
    setXc("");
    setNote("");
    setView("visit");
  };

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
      const data = { date, r: rVal, xc: xcVal, note: note.trim() };
      if (editingId) {
        await updateAnalysis(uid, patient.id, editingId, data);
      } else {
        const id = await createAnalysis(uid, patient.id, data);
        setEditingId(id);
      }
    } finally {
      setSaving(false);
    }
  };

  const removeAnalysis = async (a: Analysis) => {
    if (!window.confirm(`Eliminare l'analisi del ${formatDate(a.date)}?`)) return;
    await deleteAnalysis(uid, patient.id, a.id);
    if (editingId === a.id) newAnalysis();
  };

  const historyPoints = useMemo(
    () =>
      analyses.map((a) => ({
        rh: a.r / hMeters,
        xch: a.xc / hMeters,
        label: formatDate(a.date),
      })),
    [analyses, hMeters],
  );
  const canShowHistory = analyses.length >= 2;

  // The plot/metrics describe the current form entry (live), in "this visit".
  const liveValid = rVal !== null && rVal > 0 && xcVal !== null && xcVal > 0;
  const displayMeasure = liveValid
    ? {
        r: rVal as number,
        xc: xcVal as number,
        dateLabel: editingId ? formatDate(date) : `${formatDate(date)} (non salvata)`,
      }
    : null;

  const result = useMemo(() => {
    if (!displayMeasure) return null;
    const point: Vector = { rh: displayMeasure.r / hMeters, xch: displayMeasure.xc / hMeters };
    const distance = mahalanobis(point, ref95);
    return {
      point,
      phase: phaseAngleDeg(displayMeasure.r, displayMeasure.xc),
      distance,
      zone: classify(distance),
      interpretation: interpret(point, ref95),
      dateLabel: displayMeasure.dateLabel,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMeasure?.r, displayMeasure?.xc, displayMeasure?.dateLabel, hMeters, ref95]);

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
        <div className="subhead-row">
          <h3 className="subhead">{editingId ? "Modifica analisi" : "Nuova analisi"}</h3>
          <button className="btn-link" onClick={newAnalysis}>
            + Nuova analisi
          </button>
        </div>
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
            {saving ? "Salvataggio…" : editingId ? "Aggiorna analisi" : "Salva analisi"}
          </button>
        </div>
      </div>

      {analyses.length > 0 && (
        <details className="visit-list no-print">
          <summary className="subhead">Analisi registrate ({analyses.length})</summary>
          <ul>
            {[...analyses].reverse().map((a) => (
              <li key={a.id} className={a.id === editingId ? "active" : ""}>
                <button className="visit-item" onClick={() => loadAnalysis(a)}>
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
        </details>
      )}

      <div className="tabs no-print">
        <button
          className={`tab ${view === "visit" ? "active" : ""}`}
          onClick={() => setView("visit")}
        >
          Questa visita
        </button>
        <button
          className={`tab ${view === "history" ? "active" : ""}`}
          onClick={() => setView("history")}
          disabled={!canShowHistory}
          title={canShowHistory ? undefined : "Servono almeno due analisi"}
        >
          Andamento
        </button>
      </div>

      {view === "history" && canShowHistory ? (
        <>
          <p className="muted small trend-caption">
            {analyses.length} analisi, dalla meno recente (chiara) alla più recente (piena). Passa il
            mouse su un punto per vederne la data.
          </p>
          <RxcPlot ref95={ref95} points={historyPoints} sexLabel={patient.sex} />
        </>
      ) : (
        <RxcPlot ref95={ref95} point={result?.point ?? null} sexLabel={patient.sex} />
      )}

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
            {patient.name} · {patient.sex === "male" ? "Uomo" : "Donna"} · {patient.heightCm} cm · Data:{" "}
            {result.dateLabel} · Riferimento: {refSet.label}
          </p>
        </div>
      ) : (
        <p className="placeholder">Inserisci resistenza e reattanza per tracciare il vettore.</p>
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
