import type { Session } from "../types";
import { appendEvent, getSession, saveSession, getActiveSessionId, setActiveSessionId } from "../lib/storage";
import { segment } from "../reconstruct/segment";
import { classify } from "../reconstruct/classify";
import type { WeftMessage } from "./messages";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Weft] service worker installed");
});

// chrome.runtime.onMessage fires once per incoming message; without
// serializing them, two CAPTURE_EVENT messages arriving close together (very
// common — clicks and inputs fire in quick succession) can both read the
// same stale session snapshot from storage before either writes, and the
// second write silently clobbers the first (a lost update). Chaining every
// message through one promise queue forces each read-modify-write cycle to
// finish before the next one starts.
let messageQueue: Promise<unknown> = Promise.resolve();

chrome.runtime.onMessage.addListener((message: WeftMessage, _sender, sendResponse) => {
  messageQueue = messageQueue.then(() => handleMessage(message)).then(sendResponse);
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
    // Reconstruction is a nice-to-have derived view; the raw session (events
    // + endedAt) must persist even if segmentation/classification throws on
    // some unexpected real-world event shape.
    try {
      session.steps = classify(segment(session));
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
      console.error(
        `[Weft] STEP RECONSTRUCTION FAILED (raw session still saved, ${session.events.length} events).\n` +
          `Copy everything below this line into the bug report:\n${detail}`
      );
    }
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
