import type { ExecutiveSummary as ExecutiveSummaryData } from "../executive-summary";

function Tile({ label, value, footnote }: { label: string; value: string; footnote?: string }) {
  return (
    <div className="exec-tile">
      <div className="exec-tile-value">{value}</div>
      <div className="exec-tile-label">{label}</div>
      {footnote ? <div className="exec-tile-footnote">{footnote}</div> : null}
    </div>
  );
}

export default function ExecutiveSummary({ summary }: { summary: ExecutiveSummaryData }) {
  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Executive Summary</h2>
      <div className="exec-grid">
        <Tile label="Workflows analyzed" value={String(summary.totalWorkflows)} />
        <Tile
          label="Users observed"
          value={String(summary.totalUsersObserved)}
          footnote="Weft never tracks individual identity, by design — this is always this device, not a headcount."
        />
        <Tile label="Sessions recorded" value={String(summary.totalSessionsRecorded)} />
        <Tile label="Process variants found" value={String(summary.totalProcessVariants)} />
        <Tile label="Automation opportunities discovered" value={String(summary.automationOpportunitiesDiscovered)} />
        <Tile
          label="Estimated monthly hours saved"
          value={summary.estimatedMonthlyHoursSaved.toFixed(1)}
        />
        <Tile
          label="Estimated annual savings"
          value={`$${summary.estimatedAnnualSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
      </div>
    </section>
  );
}
