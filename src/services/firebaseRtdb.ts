import { getDatabase, type Database } from "firebase/database";
import { getFirebaseApp, isRealtimeDatabaseConfigured } from "./firebaseApp";

export const rtdb: Database | null = isRealtimeDatabaseConfigured
  ? getDatabase(getFirebaseApp())
  : null;
