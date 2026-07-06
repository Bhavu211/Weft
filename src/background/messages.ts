import type { CapturedEvent } from "../types";

export type StartCaptureMessage = { type: "START_CAPTURE"; workflowId: string };
export type StopCaptureMessage = { type: "STOP_CAPTURE" };
export type CaptureEventMessage = { type: "CAPTURE_EVENT"; event: CapturedEvent };
export type GetCaptureStateMessage = { type: "GET_CAPTURE_STATE" };

export type WeftMessage =
  | StartCaptureMessage
  | StopCaptureMessage
  | CaptureEventMessage
  | GetCaptureStateMessage;

export type StartCaptureResponse = { sessionId: string };
export type StopCaptureResponse = { stopped: boolean; sessionId: string | null };
export type CaptureEventResponse = { captured: boolean };
export type GetCaptureStateResponse = { activeSessionId: string | null };
