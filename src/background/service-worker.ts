import type { Session } from "../types";
import { appendEvent, getSession, saveSession, getActiveSessionId, setActiveSessionId } from "../lib/storage";
import type { WeftMessage } from "./messages";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Weft] service worker installed");
});

chrome.runtime.onMessage.addListener((message: WeftMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // keep the message channel open for the async response
});

async function handleMessage(message: WeftMessage) {
  switch (message.type) {
    case "START_CAPTURE":
      return startCapture(message.workflowId);
    case "STOP_CAPTURE":
      return stopCapture();
    case "CAPTURE_EVENT":
      return captureEvent(message);
    case "GET_CAPTURE_STATE":
      return { activeSessionId: await getActiveSessionId() };
  }
}

async function startCapture(workflowId: string) {
  const session: Session = {
    id: crypto.randomUUID(),
    workflowId,
    startedAt: Date.now(),
    events: [],
  };
  await saveSession(session);
  await setActiveSessionId(session.id);
  return { sessionId: session.id };
}

async function stopCapture() {
  const sessionId = await getActiveSessionId();
  if (!sessionId) return { stopped: false, sessionId: null };

  const session = await getSession(sessionId);
  if (session) {
    session.endedAt = Date.now();
    await saveSession(session);
  }
  await setActiveSessionId(null);
  return { stopped: true, sessionId };
}

async function captureEvent(message: Extract<WeftMessage, { type: "CAPTURE_EVENT" }>) {
  const sessionId = await getActiveSessionId();
  if (!sessionId) return { captured: false };

  const session = await getSession(sessionId);
  const lastEvent = session?.events[session.events.length - 1];
  if (lastEvent && lastEvent.domain !== message.event.domain) {
    message.event.crossDomainFrom = lastEvent.domain;
  }

  const captured = await appendEvent(sessionId, message.event);
  return { captured };
}
