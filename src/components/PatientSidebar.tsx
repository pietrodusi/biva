import type { Patient } from "../data";

interface Props {
  patients: Patient[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onOpenSettings: () => void;
}

export function PatientSidebar({
  patients,
  loading,
  selectedId,
  onSelect,
  onNew,
  onOpenSettings,
}: Props) {
  return (
    <aside className="sidebar no-print" aria-label="Pazienti">
      <div className="sidebar-head">
        <h2>Pazienti</h2>
        <button className="btn" onClick={onNew}>
          + Nuovo
        </button>
      </div>

      {loading ? (
        <p className="muted small">Caricamento…</p>
      ) : patients.length === 0 ? (
        <p className="muted small">Nessun paziente. Creane uno per iniziare.</p>
      ) : (
        <ul className="patient-list">
          {patients.map((p) => (
            <li key={p.id}>
              <button
                className={`patient-item ${p.id === selectedId ? "active" : ""}`}
                onClick={() => onSelect(p.id)}
              >
                <span className="patient-name">{p.name}</span>
                <span className="patient-meta">
                  {p.sex === "male" ? "Uomo" : "Donna"} · {p.heightCm} cm
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="btn-link settings-link" onClick={onOpenSettings}>
        ⚙ Parametri dispositivo
      </button>
    </aside>
  );
}
