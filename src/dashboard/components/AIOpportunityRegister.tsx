import type { Level, RegisterEntry } from "../ai-register";

function levelClass(level: Level): string {
  return level === "High" ? "level-high" : level === "Medium" ? "level-medium" : "level-low";
}

export default function AIOpportunityRegister({ entries }: { entries: RegisterEntry[] }) {
  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">AI Opportunity Register</h2>
      {entries.length === 0 ? (
        <p className="muted">
          No opportunities added to a workflow's register yet — select an opportunity node on a
          workflow map and add it to the register to see it catalogued here.
        </p>
      ) : (
        <div className="register-table-wrap">
          <table className="register-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Workflow step</th>
                <th>Category</th>
                <th>AI capability</th>
                <th>Complexity</th>
                <th>Business impact</th>
                <th>Est. dev effort</th>
                <th>Hours saved/mo</th>
                <th>Annual savings</th>
                <th>Confidence</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={`${e.workflowId}::${e.stepId}`}>
                  <td>
                    <div className="register-name">{e.name}</div>
                    <div className="register-description">{e.description}</div>
                  </td>
                  <td>{e.workflowStep}</td>
                  <td>{e.category}</td>
                  <td>{e.aiCapability}</td>
                  <td>
                    <span className={`level-pill ${levelClass(e.complexity)}`}>{e.complexity}</span>
                  </td>
                  <td>
                    <span className={`level-pill ${levelClass(e.businessImpact)}`}>{e.businessImpact}</span>
                  </td>
                  <td>{e.estimatedDevEffort}</td>
                  <td>{e.estimatedHoursSavedPerMonth.toFixed(1)}</td>
                  <td>${e.estimatedAnnualCostSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td>{e.confidenceScore}%</td>
                  <td>
                    <span className={`level-pill ${levelClass(e.priority)}`}>{e.priority}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
