export type WebSocketClientMessage =
  | { type: "join_queue"; userId: string; displayName: string; lat: number; lng: number; campusIds: string[]; radius: number }
  | { type: "leave_queue"; userId: string }
  | { type: "message"; text: string }
  | { type: "skip" }
  | { type: "leave" };

export type WebSocketServerMessage =
  | { type: "queue_joined"; message: string; queuedAt: number }
  | { type: "queue_left" }
  | { type: "match_found"; matchId: string; campusId: string; distanceMeters: number; partner: { userId: string; displayName: string } }
  | { type: "chat_ready"; matchId: string; userId: string }
  | { type: "partner_connected"; message: string }
  | { type: "message"; id: string; senderId: string; text: string; timestamp: number }
  | { type: "partner_skipped"; message: string }
  | { type: "error"; message: string };

export enum ReportReason {
  HARASSMENT = "HARASSMENT",
  SPAM = "SPAM",
  INAPPROPRIATE_BEHAVIOR = "INAPPROPRIATE_BEHAVIOR",
  THREATENING_BEHAVIOR = "THREATENING_BEHAVIOR",
  IMPERSONATION = "IMPERSONATION",
  OTHER = "OTHER",
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  [ReportReason.HARASSMENT]: "Harassment or abuse",
  [ReportReason.SPAM]: "Spam or advertising",
  [ReportReason.INAPPROPRIATE_BEHAVIOR]: "Sexual or inappropriate behavior",
  [ReportReason.THREATENING_BEHAVIOR]: "Threatening behavior",
  [ReportReason.IMPERSONATION]: "Impersonation",
  [ReportReason.OTHER]: "Other",
};
