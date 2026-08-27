export interface MessageReplyInfo {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
}

export type WebSocketClientMessage =
  | { type: "join_queue"; userId: string; displayName: string; lat: number; lng: number; radius: number; campusIds?: string[] }
  | { type: "update_location"; lat: number; lng: number; radius?: number }
  | { type: "leave_queue"; userId: string }
  | { type: "message"; text: string; clientMsgId?: string; replyTo?: MessageReplyInfo }
  | { type: "reaction"; messageId: string; emoji: string }
  | { type: "typing_start" }
  | { type: "typing_stop" }
  | { type: "skip" }
  | { type: "leave" }
  | { type: "ping" };

export type WebSocketServerMessage =
  | { type: "queue_joined"; message: string; queuedAt: number; queueCount?: number; onlineCount?: number }
  | { type: "queue_left" }
  | { type: "match_found"; matchId: string; distanceMeters: number; hasPreciseDistance?: boolean; partner: { userId: string; displayName: string }; campusId?: string }
  | { type: "chat_ready"; matchId: string; userId: string }
  | { type: "partner_connected"; message: string }
  | { type: "message"; id: string; senderId: string; text: string; timestamp: number; replyTo?: MessageReplyInfo }
  | { type: "message_ack"; clientMsgId: string; id: string; timestamp: number }
  | { type: "reaction"; messageId: string; emoji: string; senderId: string }
  | { type: "typing_start"; senderId: string }
  | { type: "typing_stop"; senderId: string }
  | { type: "partner_skipped"; message: string; reason?: "skip" | "leave" | "disconnect" }
  | { type: "error"; message: string }
  | { type: "pong"; timestamp: number };

export const ALLOWED_REACTION_EMOJIS = [
  "❤️",
  "😂",
  "😮",
  "😢",
  "😡",
  "👍",
  "👎",
  "🔥",
  "🎉",
  "🥹",
] as const;

export type AllowedReactionEmoji = (typeof ALLOWED_REACTION_EMOJIS)[number];

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
