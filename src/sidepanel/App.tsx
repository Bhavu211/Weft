import { useState } from "react";
import CaptureControls from "./components/CaptureControls";
import StepList from "./components/StepList";
import { getSession } from "../lib/storage";
import type { ClassifiedStep } from "../types";

export default function App() {
  const [steps, setSteps] = useState<ClassifiedStep[]>([]);
  const [eventCount, setEventCount] = useState<number | null>(null);

  async function handleStopped(sessionId: string) {
    const session = await getSession(sessionId);
    setSteps(session?.steps ?? []);
    setEventCount(session?.events.length ?? null);
  }

  const reconstructionFailed = eventCount !== null && eventCount > 0 && steps.length === 0;

  return (
    <div className="app">
      <h1>Weft</h1>
      <CaptureControls onStopped={handleStopped} />
      {reconstructionFailed ? (
        <p className="muted">
          Session saved ({eventCount} events), but step reconstruction failed — see the service worker console.
        </p>
      ) : (
        <StepList steps={steps} />
      )}
    </div>
  );
}
