/**
 * Firestore data layer (Phase 1).
 *
 * Persists the per-account "global settings": the device-tuned reference-ellipse
 * parameter overrides, keyed `"<datasetId>:<sex>"` (the same key App.tsx already
 * used in memory). Lives at `users/{uid}/settings/global`.
 *
 * React-free helpers (load/save) stay testable; the `useGlobalSettings` hook
 * wires them to component state with debounced write-through.
 */
import { useEffect, useRef, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { RefParams } from "./biva";

export type ReferenceOverrides = Record<string, RefParams>;

const globalSettingsRef = (uid: string) => doc(db, "users", uid, "settings", "global");

/** Read the saved reference-param overrides for an account ({} if none yet). */
export async function loadReferenceOverrides(uid: string): Promise<ReferenceOverrides> {
  const snap = await getDoc(globalSettingsRef(uid));
  return (snap.data()?.referenceOverrides as ReferenceOverrides) ?? {};
}

/**
 * Persist the full overrides map. The global doc is owned entirely by this
 * model for now, so we overwrite it wholesale — this is what lets a "reset"
 * (a removed key) actually delete server-side, which a deep merge would not.
 * Revisit (to a merge + deleteField approach) if the doc gains other fields.
 */
export async function saveReferenceOverrides(
  uid: string,
  overrides: ReferenceOverrides,
): Promise<void> {
  await setDoc(globalSettingsRef(uid), {
    referenceOverrides: overrides,
    updatedAt: serverTimestamp(),
  });
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface GlobalSettings {
  overrides: ReferenceOverrides;
  setOverrides: React.Dispatch<React.SetStateAction<ReferenceOverrides>>;
  loading: boolean;
  saveStatus: SaveStatus;
}

/**
 * Load the account's overrides once on sign-in, expose them as local state, and
 * write changes back to Firestore (debounced). Single-device assumption — we
 * load once rather than live-subscribe; multi-device live sync can be added with
 * onSnapshot later.
 */
export function useGlobalSettings(uid: string | undefined): GlobalSettings {
  const [overrides, setOverrides] = useState<ReferenceOverrides>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Guards: only persist after the initial load, and skip writing values we
  // already have on the server (so the load itself doesn't trigger a write).
  const loaded = useRef(false);
  const lastSynced = useRef("");

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    loaded.current = false;
    setLoading(true);
    loadReferenceOverrides(uid)
      .then((o) => {
        if (cancelled) return;
        setOverrides(o);
        lastSynced.current = JSON.stringify(o);
      })
      .catch((e) => {
        console.error("Failed to load global settings:", e);
      })
      .finally(() => {
        if (cancelled) return;
        loaded.current = true;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || !loaded.current) return;
    const json = JSON.stringify(overrides);
    if (json === lastSynced.current) return;
    setSaveStatus("saving");
    const t = setTimeout(() => {
      saveReferenceOverrides(uid, overrides)
        .then(() => {
          lastSynced.current = json;
          setSaveStatus("saved");
        })
        .catch((e) => {
          console.error("Failed to save global settings:", e);
          setSaveStatus("error");
        });
    }, 500);
    return () => clearTimeout(t);
  }, [uid, overrides]);

  return { overrides, setOverrides, loading, saveStatus };
}
