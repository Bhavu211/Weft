import { useState } from "react";
import CaptureControls from "./components/CaptureControls";
import StepList from "./components/StepList";
import PrivacyPreview from "./components/PrivacyPreview";
import { getSession } from "../lib/storage";
import type { ClassifiedStep } from "../types";
import type { ConfirmSessionResponse, DiscardSessionResponse } from "../background/messages";

export default function App() {
  const [steps, setSteps] = useState<ClassifiedStep[]>([]);

  // A stopped session sits here, unreviewed, until the user confirms or
  // discards it in the privacy preview — nothing here counts as saved yet.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [pendingSteps, setPendingSteps] = useState<ClassifiedStep[]>([]);
  const [pendingEventCount, setPendingEventCount] = useState<number | null>(null);

  async function handleStopped(sessionId: string) {
    const session = await getSession(sessionId);
    setPendingSessionId(sessionId);
    setPendingSteps(session?.steps ?? []);
    setPendingEventCount(session?.events.length ?? null);
  }

  function clearPending() {
    setPendingSessionId(null);
    setPendingSteps([]);
    setPendingEventCount(null);
  }

  async function handleConfirm(labelEdits: Record<string, string>) {
    if (!pendingSessionId) return;
    const res: ConfirmSessionResponse = await chrome.runtime.sendMessage({
      type: "CONFIRM_SESSION",
      sessionId: pendingSessionId,
      labelEdits,
    });
    if (res.confirmed) {
      setSteps(pendingSteps.map((step) => (step.id in labelEdits ? { ...step, label: labelEdits[step.id] } : step)));
    }
    clearPending();
  }

  async function handleDiscard() {
    if (!pendingSessionId) return;
    const res: DiscardSessionResponse = await chrome.runtime.sendMessage({
      type: "DISCARD_SESSION",
      sessionId: pendingSessionId,
    });
    if (res.discarded) setSteps([]);
    clearPending();
  }

  const reconstructionFailed =
    pendingEventCount !== null && pendingEventCount > 0 && pendingSteps.length === 0;

  return (
    <div className="app">
      <h1>Weft</h1>
      <CaptureControls onStopped={handleStopped} />
      {pendingSessionId ? (
        reconstructionFailed ? (
          <div>
            <p className="muted">
              Session saved ({pendingEventCount} events), but step reconstruction failed —
              see the service worker console.
            </p>
            <button type="button" className="btn btn-discard" onClick={handleDiscard}>
              Discard session
            </button>
          </div>
        ) : (
          <PrivacyPreview steps={pendingSteps} onConfirm={handleConfirm} onDiscard={handleDiscard} />
        )
      ) : (
        <StepList steps={steps} />
      )}
    </div>
  );
}
