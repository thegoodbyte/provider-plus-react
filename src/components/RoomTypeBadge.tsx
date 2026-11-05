import React from "react";
import { User, Users, HelpCircle } from "lucide-react";
import "./RoomTypeBadge.css";

/** Saved booking accommodation, independent of bedroom assignment/client preference. */
export default function RoomTypeBadge({
  roomType,
}: {
  roomType?: string | null;
}) {
  const shared = roomType === "shared",
    ensuite = roomType === "private_ensuite";
  const privateRoom = roomType === "private" || ensuite;
  const Icon = shared ? Users : privateRoom ? User : HelpCircle;
  const label = shared ? "Shared" : privateRoom ? "Private" : "Unknown";
  const detail = shared
    ? "Shared room"
    : ensuite
      ? "Private room with private bathroom"
      : privateRoom
        ? "Private room"
        : "Room type unknown";
  return (
    <span
      className={`room-type-badge room-type-badge--${shared ? "shared" : privateRoom ? "private" : "unknown"}`}
      role="img"
      aria-label={detail}
      title={detail}
    >
      <Icon size={16} strokeWidth={1.8} aria-hidden="true" focusable="false" />
      <span aria-hidden="true">
        {label}
        {ensuite ? " · ensuite" : ""}
      </span>
    </span>
  );
}
