export const HOSTED_EXERCISES_MANIFEST_PATH = "/audio-exercises/manifest.json";

export type HostedExerciseManifestEntry = {
  id: string;
  title: string;
  audioUrl: string;
  transcriptUrl?: string;
  transcription?: string;
  active?: boolean;
  durationSeconds?: number;
};

export type HostedExerciseManifest = {
  generatedAt?: string;
  exercises: HostedExerciseManifestEntry[];
};
