import type { CapturedEvent, Opportunity, Session, Thumb } from "../types";

const SESSIONS_KEY = "weft_sessions";
const ACTIVE_SESSION_KEY = "weft_active_session_id";
const REGISTERS_KEY = "weft_registers";
const FEEDBACK_KEY = "weft_feedback";

export async function getSessions(): Promise<Record<string, Session>> {
  const result = await chrome.storage.local.get(SESSIONS_KEY);
  return result[SESSIONS_KEY] ?? {};
}

export async function getSession(sessionId: string): Promise<Session | undefined> {
  const sessions = await getSessions();
  return sessions[sessionId];
}

export async function saveSession(session: Session): Promise<void> {
  const sessions = await getSessions();
  sessions[session.id] = session;
  await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
}

export async function getActiveSessionId(): Promise<string | null> {
  const result = await chrome.storage.local.get(ACTIVE_SESSION_KEY);
  return result[ACTIVE_SESSION_KEY] ?? null;
}

export async function setActiveSessionId(id: string | null): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_SESSION_KEY]: id });
}

export async function appendEvent(sessionId: string, event: CapturedEvent): Promise<boolean> {
  const session = await getSession(sessionId);
  if (!session) return false;
  session.events.push(event);
  await saveSession(session);
  return true;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getSessions();
  delete sessions[sessionId];
  await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
}

// Only reviewed sessions (confirmed past the privacy preview) are eligible
// for merge — an unreviewed session hasn't been checked for redactions yet.
export async function getReviewedSessionsForWorkflow(workflowId: string): Promise<Session[]> {
  const sessions = await getSessions();
  return Object.values(sessions).filter((session) => session.workflowId === workflowId && session.reviewed);
}

export async function getRegister(workflowId: string): Promise<Opportunity[]> {
  const result = await chrome.storage.local.get(REGISTERS_KEY);
  const registers: Record<string, Opportunity[]> = result[REGISTERS_KEY] ?? {};
  return registers[workflowId] ?? [];
}

export async function saveRegister(workflowId: string, opportunities: Opportunity[]): Promise<void> {
  const result = await chrome.storage.local.get(REGISTERS_KEY);
  const registers: Record<string, Opportunity[]> = result[REGISTERS_KEY] ?? {};
  registers[workflowId] = opportunities;
  await chrome.storage.local.set({ [REGISTERS_KEY]: registers });
}

// Thumbs feedback per merged node, keyed by that node's id (see FR-15 — a
// quality signal, never an individual performance metric).
export async function getFeedback(): Promise<Record<string, Thumb>> {
  const result = await chrome.storage.local.get(FEEDBACK_KEY);
  return result[FEEDBACK_KEY] ?? {};
}

export async function setFeedback(nodeId: string, thumb: Thumb): Promise<void> {
  const feedback = await getFeedback();
  feedback[nodeId] = thumb;
  await chrome.storage.local.set({ [FEEDBACK_KEY]: feedback });
}
