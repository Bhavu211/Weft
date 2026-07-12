import type { CapturedEvent } from "../types";

export type StartCaptureMessage = { type: "START_CAPTURE"; workflowId: string };
export type StopCaptureMessage = { type: "STOP_CAPTURE" };
export type CaptureEventMessage = { type: "CAPTURE_EVENT"; event: CapturedEvent };
export type GetCaptureStateMessage = { type: "GET_CAPTURE_STATE" };
// Sent once the user has reviewed the pre-save privacy preview. labelEdits
// carries only the step labels they chose to redact/rewrite (stepId -> new label).
export type ConfirmSessionMessage = { type: "CONFIRM_SESSION"; sessionId: string; labelEdits: Record<string, string> };
// Sent when the user discards a session from the privacy preview instead of saving it.
export type DiscardSessionMessage = { type: "DISCARD_SESSION"; sessionId: string };

export type WeftMessage =
  | StartCaptureMessage
  | StopCaptureMessage
  | CaptureEventMessage
  | GetCaptureStateMessage
  | ConfirmSessionMessage
  | DiscardSessionMessage;

export type StartCaptureResponse = { sessionId: string };
export type StopCaptureResponse = { stopped: boolean; sessionId: string | null };
export type CaptureEventResponse = { captured: boolean };
export type GetCaptureStateResponse = { activeSessionId: string | null };
export type ConfirmSessionResponse = { confirmed: boolean };
export type DiscardSessionResponse = { discarded: boolean };
