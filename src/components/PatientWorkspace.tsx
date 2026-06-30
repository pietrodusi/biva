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
import type { Patient } from "../data";
import { num } from "../util";

interface Props {
  patient: Patient;
  /** Reference params resolved for this patient (published or device-tuned). */
  ref95: RefParams;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * The per-patient workspace. Height/sex/reference come from the patient record;
 * the measurement (R, Xc) is entered here. (Persisted dated analyses arrive in
 * Phase 3 — for now the calculation is transient.)
 */
export function PatientWorkspace({ patient, ref95, onEdit, onDelete }: Props) {
  const [R, setR] = useState("");
  const [Xc, setXc] = useState("");

  const rVal = num(R);
  const xcVal = num(Xc);
  const hMeters = patient.heightCm / 100;
  const refSet = getReferenceSet(patient.referenceSetId);

  const errors: string[] = [];
  if (R !== "" && (rVal === null || rVal <= 0)) errors.push("La resistenza deve essere un numero positivo.");
  if (Xc !== "" && (xcVal === null || xcVal <= 0)) errors.push("La reattanza deve essere un numero positivo.");

  const complete = rVal !== null && rVal > 0 && xcVal !== null && xcVal > 0;

  const result = useMemo(() => {
    if (!complete || rVal === null || xcVal === null) return null;
    const point: Vector = { rh: rVal / hMeters, xch: xcVal / hMeters };
    const distance = mahalanobis(point, ref95);
    return {
      point,
      phase: phaseAngleDeg(rVal, xcVal),
      distance,
      zone: classify(distance),
      interpretation: interpret(point, ref95),
    };
  }, [complete, rVal, xcVal, hMeters, ref95]);

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

      <div className="grid measurement-inputs no-print">
        <label>
          Resistenza R (Ω)
          <input inputMode="decimal" value={R} onChange={(e) => setR(e.target.value)} placeholder="es. 500" />
        </label>
        <label>
          Reattanza Xc (Ω)
          <input inputMode="decimal" value={Xc} onChange={(e) => setXc(e.target.value)} placeholder="es. 55" />
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="errors no-print">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <RxcPlot ref95={ref95} point={result?.point ?? null} sexLabel={patient.sex} />

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
            {patient.name} · {patient.sex === "male" ? "Uomo" : "Donna"} · {patient.heightCm} cm ·{" "}
            Riferimento: {refSet.label}
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
