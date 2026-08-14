export interface MatchLogEntry {
  matchId: string;
  partnerUserId: string;
  partnerDisplayName: string;
  campusId: string;
  matchedAt: number;
  endedAt?: number;
  leaveReason?: "skip" | "leave" | "disconnect" | "self_skip" | "self_leave";
  reported?: boolean;
}

const STORAGE_KEY = "mezship_match_logs_24h";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getMatchLogs(): MatchLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const logs: MatchLogEntry[] = JSON.parse(raw);
    const now = Date.now();

    // Auto-prune logs older than 24 hours
    const valid = logs.filter((log) => now - log.matchedAt < TTL_MS);
    if (valid.length !== logs.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }
    return valid.sort((a, b) => b.matchedAt - a.matchedAt);
  } catch (e) {
    console.error("Failed to read match logs:", e);
    return [];
  }
}

export function saveMatchLog(entry: MatchLogEntry): void {
  if (typeof window === "undefined") return;
  try {
    const logs = getMatchLogs();
    const filtered = logs.filter((l) => l.matchId !== entry.matchId);
    filtered.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch (e) {
    console.error("Failed to save match log:", e);
  }
}

export function updateMatchLogEnd(
  matchId: string,
  leaveReason?: "skip" | "leave" | "disconnect" | "self_skip" | "self_leave"
): void {
  if (typeof window === "undefined") return;
  try {
    const logs = getMatchLogs();
    const target = logs.find((l) => l.matchId === matchId);
    if (target) {
      target.endedAt = Date.now();
      if (leaveReason) target.leaveReason = leaveReason;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }
  } catch (e) {
    console.error("Failed to update match log:", e);
  }
}

export function markMatchReported(matchId: string): void {
  if (typeof window === "undefined") return;
  try {
    const logs = getMatchLogs();
    const target = logs.find((l) => l.matchId === matchId);
    if (target) {
      target.reported = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }
  } catch (e) {
    console.error("Failed to mark match reported:", e);
  }
}

export function clearMatchLogs(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
