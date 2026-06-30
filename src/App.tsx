import { useState } from "react";
import { overrideKey, publishedParams } from "./references";
import type { RefParams } from "./biva";
import { useAuth } from "./auth";
import {
  createPatient,
  deletePatient,
  updatePatient,
  useGlobalSettings,
  usePatients,
  type Patient,
  type PatientData,
} from "./data";
import { PatientSidebar } from "./components/PatientSidebar";
import { PatientForm } from "./components/PatientForm";
import { PatientWorkspace } from "./components/PatientWorkspace";
import { GlobalSettingsPanel } from "./components/GlobalSettingsPanel";
import "./styles.css";

export default function App() {
  const { user, signOutUser } = useAuth();
  const uid = user?.uid;

  const { overrides, setOverrides, saveStatus } = useGlobalSettings(uid);
  const { patients, loading: patientsLoading } = usePatients(uid);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // null = not editing; "new" = creating; a Patient = editing that one.
  const [editing, setEditing] = useState<Patient | "new" | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const selectedPatient = patients.find((p) => p.id === selectedId) ?? null;

  const patientRef = (p: Patient): RefParams =>
    overrides[overrideKey(p.referenceSetId, p.sex)] ?? publishedParams(p.referenceSetId, p.sex);

  const selectPatient = (id: string) => {
    setSelectedId(id);
    setEditing(null);
    setShowSettings(false);
  };

  const savePatient = async (data: PatientData) => {
    if (!uid) return;
    if (editing === "new") {
      const id = await createPatient(uid, data);
      setSelectedId(id);
    } else if (editing) {
      await updatePatient(uid, editing.id, data);
    }
    setEditing(null);
  };

  const removePatient = async (p: Patient) => {
    if (!uid) return;
    if (!window.confirm(`Eliminare ${p.name} e tutte le sue analisi? L'operazione è irreversibile.`)) {
      return;
    }
    await deletePatient(uid, p.id);
    if (selectedId === p.id) setSelectedId(null);
  };

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
        <PatientSidebar
          patients={patients}
          loading={patientsLoading}
          selectedId={selectedId}
          onSelect={selectPatient}
          onNew={() => {
            setEditing("new");
            setShowSettings(false);
          }}
          onOpenSettings={() => {
            setShowSettings(true);
            setEditing(null);
          }}
        />

        <div className="workspace">
          {showSettings ? (
            <GlobalSettingsPanel
              overrides={overrides}
              setOverrides={setOverrides}
              saveStatus={saveStatus}
              onClose={() => setShowSettings(false)}
            />
          ) : editing ? (
            <PatientForm
              patient={editing === "new" ? null : editing}
              onSave={savePatient}
              onCancel={() => setEditing(null)}
            />
          ) : selectedPatient && uid ? (
            <PatientWorkspace
              key={selectedPatient.id}
              uid={uid}
              patient={selectedPatient}
              ref95={patientRef(selectedPatient)}
              onEdit={() => setEditing(selectedPatient)}
              onDelete={() => void removePatient(selectedPatient)}
            />
          ) : (
            <section className="panel">
              <p className="placeholder">
                Seleziona un paziente dall'elenco oppure creane uno nuovo per iniziare.
              </p>
            </section>
          )}
        </div>
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
