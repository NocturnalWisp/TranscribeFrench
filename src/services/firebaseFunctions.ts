import { getFunctions } from "firebase/functions";
import { getFirebaseApp } from "./firebaseApp";

const FUNCTIONS_REGION = "us-central1";

let functionsInstance: ReturnType<typeof getFunctions> | null = null;

export const getFirebaseFunctions = () => {
  if (!functionsInstance) {
    functionsInstance = getFunctions(getFirebaseApp(), FUNCTIONS_REGION);
  }

  return functionsInstance;
};
