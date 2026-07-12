import type { Session } from "../types";
import {
  appendEvent,
  deleteSession,
  getSession,
  saveSession,
  getActiveSessionId,
  setActiveSessionId,
  getActiveSessionTabIds,
  setActiveSessionTabIds,
  addActiveSessionTabId,
} from "../lib/storage";
import { segment } from "../reconstruct/segment";
import { classify } from "../reconstruct/classify";
import { applyLabelEdits } from "../lib/privacy-preview";
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

chrome.runtime.onMessage.addListener((message: WeftMessage, sender, sendResponse) => {
  messageQueue = messageQueue.then(() => handleMessage(message, sender)).then(sendResponse);
  return true; // keep the message channel open for the async response
});

async function handleMessage(message: WeftMessage, sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case "START_CAPTURE":
      return startCapture(message.workflowId);
    case "STOP_CAPTURE":
      return stopCapture();
    case "CAPTURE_EVENT":
      return captureEvent(message, sender);
    case "GET_CAPTURE_STATE":
      return { activeSessionId: await getActiveSessionId() };
    case "CONFIRM_SESSION":
      return confirmSession(message.sessionId, message.labelEdits);
    case "DISCARD_SESSION":
      return discardSession(message.sessionId);
  }
}

// A tab opened from one already in the active session (e.g. a workflow step
// that opens a link in a new tab) joins the session too; any other tab the
// user just happens to have open never does. Registered once, at module
// scope — the "is a session active" check happens per-event, not here.
chrome.tabs.onCreated.addListener((tab) => {
  messageQueue = messageQueue.then(async () => {
    if (tab.id === undefined || tab.openerTabId === undefined) return;
    const [activeSessionId, tabIds] = await Promise.all([getActiveSessionId(), getActiveSessionTabIds()]);
    if (activeSessionId && tabIds.includes(tab.openerTabId)) {
      await addActiveSessionTabId(tab.id);
    }
  });
});

async function startCapture(workflowId: string) {
  const session: Session = {
    id: crypto.randomUUID(),
    workflowId,
    startedAt: Date.now(),
    events: [],
    reviewed: false,
  };
  await saveSession(session);
  await setActiveSessionId(session.id);

  // The tab the side panel is open alongside is the one being recorded;
  // only it (and tabs opened from it) may contribute events to this session.
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await setActiveSessionTabIds(activeTab?.id !== undefined ? [activeTab.id] : []);

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
  await setActiveSessionTabIds([]);
  return { stopped: true, sessionId };
}

async function captureEvent(
  message: Extract<WeftMessage, { type: "CAPTURE_EVENT" }>,
  sender: chrome.runtime.MessageSender
) {
  const sessionId = await getActiveSessionId();
  if (!sessionId) return { captured: false };

  // Reject events from any tab that isn't part of this recording — a tab
  // the user just happens to have open elsewhere is not the workflow being
  // recorded, even though its content script is running too.
  const tabIds = await getActiveSessionTabIds();
  if (sender.tab?.id === undefined || !tabIds.includes(sender.tab.id)) {
    return { captured: false };
  }

  const session = await getSession(sessionId);
  const lastEvent = session?.events[session.events.length - 1];
  if (lastEvent && lastEvent.domain !== message.event.domain) {
    message.event.crossDomainFrom = lastEvent.domain;
  }

  const captured = await appendEvent(sessionId, message.event);
  return { captured };
}

// Finalizes a stopped session once the user has confirmed the privacy
// preview: applies any labels they redacted/rewrote and marks it reviewed.
// Nothing before this point counts as the workflow's confirmed record.
async function confirmSession(sessionId: string, labelEdits: Record<string, string>) {
  const session = await getSession(sessionId);
  if (!session) return { confirmed: false };

  if (session.steps) {
    session.steps = applyLabelEdits(session.steps, labelEdits);
  }
  session.reviewed = true;
  await saveSession(session);
  return { confirmed: true };
}

// The user rejected the privacy preview: remove the session entirely rather
// than soft-deleting it, so nothing from it lingers in storage.
async function discardSession(sessionId: string) {
  await deleteSession(sessionId);
  return { discarded: true };
}
