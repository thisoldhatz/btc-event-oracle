// lib/timeline.ts
import type { TimelineItem } from "./types";

export interface TimelineEntry extends TimelineItem {
  up: boolean;
  flipped: boolean;
}

export function buildTimeline(items: TimelineItem[]): TimelineEntry[] {
  return items.map((it, i) => {
    const up = it.p_up >= 0.5;
    const older = items[i + 1];
    const flipped = older ? up !== (older.p_up >= 0.5) : false;
    return { ...it, up, flipped };
  });
}
