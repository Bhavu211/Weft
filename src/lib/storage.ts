import type { CapturedEvent, Session } from "../types";

const SESSIONS_KEY = "weft_sessions";
const ACTIVE_SESSION_KEY = "weft_active_session_id";

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
