import { HOSTED_EXERCISES_MANIFEST_PATH } from "../types/hostedExercises";

import type { AudioExercise, WhisperSegment } from "../types";

import type { HostedExerciseManifest, HostedExerciseManifestEntry } from "../types/hostedExercises";



export const resolveHostedAssetUrl = (path: string): string => {

  if (path.startsWith("http://") || path.startsWith("https://")) {

    return path;

  }



  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return encodeURI(normalizedPath);

};



const titleFromAudioUrl = (audioUrl: string): string => {

  const fileName = audioUrl.split("/").pop() ?? audioUrl;

  const stem = fileName.replace(/\.[^.]+$/, "");

  const normalized = stem.replace(/[_-]+/g, " ").trim();

  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : stem;

};



const isHostedManifest = (value: unknown): value is HostedExerciseManifest => {

  if (!value || typeof value !== "object") {

    return false;

  }



  const exercises = (value as HostedExerciseManifest).exercises;

  return Array.isArray(exercises);

};



const normalizeHostedEntry = (entry: HostedExerciseManifestEntry): AudioExercise | null => {

  const audioUrl = typeof entry.audioUrl === "string" ? entry.audioUrl.trim() : "";

  if (!audioUrl) {

    return null;

  }



  const title =

    typeof entry.title === "string" && entry.title.trim()

      ? entry.title.trim()

      : titleFromAudioUrl(audioUrl);



  return {

    id: entry.id || title,

    title,

    audioUrl: resolveHostedAssetUrl(audioUrl),

    expectedTranscription: typeof entry.transcription === "string" ? entry.transcription.trim() : "",

    language: "fr",

    active: entry.active !== false,

    durationSeconds:

      typeof entry.durationSeconds === "number" ? Math.max(0, entry.durationSeconds) : undefined

  };

};



const fetchTranscriptText = async (transcriptUrl: string): Promise<string> => {

  const response = await fetch(resolveHostedAssetUrl(transcriptUrl));

  if (!response.ok) {

    return "";

  }



  return (await response.text()).trim();

};



const transcriptJsonUrlFromTxt = (transcriptUrl: string): string => {

  return transcriptUrl.replace(/\.txt$/i, ".json");

};



const normalizeWhisperSegments = (value: unknown): WhisperSegment[] => {

  if (!value || typeof value !== "object") {

    return [];

  }



  const segments = (value as { segments?: unknown }).segments;

  if (!Array.isArray(segments)) {

    return [];

  }



  return segments

    .map((segment) => {

      if (!segment || typeof segment !== "object") {

        return null;

      }



      const start = (segment as { start?: unknown }).start;
      const end = (segment as { end?: unknown }).end;
      const text = (segment as { text?: unknown }).text;

      if (typeof start !== "number" || typeof end !== "number" || end <= start) {
        return null;
      }

      return {
        start,
        end,
        text: typeof text === "string" ? text.trim() : ""
      };

    })

    .filter((segment): segment is WhisperSegment => segment !== null);

};



const fetchWhisperSegments = async (transcriptUrl: string): Promise<WhisperSegment[]> => {

  const jsonUrl = transcriptJsonUrlFromTxt(transcriptUrl);

  const response = await fetch(resolveHostedAssetUrl(jsonUrl));

  if (!response.ok) {

    return [];

  }



  const payload = (await response.json()) as unknown;

  return normalizeWhisperSegments(payload);

};



const enrichExerciseWithTranscript = async (

  exercise: AudioExercise,

  entry: HostedExerciseManifestEntry

): Promise<AudioExercise> => {

  if (!entry.transcriptUrl) {

    return exercise;

  }



  const [transcription, whisperSegments] = await Promise.all([

    exercise.expectedTranscription

      ? Promise.resolve(exercise.expectedTranscription)

      : fetchTranscriptText(entry.transcriptUrl),

    fetchWhisperSegments(entry.transcriptUrl)

  ]);



  const durationSeconds =

    exercise.durationSeconds ??

    (whisperSegments.length > 0 ? whisperSegments[whisperSegments.length - 1].end : undefined);



  return {

    ...exercise,

    expectedTranscription: transcription || exercise.expectedTranscription,

    whisperSegments: whisperSegments.length > 0 ? whisperSegments : undefined,

    durationSeconds

  };

};



export const loadFirstHostedExercise = async (): Promise<AudioExercise | null> => {

  const response = await fetch(HOSTED_EXERCISES_MANIFEST_PATH);

  if (!response.ok) {

    return null;

  }



  const manifest = (await response.json()) as unknown;

  if (!isHostedManifest(manifest)) {

    return null;

  }



  const firstEntry = manifest.exercises.find((entry) => entry.active !== false);

  if (!firstEntry) {

    return null;

  }



  const exercise = normalizeHostedEntry(firstEntry);

  if (!exercise) {

    return null;

  }



  return enrichExerciseWithTranscript(exercise, firstEntry);

};


