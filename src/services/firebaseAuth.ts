import { getAuth, type Auth } from "firebase/auth";
import { getFirebaseApp, hasFirebaseConfig } from "./firebaseApp";

export const auth: Auth | null = hasFirebaseConfig ? getAuth(getFirebaseApp()) : null;

export const isFirebaseConfigured = hasFirebaseConfig;
