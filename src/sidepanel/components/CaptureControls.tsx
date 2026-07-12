import { useEffect, useState } from "react";
import type {
  GetCaptureStateResponse,
  StartCaptureResponse,
  StopCaptureResponse,
} from "../../background/messages";

export default function CaptureControls({
  workflowId,
  onStopped,
}: {
  workflowId: string;
  onStopped?: (sessionId: string) => void;
}) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const trimmedWorkflowId = workflowId.trim();

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "GET_CAPTURE_STATE" })
      .then((res: GetCaptureStateResponse) => setActiveSessionId(res.activeSessionId));
  }, []);

  async function start() {
    if (!trimmedWorkflowId) return;
    const res: StartCaptureResponse = await chrome.runtime.sendMessage({
      type: "START_CAPTURE",
      workflowId: trimmedWorkflowId,
    });
    setActiveSessionId(res.sessionId);
  }

  async function stop() {
    const res: StopCaptureResponse = await chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
    if (res.stopped) {
      setActiveSessionId(null);
      if (res.sessionId) onStopped?.(res.sessionId);
    }
  }

  return (
    <div className="capture-controls">
      {activeSessionId ? (
        <button className="btn btn-stop" onClick={stop}>
          Stop recording
        </button>
      ) : (
        <button className="btn btn-start" onClick={start} disabled={!trimmedWorkflowId}>
          Start recording
        </button>
      )}
      <span className="muted capture-status">
        {activeSessionId ? "Recording…" : trimmedWorkflowId ? "Not recording" : "Name a workflow to start"}
      </span>
    </div>
  );
}
