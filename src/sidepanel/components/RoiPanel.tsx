import { useEffect, useState } from "react";
import type { Opportunity } from "../../types";
import { computeRoi } from "../../reconstruct/roi";
import { getHourlyCost, setHourlyCost } from "../../lib/storage";

export default function RoiPanel({ opportunities }: { opportunities: Opportunity[] }) {
  const [hourlyCost, setHourlyCostState] = useState<number | null>(null);

  useEffect(() => {
    getHourlyCost().then(setHourlyCostState);
  }, []);

  if (hourlyCost === null) return null;

  const roi = computeRoi(opportunities, hourlyCost);

  async function updateHourlyCost(value: number) {
    setHourlyCostState(value);
    await setHourlyCost(value);
  }

  return (
    <div className="roi-panel">
      <div className="analysis-eyebrow muted">ROI tracker</div>
      <div className="roi-stats">
        <div className="roi-stat">
          <span className="roi-value">{roi.shippedCount}</span>
          <span className="muted">shipped</span>
        </div>
        <div className="roi-stat">
          <span className="roi-value">{roi.hoursSaved.toFixed(1)}</span>
          <span className="muted">hrs/month saved</span>
        </div>
        <div className="roi-stat">
          <span className="roi-value">${roi.moneySaved.toFixed(0)}</span>
          <span className="muted">saved/month</span>
        </div>
        <div className="roi-stat">
          <span className="roi-value">{roi.estimateVsActualPct.toFixed(0)}%</span>
          <span className="muted">estimate vs. actual</span>
        </div>
      </div>
      <label className="analysis-flabel muted" htmlFor="hourly-cost">
        Hourly cost assumption ($/hr, used for money saved)
      </label>
      <input
        id="hourly-cost"
        type="number"
        min={0}
        className="roi-hourly-cost-input"
        value={hourlyCost}
        onChange={(e) => updateHourlyCost(Number(e.target.value) || 0)}
      />
    </div>
  );
}
