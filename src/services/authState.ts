import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebaseAuth";

export const subscribeToAuthState = (
  // eslint-disable-next-line no-unused-vars
  onChange: (user: User | null) => void
): (() => void) => {
  if (!auth) {
    onChange(null);
    return () => undefined;
  }

  return onAuthStateChanged(auth, onChange);
};
