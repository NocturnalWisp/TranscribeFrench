import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getZohoTransporter, ZOHO_MAILBOX, ZOHO_SMTP_PASSWORD } from "./zohoMail";

initializeApp();

type ReportIncorrectTranslationInput = {
  word?: unknown;
  segmentText?: unknown;
  segmentIndex?: unknown;
  segmentsPerClip?: unknown;
  exerciseId?: unknown;
  exerciseTitle?: unknown;
  audioUrl?: unknown;
};

type ReportIncorrectTranslationResult = {
  ticketId: string;
  emailSent: boolean;
};

const MAX_TEXT_LENGTH = 10_000;
const MAX_ID_LENGTH = 128;

const readString = (value: unknown, fieldName: string, maxLength = MAX_TEXT_LENGTH): string => {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpsError("invalid-argument", `${fieldName} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", `${fieldName} is too long.`);
  }

  return trimmed;
};

const readNonNegativeInteger = (value: unknown, fieldName: string, maxValue: number): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > maxValue) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a valid integer.`);
  }

  return value;
};

const buildEmailBody = (ticket: Record<string, unknown>): string => {
  return [
    "A user reported an incorrect translation.",
    "",
    `Word: ${ticket.word}`,
    `Exercise: ${ticket.exerciseTitle} (${ticket.exerciseId})`,
    `Segment index: ${ticket.segmentIndex}`,
    `Segments per clip: ${ticket.segmentsPerClip}`,
    `Segment text: ${ticket.segmentText}`,
    `Audio URL: ${ticket.audioUrl}`,
    "",
    `Reported by: ${ticket.reporterDisplayName} <${ticket.reporterEmail}> (${ticket.reporterUid})`,
    `Ticket ID: ${ticket.id}`,
    `Created at: ${new Date(Number(ticket.createdAt)).toISOString()}`
  ].join("\n");
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export const reportIncorrectTranslation = onCall(
  {
    region: "us-central1",
    secrets: [ZOHO_SMTP_PASSWORD]
  },
  async (request): Promise<ReportIncorrectTranslationResult> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to report an issue.");
    }

    const data = (request.data ?? {}) as ReportIncorrectTranslationInput;
    const word = readString(data.word, "word", 128);
    const segmentText = readString(data.segmentText, "segmentText");
    const segmentIndex = readNonNegativeInteger(data.segmentIndex, "segmentIndex", 10_000);
    const segmentsPerClip = readNonNegativeInteger(data.segmentsPerClip, "segmentsPerClip", 10);
    const exerciseId = readString(data.exerciseId, "exerciseId", MAX_ID_LENGTH);
    const exerciseTitle = readString(data.exerciseTitle, "exerciseTitle", 256);
    const audioUrl = readString(data.audioUrl, "audioUrl");

    if (segmentsPerClip < 1) {
      throw new HttpsError("invalid-argument", "segmentsPerClip must be at least 1.");
    }

    const ticketRef = getDatabase().ref("supportTickets").push();
    const ticketId = ticketRef.key;

    if (!ticketId) {
      throw new HttpsError("internal", "Unable to create a support ticket.");
    }

    const reporterEmail = request.auth.token.email ?? "unknown";
    const reporterDisplayName = request.auth.token.name ?? reporterEmail;
    const createdAt = Date.now();

    const ticket = {
      id: ticketId,
      type: "incorrect_translation",
      status: "open",
      word,
      segmentText,
      segmentIndex,
      segmentsPerClip,
      exerciseId,
      exerciseTitle,
      audioUrl,
      reporterUid: request.auth.uid,
      reporterEmail,
      reporterDisplayName,
      createdAt,
      emailSent: false
    };

    await ticketRef.set(ticket);

    let emailSent = false;

    try {
      const transporter = getZohoTransporter();
      await transporter.sendMail({
        from: ZOHO_MAILBOX,
        to: ZOHO_MAILBOX,
        subject: `[TranscribeFrench] Incorrect translation reported: "${word}"`,
        text: buildEmailBody(ticket)
      });
      emailSent = true;
      await ticketRef.update({ emailSent: true });
    } catch (error) {
      const errorCode = error instanceof Error && "code" in error ? String(error.code) : "unknown";
      console.error("Failed to send support ticket email", {
        errorCode,
        message: getErrorMessage(error)
      });
      await ticketRef.update({
        emailSent: false,
        emailError: errorCode,
        emailErrorMessage: getErrorMessage(error).slice(0, 500)
      });
    }

    return { ticketId, emailSent };
  }
);
