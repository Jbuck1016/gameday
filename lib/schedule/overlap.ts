// Sweep-line overlap detection. Intervals are [start, end): a game ending exactly when
// another starts does not overlap it.

export type Interval = { id: string; start: number; end: number };
export type Segment = { from: number; to: number; ids: string[] };

export function segments(items: Interval[]): Segment[] {
  const valid = items.filter((i) => i.end > i.start);
  const points = Array.from(new Set(valid.flatMap((i) => [i.start, i.end]))).sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let k = 0; k < points.length - 1; k++) {
    const from = points[k];
    const to = points[k + 1];
    const ids = valid
      .filter((i) => i.start < to && i.end > from)
      .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
      .map((i) => i.id);
    if (ids.length) out.push({ from, to, ids });
  }
  return out;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/** Time ranges where 2 or more games are on at once; adjacent ranges with the same games are merged. */
export function overlaps(items: Interval[]): Segment[] {
  const merged: Segment[] = [];
  for (const seg of segments(items)) {
    if (seg.ids.length < 2) continue;
    const last = merged[merged.length - 1];
    if (last && last.to === seg.from && sameSet(last.ids, seg.ids)) {
      last.to = seg.to;
    } else {
      merged.push({ ...seg, ids: [...seg.ids] });
    }
  }
  return merged;
}

export function peakScreens(items: Interval[]): number {
  return segments(items).reduce((m, s) => Math.max(m, s.ids.length), 0);
}
