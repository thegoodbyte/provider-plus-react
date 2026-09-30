import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { roomInventoryApi } from "../services/roomInventoryApi";
import { authService } from "../services/authService";
export default function RetreatRoomsTab({ retreatId }: { retreatId: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [table, setTable] = useState(false);
  const [setup, setSetup] = useState<any>(null);
  const [edit, setEdit] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const canEdit = ["admin", "medical_staff", "user"].includes(
    authService.getUser()?.role || "",
  );
  const load = useCallback(async () => {
    const result = await roomInventoryApi.view(retreatId);
    setData(result.data);
  }, [retreatId]);
  useEffect(() => {
    setData(null);
    setEdit(null);
    setSetup(null);
    let active = true;
    roomInventoryApi
      .view(retreatId)
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch(() => {
        if (active) setError("Could not load room availability.");
      });
    return () => {
      active = false;
    };
  }, [retreatId]);
  const work = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || "Could not save the room change.");
    } finally {
      setBusy(false);
    }
  };
  const select = (person: any) => {
    setEdit({
      bookingId: person._id,
      name: person.name,
      roomId: person.roomId || "",
      roomStayStart: String(person.roomStayStart || data.startDate || "").slice(
        0,
        10,
      ),
      roomStayEnd: String(person.roomStayEnd || data.endDate || "").slice(
        0,
        10,
      ),
      accommodationKey:
        person.accommodationKey === "unspecified"
          ? ""
          : person.accommodationKey,
      expectedUpdatedAt: person.updatedAt,
      reason: "",
      adjustment: "",
    });
    setQuote(null);
    setError("");
  };
  const body = () => ({
    ...edit,
    adjustment: edit.adjustment === "" ? undefined : Number(edit.adjustment),
  });
  const preview = () =>
    work(async () => {
      const result = await roomInventoryApi.quote(edit.bookingId, body());
      setQuote(result.data);
    });
  const save = () =>
    work(async () => {
      await roomInventoryApi.assign(edit.bookingId, body());
      setEdit(null);
      setQuote(null);
    });
  const update = (values: any) => {
    setEdit({ ...edit, ...values });
    setQuote(null);
  };
  if (!data)
    return (
      <div>{error ? <p role="alert">{error}</p> : <p>Loading rooms…</p>}</div>
    );
  const floors = Array.from(
    new Set<string>(
      data.rooms.map((room: any) => room.floor || "Floor not set"),
    ),
  );
  const person = (p: any) => (
    <span key={p._id} className="block py-1">
      <Link className="text-blue-700 underline" to={`/admin/bookings/${p._id}`}>
        {p.name}
      </Link>{" "}
      <small>
        #{p.bookingNumber} · {p.accommodationLabel || p.accommodationKey}
      </small>{" "}
      {canEdit && (
        <button
          type="button"
          className="text-teal-700 underline ml-2"
          onClick={() => select(p)}
        >
          Move / change
        </button>
      )}
    </span>
  );
  return (
    <section className="space-y-5 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">
            Rooms · {data.house?.name || "No house selected"}
          </h2>
          <p>
            Stay dates default to the whole retreat. A private booking reserves
            the entire bedroom.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="border rounded px-3 py-2"
            onClick={() => setTable(!table)}
          >
            {table ? "Room cards" : "Table view"}
          </button>
          <button
            className="border rounded px-3 py-2"
            onClick={() => work(load)}
            disabled={busy}
          >
            Refresh
          </button>
          {canEdit && data.configured && (
            <button
              className="border rounded px-3 py-2"
              onClick={() => setSetup({ rooms: data.rooms, rates: data.rates })}
            >
              Configure retreat rooms
            </button>
          )}
          <Link className="border rounded px-3 py-2" to="/admin/houses">
            Manage house rooms
          </Link>
        </div>
      </header>
      {error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3">
          {error}
        </p>
      )}
      {!data.configured && (
        <div className="rounded border p-5">
          <p>
            Set up this retreat’s rooms from its house. Existing bedroom names
            are kept; bed counts must be configured before assignment.
          </p>
          {canEdit && (
            <button
              disabled={busy || !data.house}
              className="rounded bg-teal-700 px-4 py-2 text-white"
              onClick={() =>
                work(() =>
                  roomInventoryApi.configure(retreatId, { fromHouse: true }),
                )
              }
            >
              Use house room setup
            </button>
          )}
        </div>
      )}
      {data.houseChanged && (
        <p className="rounded bg-amber-50 border border-amber-200 p-3">
          House configuration differs from this retreat’s saved room setup.
          Review it explicitly; occupied rooms are not changed automatically.
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        <strong>{data.availableToSell ?? 0} places available to sell</strong>
        <span>
          {data.rooms.reduce(
            (sum: number, room: any) => sum + room.freeBeds,
            0,
          )}{" "}
          physically free beds
        </span>
        <span>
          {
            data.rooms.filter(
              (r: any) =>
                r.freeBeds > 0 &&
                r.use !== "shared" &&
                !r.occupants.length &&
                !r.externalOccupants.length,
            ).length
          }{" "}
          empty/flexible private-room candidates
        </span>
        <span>
          {data.unallocatedConfirmed} confirmed guests still need a room
        </span>
        <span>
          {data.pendingPreferences} pending/conditional bookings do not reserve
          beds
        </span>
      </div>
      <p className="text-sm text-slate-600">
        Free beds are not all available to sell while confirmed guests remain
        unassigned. Check their accommodation requirements before accepting
        another booking. Existing legacy assignments are shown below for review.
      </p>
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Floor / room</th>
                <th>Bathroom</th>
                <th>Use</th>
                <th>Occupants</th>
                <th>Free beds</th>
              </tr>
            </thead>
            <tbody>
              {data.rooms.map((room: any) => (
                <tr key={room.roomId} className="border-t">
                  <td>
                    {room.floor} / {room.name}
                  </td>
                  <td>
                    {room.hasBathroom ? "Private to room" : "Shared"}{" "}
                    {room.bathroomName}
                  </td>
                  <td>{room.use}</td>
                  <td>
                    {room.occupants.map(person)}
                    {room.externalOccupants.length > 0 && (
                      <p>Occupied by overlapping retreat</p>
                    )}
                  </td>
                  <td>{room.freeBeds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        floors.map((floor) => (
          <section key={floor}>
            <h3 className="text-lg font-semibold mb-3">{floor}</h3>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.rooms
                .filter((r: any) => (r.floor || "Floor not set") === floor)
                .map((room: any) => (
                  <article
                    className={`rounded-xl border p-4 ${room.freeBeds ? "bg-white" : "bg-slate-100"}`}
                    key={room.roomId}
                  >
                    <h4 className="font-semibold text-lg">{room.name}</h4>
                    <p>
                      {room.beds ?? "Unconfigured"} beds ·{" "}
                      {room.hasBathroom
                        ? "Private bathroom"
                        : "Shared bathroom"}{" "}
                      {room.bathroomName}
                    </p>
                    <p className="text-sm">
                      {room.use} ·{" "}
                      {room.active === false
                        ? "Archived"
                        : `${room.freeBeds} free beds`}
                    </p>
                    <p className="text-sm text-slate-600">{room.notes}</p>
                    <div
                      className="my-3 grid grid-cols-2 gap-2"
                      aria-label={`${room.name} bed places`}
                    >
                      {Array.from(
                        { length: Number(room.beds || 0) },
                        (_, index) => {
                          const occupants = [
                            ...room.occupants,
                            ...room.externalOccupants,
                          ];
                          const blocked =
                            room.use === "blocked" ||
                            room.active === false ||
                            (room.exclusiveUse && occupants.length > 0);
                          return (
                            <div
                              key={index}
                              className={`rounded border p-2 text-sm ${occupants[index] || blocked ? "bg-slate-100" : "bg-teal-50"}`}
                            >
                              <strong className="block">Bed {index + 1}</strong>
                              {occupants[index]?.name ||
                                (blocked
                                  ? "Reserved / unavailable"
                                  : "Unoccupied")}
                            </div>
                          );
                        },
                      )}
                    </div>
                    <div className="my-3">
                      {room.occupants.map(person)}
                      {room.externalOccupants.map((p: any) => (
                        <p key={p._id}>
                          Other retreat: {p.name} (#{p.bookingNumber})
                        </p>
                      ))}
                    </div>
                    {!room.occupants.length &&
                      !room.externalOccupants.length && (
                        <p className="text-slate-500">No occupants</p>
                      )}
                  </article>
                ))}
            </div>
          </section>
        ))
      )}
      <section className="rounded border p-4">
        <h3 className="text-lg font-semibold">Unassigned guests</h3>
        {!data.unassigned.length ? (
          <p>All bookings are allocated.</p>
        ) : (
          data.unassigned.map((p: any) => (
            <div key={p._id} className="border-b py-2">
              {person(p)}
              <small>
                {p.status}
                {p.roomNumber ? ` · Legacy assignment: ${p.roomNumber}` : ""}
              </small>
              {p.history?.length > 0 && (
                <details>
                  <summary>Allocation history</summary>
                  {p.history.map((h: any, i: number) => (
                    <p key={i}>
                      {String(h.at).slice(0, 19)} · {h.actor} ·{" "}
                      {h.reason ||
                        `${h.fromRoomId || "Unassigned"} → ${h.toRoomId || "Unassigned"}`}{" "}
                      · {h.oldTotal} → {h.newTotal}
                    </p>
                  ))}
                </details>
              )}
            </div>
          ))
        )}
      </section>
      {setup && (
        <section
          className="rounded border bg-white p-4 space-y-4"
          aria-label="Retreat room configuration"
        >
          <h3 className="text-xl font-semibold">Configure retreat rooms</h3>
          {setup.rooms.map((room: any, index: number) => (
            <div
              key={room.roomId}
              className="flex flex-wrap gap-3 items-center"
            >
              <strong>{room.name}</strong>
              <label>
                Beds
                <input
                  aria-label={`${room.name} beds`}
                  type="number"
                  min="1"
                  max="20"
                  value={room.beds ?? ""}
                  className="border rounded p-2 w-20 block"
                  onChange={(e) =>
                    setSetup({
                      ...setup,
                      rooms: setup.rooms.map((r: any, i: number) =>
                        i === index
                          ? { ...r, beds: Number(e.target.value) }
                          : r,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Sell as
                <select
                  aria-label={`${room.name} use`}
                  value={room.use}
                  className="border rounded p-2 block"
                  onChange={(e) =>
                    setSetup({
                      ...setup,
                      rooms: setup.rooms.map((r: any, i: number) =>
                        i === index ? { ...r, use: e.target.value } : r,
                      ),
                    })
                  }
                >
                  <option value="flexible">Shared or private</option>
                  <option value="shared">Shared only</option>
                  <option value="private">Private only</option>
                  <option value="blocked">Unavailable / staff</option>
                </select>
              </label>
            </div>
          ))}
          <h4 className="font-semibold">Retreat price adjustments</h4>
          <p>
            Blank uses the configured default. A negative amount is a discount.
          </p>
          {data.options.map((option: any) => (
            <div key={option.key} className="flex flex-wrap gap-2">
              <strong>{option.labels.en}</strong>
              {["EUR", "USD", "CZK", "PLN"].map((currency) => (
                <label key={currency}>
                  {currency}
                  <input
                    type="number"
                    step="0.01"
                    className="border rounded p-2 block w-28"
                    value={setup.rates[option.key]?.[currency] ?? ""}
                    onChange={(e) => {
                      const rates = {
                        ...setup.rates,
                        [option.key]: { ...setup.rates[option.key] },
                      };
                      if (e.target.value === "")
                        delete rates[option.key][currency];
                      else rates[option.key][currency] = Number(e.target.value);
                      setSetup({ ...setup, rates });
                    }}
                  />
                </label>
              ))}
            </div>
          ))}
          <button
            disabled={busy}
            className="rounded bg-teal-700 text-white px-4 py-2"
            onClick={() =>
              work(async () => {
                await roomInventoryApi.configure(retreatId, setup);
                setSetup(null);
              })
            }
          >
            Save retreat room setup
          </button>{" "}
          <button onClick={() => setSetup(null)}>Cancel</button>
          <div>
            <button
              disabled={busy || data.rooms.some((r: any) => r.occupants.length)}
              className="underline"
              onClick={() =>
                work(async () => {
                  await roomInventoryApi.configure(retreatId, {
                    fromHouse: true,
                  });
                  setSetup(null);
                })
              }
            >
              Replace with current house setup (requires unassigned rooms)
            </button>
          </div>
        </section>
      )}
      {edit && (
        <section
          className="rounded border-2 border-teal-600 bg-white p-5 space-y-4"
          aria-label="Assign accommodation"
        >
          <h3 className="text-xl font-semibold">
            Assign accommodation · {edit.name}
          </h3>
          <label className="block">
            Agreed accommodation
            <select
              className="block w-full border rounded p-2"
              value={edit.accommodationKey}
              onChange={(e) =>
                update({ accommodationKey: e.target.value, adjustment: "" })
              }
            >
              <option value="">Choose accommodation</option>
              {data.options
                .filter((o: any) => o.active || o.key === edit.accommodationKey)
                .map((o: any) => (
                  <option key={o.key} value={o.key}>
                    {o.labels.en}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            Physical room
            <select
              className="block w-full border rounded p-2"
              value={edit.roomId}
              onChange={(e) => update({ roomId: e.target.value })}
            >
              <option value="">Unassigned / release room</option>
              {data.rooms.map((r: any) => (
                <option
                  key={r.roomId}
                  value={r.roomId}
                  disabled={
                    r.active === false ||
                    r.use === "blocked" ||
                    (data.options.find(
                      (o: any) => o.key === edit.accommodationKey,
                    )?.bathroom === "private" &&
                      !r.hasBathroom)
                  }
                >
                  {r.floor} · {r.name} · {r.freeBeds} free ·{" "}
                  {r.hasBathroom ? "private bathroom" : "shared bathroom"}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-4">
            <label>
              Room arrival
              <input
                className="block border rounded p-2"
                type="date"
                value={edit.roomStayStart}
                min={String(data.startDate).slice(0, 10)}
                max={String(data.endDate).slice(0, 10)}
                onChange={(e) => update({ roomStayStart: e.target.value })}
              />
            </label>
            <label>
              Room departure
              <input
                className="block border rounded p-2"
                type="date"
                value={edit.roomStayEnd}
                min={String(data.startDate).slice(0, 10)}
                max={String(data.endDate).slice(0, 10)}
                onChange={(e) => update({ roomStayEnd: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            Override price adjustment (optional)
            <input
              type="number"
              step="0.01"
              className="block border rounded p-2"
              value={edit.adjustment}
              placeholder="Use configured price"
              onChange={(e) => update({ adjustment: e.target.value })}
            />
          </label>
          <label className="block">
            Reason / notes
            <input
              className="block w-full border rounded p-2"
              value={edit.reason}
              onChange={(e) => update({ reason: e.target.value })}
            />
          </label>
          <button
            disabled={busy || !edit.accommodationKey}
            className="rounded border px-4 py-2"
            onClick={preview}
          >
            Review room change
          </button>
          {quote && (
            <div role="status" className="rounded bg-teal-50 p-4">
              <p>
                Total: {quote.oldTotal} → {quote.newTotal} {quote.currency}{" "}
                (change {quote.difference})
              </p>
              <p>
                Remaining balance: {quote.remainingBalance} {quote.currency} ·
                Credit: {quote.credit} {quote.currency}
              </p>
              <p>
                Existing payments stay recorded. Any resulting credit or
                remaining balance is handled through the booking payment plan;
                no automatic refund is sent.
              </p>
              <button
                disabled={busy}
                className="rounded bg-teal-700 text-white px-4 py-2 mt-3"
                onClick={save}
              >
                Confirm room change
              </button>
            </div>
          )}{" "}
          <button
            onClick={() => {
              setEdit(null);
              setQuote(null);
            }}
          >
            Cancel
          </button>
        </section>
      )}
    </section>
  );
}
