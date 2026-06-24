import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import { auth } from "./firebaseAuth";
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
