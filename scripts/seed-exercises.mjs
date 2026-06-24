#!/usr/bin/env node
/**
 * Upload local audio exercises to Firebase Storage and sync metadata to Realtime Database.
 *
 * Credentials (first match wins):
 *   1. GOOGLE_APPLICATION_CREDENTIALS
 *   2. scripts/service-account.json
 *   3. Application Default Credentials (gcloud auth application-default login)
 */

import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, deleteApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const EXERCISES_DIR = resolve(REPO_ROOT, "content/audio-exercises");
const TRANSCRIPTS_DIR = resolve(EXERCISES_DIR, "transcripts");
const MANIFEST_PATH = resolve(EXERCISES_DIR, "manifest.json");
const SERVICE_ACCOUNT_PATH = resolve(__dirname, "service-account.json");
const STORAGE_PREFIX = "audio-exercises";

const CONTENT_TYPES = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm"
};

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const allowSkip = args.has("--allow-skip");

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function optionalEnv(name) {
  return process.env[name]?.trim() || "";
}

function resolveDatabaseUrl() {
  const configured = optionalEnv("VITE_FIREBASE_DATABASE_URL");
  if (configured) {
    return configured;
  }

  const projectId = optionalEnv("VITE_FIREBASE_PROJECT_ID");
  if (!projectId) {
    throw new Error(
      "Missing VITE_FIREBASE_DATABASE_URL or VITE_FIREBASE_PROJECT_ID. Add one to .env (see .env.example)."
    );
  }

  return `https://${projectId}-default-rtdb.firebaseio.com`;
}

function resolveStorageBucket() {
  const configured = optionalEnv("VITE_FIREBASE_STORAGE_BUCKET");
  if (configured) {
    return configured;
  }

  const projectId = optionalEnv("VITE_FIREBASE_PROJECT_ID");
  if (!projectId) {
    throw new Error(
      "Missing VITE_FIREBASE_STORAGE_BUCKET or VITE_FIREBASE_PROJECT_ID. Add one to .env (see .env.example)."
    );
  }

  return `${projectId}.firebasestorage.app`;
}

function loadProjectEnv() {
  loadEnvFile(resolve(REPO_ROOT, ".env"));
  loadEnvFile(resolve(REPO_ROOT, ".env.local"));
  loadEnvFile(resolve(REPO_ROOT, ".env.production"));
}

function omitUndefined(value) {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefined(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, omitUndefined(fieldValue)])
  );
}

function hashFile(path) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolvePromise(hash.digest("hex")));
  });
}

function buildDownloadUrl(bucketName, storagePath, token) {
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
}

function normalizeWhisperSegments(value) {
  if (!value) {
    return [];
  }

  const rawSegments = Array.isArray(value)
    ? value
    : typeof value === "object" && Array.isArray(value.segments)
      ? value.segments
      : typeof value === "object" && value.segments && typeof value.segments === "object"
        ? Object.values(value.segments)
        : [];

  return rawSegments
    .map((segment) => {
      if (!segment || typeof segment !== "object") {
        return null;
      }

      const { start, end, text } = segment;
      if (typeof start !== "number" || typeof end !== "number" || end <= start) {
        return null;
      }

      return {
        start,
        end,
        text: typeof text === "string" ? text.trim() : ""
      };
    })
    .filter(Boolean);
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      `Manifest not found at ${MANIFEST_PATH}. Run the Whisper transcribe tool first.`
    );
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  if (!Array.isArray(manifest.exercises) || manifest.exercises.length === 0) {
    throw new Error("manifest.json has no exercises.");
  }

  return manifest.exercises.filter((entry) => entry.active !== false);
}

function resolveLocalAudioPath(entry) {
  const audioName = basename(entry.audioUrl ?? "");
  const candidate = resolve(EXERCISES_DIR, audioName);
  if (!existsSync(candidate)) {
    throw new Error(`Audio file not found for ${entry.id}: ${candidate}`);
  }
  return candidate;
}

function readTranscriptFiles(entry) {
  const stem = entry.id;
  const transcriptTxt = resolve(TRANSCRIPTS_DIR, `${stem}.txt`);
  const transcriptJson = resolve(TRANSCRIPTS_DIR, `${stem}.json`);

  const transcription =
    typeof entry.transcription === "string" && entry.transcription.trim()
      ? entry.transcription.trim()
      : existsSync(transcriptTxt)
        ? readFileSync(transcriptTxt, "utf8").trim()
        : "";

  let whisperSegments = [];
  if (existsSync(transcriptJson)) {
    const payload = JSON.parse(readFileSync(transcriptJson, "utf8"));
    whisperSegments = normalizeWhisperSegments(payload.segments ?? payload);
  } else if (existsSync(transcriptTxt)) {
    console.warn(
      `Warning: ${entry.id} has ${basename(transcriptTxt)} but no ${basename(transcriptJson)}. ` +
        "Whisper segments will not be synced to RTDB. Run the transcribe tool first."
    );
  }

  return { transcription, whisperSegments, transcriptJson };
}

