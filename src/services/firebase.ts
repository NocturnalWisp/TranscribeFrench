import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

const hasFirebaseConfig = Object.values({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId
}).every(Boolean);

const hasRealtimeDatabase = hasFirebaseConfig && Boolean(firebaseConfig.databaseURL);

let app: FirebaseApp | null = null;

const getApp = (): FirebaseApp => {
  if (!hasFirebaseConfig) {
    throw new Error("Firebase is not configured.");
  }

  if (!app) {
    app = initializeApp(firebaseConfig);
  }

  return app;
};

export const auth: Auth | null = hasFirebaseConfig ? getAuth(getApp()) : null;
export const rtdb: Database | null = hasRealtimeDatabase ? getDatabase(getApp()) : null;
export const db: Firestore | null = hasFirebaseConfig ? getFirestore(getApp()) : null;

export const isFirebaseConfigured = hasFirebaseConfig;
export const isRealtimeDatabaseConfigured = hasRealtimeDatabase;
