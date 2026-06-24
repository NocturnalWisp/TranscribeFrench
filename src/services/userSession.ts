import { get, ref, update } from "firebase/database";
import type { UserSessionState } from "../types/auth";
import { clampSegmentsPerClip } from "../utils/whisperSegmentGroups";
import { rtdb } from "./firebase";

const sessionRef = (uid: string) => ref(rtdb!, `users/${uid}/session`);

const normalizeSessionState = (value: unknown): UserSessionState | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<UserSessionState>;
  const exerciseId = typeof data.exerciseId === "string" ? data.exerciseId.trim() : "";
  const segmentIndex =
    typeof data.segmentIndex === "number" && Number.isFinite(data.segmentIndex)
      ? Math.max(0, Math.round(data.segmentIndex))
      : 0;
  const segmentsPerClip =
    typeof data.segmentsPerClip === "number" && Number.isFinite(data.segmentsPerClip)
      ? clampSegmentsPerClip(data.segmentsPerClip)
      : 1;
  const transcriptionInput =
    typeof data.transcriptionInput === "string" ? data.transcriptionInput : "";
  const updatedAt =
    typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt) ? data.updatedAt : 0;

  if (!exerciseId) {
    return null;
  }

  return {
    exerciseId,
    segmentIndex,
    segmentsPerClip,
    transcriptionInput,
    updatedAt
  };
};

export const getUserSessionState = async (uid: string): Promise<UserSessionState | null> => {
  if (!rtdb) {
    return null;
  }

  const snapshot = await get(sessionRef(uid));
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeSessionState(snapshot.val());
};

export const saveUserSessionState = async (
  uid: string,
  state: Omit<UserSessionState, "updatedAt">
): Promise<void> => {
  if (!rtdb) {
    return;
  }

  const payload: UserSessionState = {
    exerciseId: state.exerciseId.trim(),
    segmentIndex: Math.max(0, Math.round(state.segmentIndex)),
    segmentsPerClip: clampSegmentsPerClip(state.segmentsPerClip),
    transcriptionInput: state.transcriptionInput,
    updatedAt: Date.now()
  };

  if (!payload.exerciseId) {
    return;
  }

  await update(ref(rtdb, `users/${uid}`), {
    session: payload
  });
};
