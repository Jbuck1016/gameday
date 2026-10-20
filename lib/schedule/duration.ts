// Game length is an estimate: start + the league's typical duration.
// If a game is still live past its estimate, the bar extends to now + 15 minutes.

export type GameWindow = { start: number; end: number; runningLong: boolean };

export function estimatedEnd(startMs: number, durationMin: number): number {
  return startMs + durationMin * 60_000;
}

export function gameWindow(
  startIso: string,
  durationMin: number,
  liveState: string | null | undefined,
  nowMs = Date.now(),
): GameWindow {
  const start = Date.parse(startIso);
  const est = estimatedEnd(start, durationMin);
  if (liveState === "in" && nowMs > est) {
    return { start, end: nowMs + 15 * 60_000, runningLong: true };
  }
  return { start, end: est, runningLong: false };
}
