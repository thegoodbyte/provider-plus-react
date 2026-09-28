import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, communicationsApi } from "../services/api";
const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Prague",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const calendar = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        dateStyle: "medium",
      }).format(new Date(value))
    : "—";
const state = (value: string) =>
  ({
    not_applied: "Preview · defaults not applied",
    not_generated: "Not generated",
    paused: "Paused",
    generated: "Deliveries generated",
    test_sent: "Test only · client not emailed",
  })[value] || value.replaceAll("_", " ");
export function AnnouncementDateExample({
  retreatId,
  timing,
  days,
  sendTime,
}: {
  retreatId?: string;
  timing: string;
  days: number;
  sendTime: string;
}) {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    const timer = setTimeout(
      () =>
        api
          .post("/announcements/date-preview", {
            retreatId,
            timing,
            days,
            sendTime,
          })
          .then((r) => {
            if (active) setResult(r.data);
          })
          .catch((e) => {
            if (active)
              setError(
                e.response?.data?.message || "Unable to calculate example.",
              );
          }),
      250,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [retreatId, timing, days, sendTime]);
  return (
    <aside className="announcement-help" aria-live="polite">
      {error ||
        (!result ? (
          "Calculating example…"
        ) : !result.retreat ? (
          result.message
        ) : (
          <>
            <strong>Example: {result.retreat.name}</strong> ·{" "}
            {timing === "after_end" ? "ends" : "starts"}{" "}
            {calendar(
              timing === "after_end"
                ? result.retreat.endDate
                : result.retreat.startDate,
            )}{" "}
            → sends {date(result.scheduledFor)} (Prague time).{" "}
            {result.past && <strong>This send time is in the past. </strong>}
            Calculated preview; saving a default does not apply it to retreats.
          </>
        ))}
    </aside>
  );
}
export default function AnnouncementSchedules({
  retreatId,
}: {
  retreatId?: string;
}) {
  const [selected, setSelected] = useState(retreatId || "");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [email, setEmail] = useState<any>(null);
  useEffect(() => {
    setSelected(retreatId || "");
  }, [retreatId]);
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    api
      .get("/announcements/schedule", {
        params: { retreatId: selected || undefined },
      })
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active)
          setError(
            e.response?.data?.message || "Unable to load delivery schedules.",
          );
      });
    return () => {
      active = false;
    };
  }, [selected, reload]);
  const showEmail = async (id: string) => {
    try {
      const r = await communicationsApi.getSentEmail(id);
      setEmail(r.data);
    } catch {
      setError("Unable to load email history.");
    }
  };
  return (
    <section className="space-y-4 py-4">
      <h2 className="text-xl font-semibold">Scheduled deliveries</h2>
      <p>
        Announcement dates and recipient history. Final-payment reminders use
        their separate payment scheduler. Viewing this page does not generate or
        send emails.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="border rounded px-3 py-2"
        onClick={() => setReload((x) => x + 1)}
      >
        Refresh view
      </button>
      {!data ? (
        <p>Loading schedules…</p>
      ) : (
        <>
          {!retreatId && (
            <label className="block">
              Retreat
              <select
                className="block w-full rounded border p-2"
                value={selected || data.retreat?._id || ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                {data.retreats.map((r: any) => (
                  <option key={r._id} value={r._id}>
                    {r.name} · {calendar(r.startDate)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!data.retreat ? (
            <p>No upcoming retreats are available.</p>
          ) : (
            <>
              <p>
                <strong>{data.retreat.name}</strong> ·{" "}
                {calendar(data.retreat.startDate)} –{" "}
                {calendar(data.retreat.endDate)} · Europe/Prague
              </p>
              <p>
                Retreat automation:{" "}
                {data.settings?.enabled ? "enabled" : "paused"} · Worker:{" "}
                {data.worker?.enabled ? "enabled" : "paused/unavailable"} · Last
                completed run: {date(data.worker?.lastFinishedAt)}
              </p>
              {data.worker?.lastError && (
                <p role="alert">Worker: {data.worker.lastError}</p>
              )}
              <Link
                className="underline"
                to={`/admin/retreats/${data.retreat._id}/announcements`}
              >
                Open retreat announcements
              </Link>
              {!data.rows.length && (
                <p>No announcement rules have been configured.</p>
              )}
              {data.rows.map((row: any) => (
                <details key={row.ruleId} className="rounded border p-4">
                  <summary className="cursor-pointer">
                    <strong>{row.title}</strong> · {row.days} days{" "}
                    {row.timing === "before_start"
                      ? "before arrival"
                      : "after departure"}{" "}
                    · {date(row.scheduledFor)} · {state(row.state)} ·{" "}
                    {row.generatedDeliveries} deliveries /{" "}
                    {row.eligibleRecipients} eligible bookings{" "}
                    {row.differsFromDefault && (
                      <strong>· Differs from current default</strong>
                    )}
                  </summary>
                  {row.schedulingError && (
                    <p role="alert">{row.schedulingError}</p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th>Participant / booking</th>
                          <th>Language</th>
                          <th>Scheduled</th>
                          <th>Status</th>
                          <th>Sent / attempted</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.recipients.map((p: any) => (
                          <tr className="border-t" key={p.clientId}>
                            <td>
                              <Link
                                className="underline"
                                to={`/admin/bookings/${p.bookingId}`}
                              >
                                {p.name}
                              </Link>
                            </td>
                            <td>{p.language || "—"}</td>
                            <td>{date(p.scheduledFor)}</td>
                            <td>{state(p.status)}</td>
                            <td>{date(p.executedAt)}</td>
                            <td>
                              {p.lastError}
                              {p.sentEmailId && (
                                <button
                                  className="underline block"
                                  onClick={() => showEmail(p.sentEmailId)}
                                >
                                  Email history
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </>
          )}
        </>
      )}
      {email && (
        <section className="rounded border p-4" aria-label="Email history">
          <button className="underline" onClick={() => setEmail(null)}>
            Close email history
          </button>
          <h3>{email.subject}</h3>
          <p>
            {email.status} · {date(email.sentAt || email.createdAt)}
          </p>
          <p>{email.errorMessage}</p>
          <pre className="whitespace-pre-wrap">
            {email.bodyText ||
              email.text ||
              "Open Communications for full message details."}
          </pre>
        </section>
      )}
    </section>
  );
}
