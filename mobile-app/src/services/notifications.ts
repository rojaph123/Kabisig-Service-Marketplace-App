export const notificationTriggers = [
  "new booking request",
  "booking accepted",
  "provider on the way",
  "job in progress",
  "job completed",
  "payment update",
  "new chat message",
  "provider application submitted",
  "provider approved",
  "provider rejected",
  "revision requested",
  "complaint status updated"
] as const;

export function queueNotification(event: (typeof notificationTriggers)[number], userId: string) {
  return {
    queued: true,
    event,
    userId,
    channel: "fcm-ready"
  };
}

