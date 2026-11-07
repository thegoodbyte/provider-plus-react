import React from "react";
import { Link } from "react-router-dom";
import "./MedicalPreparationWorkspace.css";
export default function PreparationIdentity({
  client,
  booking,
  retreat,
  prefix = "/admin",
}: {
  client: any;
  booking?: any;
  retreat?: any;
  prefix?: string;
}) {
  if (!client?._id) return null;
  return (
    <div className="preparation-identity">
      <Link to={`${prefix}/clients/${client._id}`}>
        Client #{client.display_id} ·{" "}
        {[client.firstName, client.lastName].filter(Boolean).join(" ")}
      </Link>
      {booking?._id && (
        <Link to={`${prefix}/bookings/${booking._id}`}>
          Booking #{booking.bookingNumber}
        </Link>
      )}
      {retreat?._id && (
        <Link to={`${prefix}/retreats/${retreat._id}`}>
          {retreat.code || retreat.retreatCode || retreat.name}
          {retreat.startDate
            ? " · " + String(retreat.startDate).slice(0, 10)
            : ""}
        </Link>
      )}
    </div>
  );
}
