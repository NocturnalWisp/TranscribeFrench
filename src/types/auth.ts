export type AccessMode = "trial" | "full";

export type UserProfile = {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: number;
  lastLoginAt: number;
};

export type UserSessionState = {
  exerciseId: string;
  segmentIndex: number;
  segmentsPerClip: number;
  transcriptionInput: string;
  updatedAt: number;
};
