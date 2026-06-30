import { useState } from "react";
import { REFERENCE_SETS, type Sex } from "../references";
import type { Patient, PatientData } from "../data";
import { heightRange, num, type HeightUnit } from "../util";

interface Props {
  /** Patient being edited, or null to create a new one. */
  patient: Patient | null;
  onSave: (data: PatientData) => Promise<void> | void;
  onCancel: () => void;
}

export function PatientForm({ patient, onSave, onCancel }: Props) {
  const [name, setName] = useState(patient?.name ?? "");
  const [sex, setSex] = useState<Sex>(patient?.sex ?? "male");
  // Heights are stored in cm; the form edits in cm for simplicity.
  const [height, setHeight] = useState(patient ? String(patient.heightCm) : "");
  const [referenceSetId, setReferenceSetId] = useState(
    patient?.referenceSetId ?? REFERENCE_SETS[0].id,
  );
  const [saving, setSaving] = useState(false);

  const unit: HeightUnit = "cm";
  const hr = heightRange(unit);
  const hVal = num(height);

  const errors: string[] = [];
  if (name.trim() === "") errors.push("Il nome è obbligatorio.");
  if (hVal === null || hVal < hr.min || hVal > hr.max)
    errors.push(`L'altezza deve essere compresa tra ${hr.min} e ${hr.max} cm.`);

  const canSave = errors.length === 0 && !saving;

  const submit = async () => {
    if (!canSave || hVal === null) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), sex, heightCm: hVal, referenceSetId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel" aria-label={patient ? "Modifica paziente" : "Nuovo paziente"}>
      <div className="panel-head">
        <h2>{patient ? "Modifica paziente" : "Nuovo paziente"}</h2>
        <button className="btn-link" onClick={onCancel}>
          ← Annulla
        </button>
      </div>

      <div className="grid">
        <label className="full">
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e cognome" />
        </label>
        <label>
          Sesso
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
            <option value="male">Uomo</option>
            <option value="female">Donna</option>
          </select>
        </label>
        <label>
          Altezza (cm)
          <input
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="es. 175"
          />
        </label>
        <label className="full">
          Dataset di riferimento
          <select value={referenceSetId} onChange={(e) => setReferenceSetId(e.target.value)}>
            {REFERENCE_SETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        <button className="btn" onClick={() => void submit()} disabled={!canSave}>
          {saving ? "Salvataggio…" : patient ? "Salva modifiche" : "Crea paziente"}
        </button>
      </div>
    </section>
  );
}
