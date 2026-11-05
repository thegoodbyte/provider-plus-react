import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { BookingType } from "../constants/eventTypes";
import { matchingBookingReturnPath } from "../components/BookingEditorPage";
export default function FinanceBookingCreate({
  initial = {},
  onSaved,
}: { initial?: any; onSaved?: (booking: any) => void } = {}) {
  const location = useLocation(),
    navigate = useNavigate(),
    params = new URLSearchParams(location.search);
  const [clients, setClients] = useState<any[]>([]),
    [retreats, setRetreats] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    clientId: initial.clientId || params.get("clientId") || "",
    retreatId: initial.retreatId || params.get("retreatId") || "",
    roomType: initial.roomType || params.get("roomType") || "",
    totalAmount: initial.totalAmount ?? params.get("totalAmount") ?? "",
    currency: initial.currency || params.get("currency") || "PLN",
    bookingType: params.get("bookingType") || BookingType.FULL_RETREAT,
    checkInDate: "",
    checkOutDate: "",
  });
  useEffect(() => {
    let active = true;
    Promise.all([api.get("/clients/booking-options"), api.get("/retreats")])
      .then(([c, r]) => {
        if (active) {
          setClients(c.data || []);
          setRetreats(r.data || []);
          const retreat = r.data.find((v: any) => v._id === form.retreatId);
          if (retreat)
            setForm((current) => ({
              ...current,
              checkInDate: String(retreat.startDate || "").slice(0, 10),
              checkOutDate: String(retreat.endDate || "").slice(0, 10),
            }));
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Booking options unavailable. Reload before creating a booking.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const set = (key: string, value: string) =>
    setForm((current) => {
      if (key === "retreatId") {
        const r = retreats.find((r) => r._id === value);
        return {
          ...current,
          retreatId: value,
          checkInDate: String(r?.startDate || "").slice(0, 10),
          checkOutDate: String(r?.endDate || "").slice(0, 10),
        };
      }
      return { ...current, [key]: value };
    });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/bookings", {
        ...form,
        totalAmount: Number(form.totalAmount),
        registrationDate: new Date().toISOString(),
        status: "pending",
        amountPaid: 0,
        ...(params.get("paymentRequestId")
          ? { paymentRequestId: params.get("paymentRequestId") }
          : {}),
        ...(params.get("ceremonyId")
          ? { ceremonyId: params.get("ceremonyId") }
          : {}),
        ...(params.get("ceremonyNumber")
          ? { ceremonyNumber: Number(params.get("ceremonyNumber")) }
          : {}),
      });
      if (onSaved) {
        onSaved(response.data);
        return;
      }
      const target = matchingBookingReturnPath(
        params.get("returnTo"),
        "/admin",
        response.data._id,
        window.location.origin,
      );
      navigate(target || `/admin/bookings/${response.data._id}`);
    } catch (e: any) {
      setError(
        e.response?.data?.message ||
          "Booking was not created. Check the details and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="finance-context finance-booking-form" onSubmit={save}>
      <h1>Create booking</h1>
      <p>
        Payment and stay details only. Existing booking prerequisites still
        apply.
      </p>
      {error && <p role="alert">{error}</p>}
      <label>
        Client
        <select
          required
          disabled={Boolean(initial.clientId)}
          value={form.clientId}
          onChange={(e) => set("clientId", e.target.value)}
        >
          <option value="">Choose client</option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              #{c.display_id} {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      </label>
      <label>
        Retreat
        <select
          required
          value={form.retreatId}
          onChange={(e) => set("retreatId", e.target.value)}
        >
          <option value="">Choose retreat</option>
          {retreats.map((r) => (
            <option key={r._id} value={r._id}>
              {r.code || r.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Room type
        <select
          required
          value={form.roomType}
          onChange={(e) => set("roomType", e.target.value)}
        >
          <option value="">Choose room type</option>
          <option value="shared">Shared</option>
          <option value="private">Private</option>
          <option value="private_ensuite">Private, private bathroom</option>
        </select>
      </label>
      <label>
        Agreed price
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={form.totalAmount}
          onChange={(e) => set("totalAmount", e.target.value)}
        />
      </label>
      <label>
        Currency
        <select
          value={form.currency}
          onChange={(e) => set("currency", e.target.value)}
        >
          {["PLN", "EUR", "CZK", "USD"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        Check-in
        <input
          required
          type="date"
          value={form.checkInDate}
          onChange={(e) => set("checkInDate", e.target.value)}
        />
      </label>
      <label>
        Check-out
        <input
          required
          type="date"
          value={form.checkOutDate}
          onChange={(e) => set("checkOutDate", e.target.value)}
        />
      </label>
      <button disabled={busy} type="submit">
        {busy ? "Creating…" : "Create booking"}
      </button>
    </form>
  );
}
