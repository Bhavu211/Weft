import type { BusinessKPIs as BusinessKPIsData } from "../business-kpis";

function ScoreTile({ label, score, footnote }: { label: string; score: number; footnote: string }) {
  return (
    <div className="exec-tile">
      <div className="exec-tile-value">{score}</div>
      <div className="exec-tile-label">{label}</div>
      <div className="exec-tile-footnote">{footnote}</div>
    </div>
  );
}

export default function BusinessKPIs({ kpis }: { kpis: BusinessKPIsData }) {
  const maxCount = Math.max(1, ...kpis.aiCapabilityDistribution.map((d) => d.count));

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Business KPIs</h2>
      <div className="exec-grid">
        <div className="exec-tile">
          <div className="exec-tile-value">{kpis.potentialHoursSavedPerMonth.toFixed(1)}</div>
          <div className="exec-tile-label">Potential hours saved / month</div>
        </div>
        <div className="exec-tile">
          <div className="exec-tile-value">
            ${kpis.potentialAnnualSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="exec-tile-label">Potential annual savings</div>
          <div className="exec-tile-footnote">Ceiling across every opportunity discovered, registered or not.</div>
        </div>
        <div className="exec-tile">
          <div className="exec-tile-value">
            ${kpis.roiForecastAnnual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="exec-tile-label">ROI forecast (annual)</div>
          <div className="exec-tile-footnote">
            From opportunities currently in the pipeline, not yet shipped.
          </div>
        </div>
        <ScoreTile
          label="Automation readiness score"
          score={kpis.automationReadinessScore}
          footnote="How much of what's discovered is registered, how far along it is, and how confident we are in it."
        />
        <ScoreTile
          label="Process health score"
          score={kpis.processHealthScore}
          footnote="Fewer bottlenecks, manual hotspots, and variants relative to total steps reads as healthier."
        />
      </div>

      <h3 className="kpi-subheading">AI capability distribution</h3>
      {kpis.aiCapabilityDistribution.length === 0 ? (
        <p className="muted">No registered opportunities yet.</p>
      ) : (
        <div className="capability-bars">
          {kpis.aiCapabilityDistribution.map((d) => (
            <div key={d.capability} className="capability-bar-row">
              <div className="capability-bar-label">{d.capability}</div>
              <div className="capability-bar-track">
                <div className="capability-bar-fill" style={{ width: `${(d.count / maxCount) * 100}%` }} />
              </div>
              <div className="capability-bar-count">{d.count}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
