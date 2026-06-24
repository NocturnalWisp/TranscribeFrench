import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import { auth } from "./firebase";
import { ensureUserProfile } from "./users";

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<User> => {
  if (!auth) {
    throw new Error("Firebase Auth is not configured.");
  }

  const credential = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(credential.user);
  return credential.user;
};

export const signOutUser = async (): Promise<void> => {
  if (!auth) {
    return;
  }

  await signOut(auth);
};

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
