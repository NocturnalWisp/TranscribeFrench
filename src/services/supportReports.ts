import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "./firebaseFunctions";

export type IncorrectTranslationReportInput = {
  word: string;
  segmentText: string;
  segmentIndex: number;
  segmentsPerClip: number;
  exerciseId: string;
  exerciseTitle: string;
  audioUrl: string;
};

export type IncorrectTranslationReportResult = {
  ticketId: string;
  emailSent: boolean;
};

export async function reportIncorrectTranslation(
  input: IncorrectTranslationReportInput
): Promise<IncorrectTranslationReportResult> {
  const callable = httpsCallable<
    IncorrectTranslationReportInput,
    IncorrectTranslationReportResult
  >(getFirebaseFunctions(), "reportIncorrectTranslation");
  const result = await callable(input);
  const ticketId = result.data?.ticketId;

  if (!ticketId) {
    throw new Error("Support ticket was created without an id.");
  }

  return {
    ticketId,
    emailSent: result.data?.emailSent ?? false
  };
}
