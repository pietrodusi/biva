import { useEffect, useRef, useState } from "react";
import type { Patient } from "../data";

interface Props {
  patients: Patient[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

/** Centered, searchable patient dropdown for the header. */
export function PatientPicker({ patients, loading, selectedId, onSelect, onNew }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = patients.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? patients.filter((p) => p.name.toLowerCase().includes(q)) : patients;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="patient-picker" ref={rootRef}>
      <button
        className="picker-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "picker-label" : "picker-label picker-placeholder"}>
          {selected ? selected.name : "Seleziona paziente"}
        </span>
        <span className="picker-caret">▾</span>
      </button>

      {open && (
        <div className="picker-menu">
          <input
            ref={inputRef}
            className="picker-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca paziente…"
          />
          <ul className="picker-list">
            {loading ? (
              <li className="picker-empty muted small">Caricamento…</li>
            ) : filtered.length === 0 ? (
              <li className="picker-empty muted small">
                {patients.length === 0 ? "Nessun paziente" : "Nessun risultato"}
              </li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <button
                    className={`patient-item ${p.id === selectedId ? "active" : ""}`}
                    onClick={() => {
                      onSelect(p.id);
                      close();
                    }}
                  >
                    <span className="patient-name">{p.name}</span>
                    <span className="patient-meta">
                      {p.sex === "male" ? "Uomo" : "Donna"} · {p.heightCm} cm
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <button
            className="btn picker-new"
            onClick={() => {
              onNew();
              close();
            }}
          >
            + Nuovo paziente
          </button>
        </div>
      )}
    </div>
  );
}
