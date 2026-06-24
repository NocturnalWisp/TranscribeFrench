import { get, ref, set, update } from "firebase/database";
import type { User } from "firebase/auth";
import type { UserProfile } from "../types/auth";
import { rtdb } from "./firebaseRtdb";

const userRef = (uid: string) => ref(rtdb!, `users/${uid}`);

export const ensureUserProfile = async (user: User): Promise<UserProfile> => {
  if (!rtdb) {
    throw new Error("Realtime Database is not configured.");
  }

  const snapshot = await get(userRef(user.uid));
  const now = Date.now();

  if (!snapshot.exists()) {
    const profile: UserProfile = {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: now,
      lastLoginAt: now
    };

    await set(userRef(user.uid), profile);
    return profile;
  }

  const existing = snapshot.val() as UserProfile;
  const profile: UserProfile = {
    email: user.email ?? existing.email ?? null,
    displayName: user.displayName ?? existing.displayName ?? null,
    photoURL: user.photoURL ?? existing.photoURL ?? null,
    createdAt: typeof existing.createdAt === "number" ? existing.createdAt : now,
    lastLoginAt: now
  };

  await update(userRef(user.uid), {
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    lastLoginAt: profile.lastLoginAt
  });

  return profile;
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (!rtdb) {
    return null;
  }

  const snapshot = await get(userRef(uid));
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val() as UserProfile;
};