function resolveCredential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }

  if (existsSync(SERVICE_ACCOUNT_PATH)) {
    return cert(JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8")));
  }

  throw new Error(
    "Missing Firebase Admin credentials. Save a service account key to scripts/service-account.json " +
      "(Firebase Console -> Project settings -> Service accounts -> Generate new private key)."
  );
}

function initAdmin() {
  if (getApps().length > 0) {
    return;
  }

  initializeApp({
    credential: resolveCredential(),
    databaseURL: resolveDatabaseUrl(),
    storageBucket: resolveStorageBucket()
  });
}

async function getExistingRecord(database, exerciseId) {
  const snapshot = await database.ref(`audioExercises/${exerciseId}`).get();
  return snapshot.exists() ? snapshot.val() : null;
}

async function uploadAudioIfNeeded({ bucket, bucketName, exerciseId, localPath, existingRecord }) {
  const extension = extname(localPath).toLowerCase();
  const storagePath = `${STORAGE_PREFIX}/${exerciseId}/audio${extension || ".mp3"}`;
  const sourceHash = await hashFile(localPath);
  const file = bucket.file(storagePath);

  if (
    !force
    && existingRecord?.sourceHash === sourceHash
    && typeof existingRecord.audioUrl === "string"
    && existingRecord.audioUrl.includes("firebasestorage.googleapis.com")
  ) {
    return {
      audioUrl: existingRecord.audioUrl,
      sourceHash,
      storagePath,
      skippedUpload: true
    };
  }

  const [alreadyExists] = await file.exists();
  const token = randomUUID();
  const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";

  if (alreadyExists) {
    const [metadata] = await file.getMetadata();
    const tokens = metadata.metadata?.firebaseStorageDownloadTokens;
    const existingToken = typeof tokens === "string" ? tokens.split(",")[0] : null;
    const existingHash = metadata.metadata?.sourceHash;

    if (!force && existingHash === sourceHash && existingToken) {
      return {
        audioUrl: buildDownloadUrl(bucketName, storagePath, existingToken),
        sourceHash,
        storagePath,
        skippedUpload: true
      };
    }
  }

  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
        sourceHash,
        exerciseId
      }
    }
  });

  return {
    audioUrl: buildDownloadUrl(bucketName, storagePath, token),
    sourceHash,
    storagePath,
    skippedUpload: false
  };
}

async function seedExercise({ database, bucket, bucketName, entry, order }) {
  const localAudioPath = resolveLocalAudioPath(entry);
  const { transcription, whisperSegments, transcriptJson } = readTranscriptFiles(entry);
  const existingRecord = await getExistingRecord(database, entry.id);
  const upload = await uploadAudioIfNeeded({
    bucket,
    bucketName,
    exerciseId: entry.id,
    localPath: localAudioPath,
    existingRecord
  });

  const record = omitUndefined({
    title: entry.title,
    audioUrl: upload.audioUrl,
    transcription,
    active: true,
    order,
    sourceHash: upload.sourceHash,
    storagePath: upload.storagePath,
    whisperSegments: whisperSegments.length > 0 ? whisperSegments : undefined,
    durationSeconds:
      whisperSegments.length > 0 ? whisperSegments[whisperSegments.length - 1].end : undefined,
    updatedAt: Date.now()
  });

  await database.ref(`audioExercises/${entry.id}`).set(record);

  return {
    id: entry.id,
    skippedUpload: upload.skippedUpload,
    whisperSegmentCount: whisperSegments.length,
    transcriptJson: basename(transcriptJson)
  };
}

async function main() {
  loadProjectEnv();

  const entries = readManifest();
  initAdmin();

  const database = getDatabase();
  const bucket = getStorage().bucket();
  const bucketName = bucket.name;

  const results = [];
  for (const [index, entry] of entries.entries()) {
    if (!entry.id) {
      throw new Error(`Manifest entry at index ${index} is missing an id.`);
    }

    const result = await seedExercise({
      database,
      bucket,
      bucketName,
      entry,
      order: index + 1
    });
    results.push(result);
    const segmentSummary =
      result.whisperSegmentCount > 0
        ? `${result.whisperSegmentCount} whisper segments`
        : "no whisper segments (add transcripts/*.json)";
    console.log(
      `${result.skippedUpload ? "Synced" : "Uploaded"} exercise ${entry.id} (${entry.title}) — ${segmentSummary}`
    );
  }

  const trialExerciseId = entries[0].id;
  await database.ref("config").update({
    trialExerciseId,
    seededAt: new Date().toISOString()
  });

  console.log(`Set config/trialExerciseId = ${trialExerciseId}`);
  console.log(`Seeded ${results.length} exercise(s) to Realtime Database.`);
}

async function shutdown(exitCode) {
  await Promise.all(getApps().map((app) => deleteApp(app)));
  process.exit(exitCode);
}

main()
  .then(() => shutdown(0))
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);

    if (allowSkip) {
      console.warn(`Seed skipped: ${message}`);
      void shutdown(0);
      return;
    }

    console.error(message);
    void shutdown(1);
  });
