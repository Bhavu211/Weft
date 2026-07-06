import { useEffect, useState } from "react";
import type {
  GetCaptureStateResponse,
  StartCaptureResponse,
  StopCaptureResponse,
} from "../../background/messages";

// Placeholder until M4 adds workflow naming; every M1 session belongs to one
// unnamed workflow bucket.
const DEFAULT_WORKFLOW_ID = "unnamed-workflow";

export default function CaptureControls() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "GET_CAPTURE_STATE" })
      .then((res: GetCaptureStateResponse) => setActiveSessionId(res.activeSessionId));
  }, []);

  async function start() {
    const res: StartCaptureResponse = await chrome.runtime.sendMessage({
      type: "START_CAPTURE",
      workflowId: DEFAULT_WORKFLOW_ID,
    });
    setActiveSessionId(res.sessionId);
  }

  async function stop() {
    const res: StopCaptureResponse = await chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
    if (res.stopped) setActiveSessionId(null);
  }

  return (
    <div className="capture-controls">
      {activeSessionId ? (
        <button className="btn btn-stop" onClick={stop}>
          Stop recording
        </button>
      ) : (
        <button className="btn btn-start" onClick={start}>
          Start recording
        </button>
      )}
      <span className="muted capture-status">
        {activeSessionId ? "Recording…" : "Not recording"}
      </span>
    </div>
  );
}
