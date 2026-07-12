import type { CapturedEvent, Session, Step } from "../types";

const IDLE_GAP_MS = 8_000;

function startsNewStep(prev: CapturedEvent | undefined, event: CapturedEvent): boolean {
  if (!prev) return true;
  if (event.urlPath !== prev.urlPath) return true;
  if (event.domain !== prev.domain) return true;
  if (prev.type === "submit") return true;
  if (event.ts - prev.ts > IDLE_GAP_MS) return true;
  return false;
}

function pickLabel(group: CapturedEvent[]): string {
  for (let i = group.length - 1; i >= 0; i--) {
    if (group[i].element?.label) return group[i].element.label;
  }
  return group[0].element?.role ?? "";
}

// Groups consecutive events on the same screen/path into one step. A new
// step starts only on path change, form submit, domain change, or an idle
// gap greater than 8 seconds.
export function segment(session: Session): Step[] {
  const groups: CapturedEvent[][] = [];
  for (const event of session.events ?? []) {
    const currentGroup = groups[groups.length - 1];
    const prev = currentGroup?.[currentGroup.length - 1];

    if (startsNewStep(prev, event)) {
      groups.push([event]);
    } else {
      currentGroup.push(event);
    }
  }

  return groups.map((group, index) => {
    const first = group[0];
    const last = group[group.length - 1];
    const next = groups[index + 1];
    const endTs = next ? next[0].ts : session.endedAt ?? last.ts;
    return {
      id: first.id,
      order: index,
      ts: first.ts,
      durationMs: Math.max(0, endTs - first.ts),
      domain: first.domain,
      urlPath: first.urlPath,
      label: pickLabel(group),
      events: group,
      isCrossSystem: Boolean(first.crossDomainFrom),
    };
  });
}
