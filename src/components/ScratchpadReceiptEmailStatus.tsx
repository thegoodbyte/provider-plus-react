import React from "react";
import { Circle, MailCheck } from "lucide-react";
export default function ScratchpadReceiptEmailStatus({
  summary,
}: {
  summary?: { status?: string; sentAt?: string };
}) {
  const status = summary?.status || "unavailable";
  const sentAt = summary?.sentAt && new Date(summary.sentAt);
  const timestamp =
    sentAt && Number.isFinite(sentAt.getTime())
      ? ` · ${sentAt.toLocaleString()}`
      : "";
  const text =
    status === "sent"
      ? `Receipt email sent${timestamp}`
      : status === "not_sent"
        ? "No receipt email recorded for this payment"
        : status === "pending"
          ? "Receipt email queued — not yet confirmed sent"
          : status === "failed"
            ? "Receipt email failed — no successful send recorded"
            : "Receipt email status unavailable";
  const Icon = status === "sent" ? MailCheck : Circle;
  return (
    <span
      role="img"
      aria-label={text}
      title={text}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center align-middle ${status === "sent" ? "text-emerald-700" : status === "pending" ? "text-amber-700" : status === "failed" ? "text-red-700" : "text-slate-400"}`}
    >
      <Icon size={status === "sent" ? 16 : 6} fill={status === "sent" ? "none" : "currentColor"} strokeWidth={status === "sent" ? 2 : 0} aria-hidden="true" />
    </span>
  );
}
