/**
 * Auth gate (Phase 0).
 *
 * Renders the sign-in screen until a Google session exists, then shows the app.
 * Also surfaces a clear message when Firebase config is missing from the build.
 */
import { useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { firebaseConfigured } from "./firebase";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const doSignIn = async () => {
    setError(null);
    try {
      await signIn();
    } catch (e) {
      // Closing or double-triggering the popup is benign — ignore those.
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError("Accesso non riuscito. Riprova.");
      }
    }
  };

  if (!firebaseConfigured) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Grafico R-Xc BIVA</h1>
          <p className="auth-error">
            Firebase non è configurato. Imposta le variabili d'ambiente{" "}
            <code>VITE_FIREBASE_*</code> (vedi <code>.env.example</code>) e riavvia.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="muted">Caricamento…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Grafico R-Xc BIVA</h1>
          <p className="subtitle">Accedi per gestire i pazienti e le loro analisi.</p>
          <button className="btn" onClick={() => void doSignIn()}>
            Accedi con Google
          </button>
          {error && <p className="auth-error">{error}</p>}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
