import React, { useEffect, useState } from "react";
import AccommodationSelect from "./AccommodationSelect";
import {
  PaymentAccommodationInventory,
  roomInventoryApi,
} from "../services/roomInventoryApi";

export default function PaymentAccommodation({
  retreatId,
  clientId,
  value,
  onChange,
}: {
  retreatId: string;
  clientId: string;
  value?: string;
  onChange: (key: string, legacy: string) => void;
}) {
  const [inventory, setInventory] =
    useState<PaymentAccommodationInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, refresh] = useState(0);
  useEffect(() => {
    let current = true;
    setInventory(null);
    setError("");
    setLoading(Boolean(retreatId));
    if (retreatId)
      roomInventoryApi
        .paymentAccommodation(retreatId)
        .then(({ data }) => {
          if (current) setInventory(data);
        })
        .catch(() => {
          if (current)
            setError(
              "Room availability could not be checked. Retry before agreeing accommodation.",
            );
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    return () => {
      current = false;
    };
  }, [retreatId, revision]);
  const descriptions = Object.fromEntries(
    (inventory?.options || []).map((option) => [
      option.key,
      !option.supported
        ? "not offered by this house"
        : option.availableUnits === null
          ? "availability unverified"
          : `${option.availableUnits} ${option.unit} available`,
    ]),
  );
  const offered = inventory
    ? inventory.options.filter((option) => option.supported)
    : [];
  const selected = inventory?.options.find((option) => option.key === value);
  return (
    <section aria-label="Retreat accommodation" className="space-y-3">
      <AccommodationSelect
        clientId={clientId}
        value={value}
        onChange={onChange}
        offeredOptions={offered}
        optionDescriptions={descriptions}
        disabled={!retreatId || loading || Boolean(error)}
      />
      {!retreatId && (
        <p className="text-sm text-slate-600">
          Select a retreat to see its house rooms.
        </p>
      )}
      {loading && <p role="status">Checking house rooms…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {retreatId && (
        <button
          type="button"
          onClick={() => refresh((n) => n + 1)}
          disabled={loading}
          className="text-sm text-blue-700 underline"
        >
          Refresh room availability
        </button>
      )}
      {inventory && (
        <>
          <p className="text-sm font-semibold">
            House: {inventory.house?.name || "No house selected"}
          </p>
          {!inventory.configured && (
            <p role="status" className="text-sm text-amber-800">
              {inventory.houseChanged
                ? "The house configuration has changed. Review the retreat room setup before confirming availability."
                : "Retreat rooms are not configured. House rooms are shown as a preview; availability is unverified."}
            </p>
          )}
          {inventory.unallocatedConfirmed > 0 && (
            <p role="status" className="text-sm text-amber-800">
              {inventory.unallocatedConfirmed} confirmed guests still need room
              allocation. Free beds shown below are not a promise of
              availability.
            </p>
          )}
          {selected?.availableUnits === 0 && (
            <p role="status" className="text-sm text-amber-800">
              The selected accommodation currently has no availability. Review
              the room plan before making a commitment.
            </p>
          )}
          {value && selected && !selected.supported && (
            <p role="status" className="text-sm text-amber-800">
              The saved accommodation is not offered by this house. Its existing
              agreement is retained until you explicitly change it.
            </p>
          )}
          {inventory.rooms.length > 0 ? (
            <ul className="space-y-2" aria-label="House room availability">
              {inventory.rooms.map((room) => (
                <li
                  key={room.roomId}
                  className="rounded-md border border-slate-200 p-3 text-sm"
                >
                  <strong>{room.name}</strong>
                  {room.floor && <span> · {room.floor}</span>}
                  <p>
                    {room.hasBathroom ? "Private bathroom" : "Shared bathroom"}{" "}
                    ·{" "}
                    {room.beds === null
                      ? "Bed count unconfigured"
                      : `${room.beds} beds`}
                  </p>
                  <p>
                    {room.status === "unavailable"
                      ? "Unavailable / blocked"
                      : room.freeBeds === null
                        ? "Availability unverified"
                        : room.exclusiveUse && room.occupied > 0
                          ? "Taken for private use"
                          : room.occupied > 0
                            ? `${room.occupied} occupants · ${room.freeBeds} free beds`
                            : `Available · ${room.freeBeds} free beds`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">
              No rooms configured for this house.
            </p>
          )}
          <a
            href={`/retreats/${retreatId}/rooms`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-700 underline"
          >
            Open retreat room plan
          </a>
          <p className="text-xs text-slate-600">
            A payment request records the accommodation agreement; it does not
            reserve a room. Assign rooms to confirmed bookings in the retreat
            Rooms tab. Availability covers the retreat dates and includes
            overlapping retreats.
          </p>
        </>
      )}
    </section>
  );
}
