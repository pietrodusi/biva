/**
 * Firebase bootstrap (Phase 0).
 *
 * Initialises the Firebase app and exports the Auth + Firestore handles the
 * rest of the app uses. Config comes from build-time env vars (VITE_FIREBASE_*);
 * for a web app these are NOT secrets — access is gated by Firebase Auth and
 * Firestore security rules, not by hiding the key. See `.env.example`.
 */
import { initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * True only when the build was given real Firebase config. Lets the auth gate
 * show a helpful message instead of crashing when env vars are missing (e.g. a
 * local build before `.env.local` exists).
 */
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Initialise only when configured so an unconfigured build never throws at
// import time — the gate renders the "not configured" screen instead. Downstream
// code reads `auth`/`db` only after checking `firebaseConfigured`, so the cast is
// safe: they are never touched while undefined.
const app = firebaseConfigured ? initializeApp(firebaseConfig) : undefined;

export const auth = (app ? getAuth(app) : undefined) as Auth;
export const db = (app ? getFirestore(app) : undefined) as Firestore;
