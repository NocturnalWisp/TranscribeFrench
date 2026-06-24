import type { PointerEvent } from "react";

/** Prevent focus from leaving the active text field when tapping controls (mobile keyboards). */
export function keepKeyboardOpen(event: PointerEvent) {
  event.preventDefault();
}
