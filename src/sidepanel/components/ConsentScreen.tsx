export default function ConsentScreen({ onAcknowledge }: { onAcknowledge: () => void }) {
  return (
    <div className="consent-screen">
      <h1>Weft</h1>
      <p className="consent-lede">
        Weft records real work to find where automation belongs — never to watch or rate the
        person doing it.
      </p>

      <div className="consent-section">
        <h2>What Weft captures</h2>
        <p>Step identity only: element role/label, timestamps, URL path (query stripped), and domain.</p>
      </div>

      <div className="consent-section">
        <h2>What Weft never captures</h2>
        <p>
          Input values, query strings, on-screen page content, or screenshots — structurally, not
          just by policy. Any text it does keep is PII-redacted at the moment of capture.
        </p>
      </div>

      <div className="consent-section">
        <h2>The rules</h2>
        <ul className="consent-rules">
          <li>Worker-initiated — capture starts only from your own Start button, never automatically or remotely.</li>
          <li>Worker-owned — you preview exactly what was recorded and can redact or discard it before anything is saved.</li>
          <li>No individual performance metrics, ever. Timing is used only to find process bottlenecks.</li>
          <li>Everything stays on this device. No accounts, no backend, no network calls.</li>
        </ul>
      </div>

      <button type="button" className="btn btn-confirm consent-ack" onClick={onAcknowledge}>
        I understand — enable capture
      </button>
    </div>
  );
}
