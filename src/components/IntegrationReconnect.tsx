import React, { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./IntegrationPrograms.css";
const nineMonthsAgo = () => {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - 9);
  return date.toISOString().slice(0, 10);
};
export default function IntegrationReconnect() {
  const { user } = useAuth(),
    actor = useRef(user?.id),
    scope = useRef("");
  actor.current = user?.id;
  const [data, setData] = useState<any>(),
    [before, setBefore] = useState(nineMonthsAgo),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [permission, setPermission] = useState(false),
    [doNotContact, setDoNotContact] = useState(false),
    [evidence, setEvidence] = useState(""),
    [date, setDate] = useState(""),
    [contactEvidence, setContactEvidence] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  scope.current = String(user?.id) + "|" + before;
  const load = async () => {
    const owner = actor.current,
      key = scope.current;
    const r = await api.get("/integration/reconnect?before=" + before);
    if (owner === actor.current && key === scope.current) setData(r.data);
  };
  useEffect(() => {
    let live = true;
    setData(undefined);
    setSelected("");
    setEvidence("");
    setError("");
    load().catch((e) => {
      if (live) setError(e.response?.data?.message || e.message);
    });
    return () => {
      live = false;
    };
  }, [user?.id, before]);
  const row = data?.rows.find((r: any) => r.clientId === selected);
  useEffect(() => {
    setPermission(row?.permission.reconnectEmail || false);
    setDoNotContact(row?.permission.doNotContact || false);
    setEvidence("");
    setDate("");
    setContactEvidence("");
  }, [selected, row?.permission.revision, row?.outreach?.revision]);
  const run = async (fn: () => Promise<void>, changed = true) => {
    const owner = actor.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (owner === actor.current) {
        await load();
        if (changed) setNotice("Review recorded. No message sent.");
      }
    } catch (e: any) {
      if (owner === actor.current)
        setError(e.response?.data?.message || e.message);
    } finally {
      if (owner === actor.current) setBusy(false);
    }
  };
  return (
    <section className="integration-programs integration-care">
      <h3>Past-client reconnection</h3>
      <p>
        Review people who returned some time ago, what contact actually happened
        and what support remains promised. Email delivery alone does not count
        as meaningful contact.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <label>
        Latest retreat ended on or before
        <input
          type="date"
          value={before}
          onChange={(e) => setBefore(e.target.value)}
        />
      </label>
      <label>
        Find client
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <button disabled={busy} onClick={() => run(async () => {}, false)}>
        Refresh reviewed cohort
      </button>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Client / latest completed retreat</th>
              <th>Meaningful contact / outbound receipt</th>
              <th>Outstanding support</th>
              <th>Permission / suppression</th>
              <th>Reconnection</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows
              .filter((r: any) =>
                [r.name, r.email, r.retreatName]
                  .join(" ")
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((r: any) => (
                <tr key={r.clientId}>
                  <td>
                    <button onClick={() => setSelected(r.clientId)}>
                      {r.name || r.clientId}
                    </button>
                    <p>
                      {r.email || "No valid address"} ·{" "}
                      {r.language?.toUpperCase()}
                    </p>
                    <p>
                      {r.retreatName} · {r.homecomingDate}
                    </p>
                  </td>
                  <td>
                    <p>
                      Meaningful:{" "}
                      {r.lastMeaningfulContactAt
                        ? new Date(
                            r.lastMeaningfulContactAt,
                          ).toLocaleDateString()
                        : "Unknown / none recorded"}
                    </p>
                    <p>
                      Outbound only:{" "}
                      {r.lastOutboundAt
                        ? new Date(r.lastOutboundAt).toLocaleDateString()
                        : "None recorded"}
                    </p>
                  </td>
                  <td>
                    {r.outstanding.length
                      ? r.outstanding.map((s: any) => (
                          <p key={s.key}>
                            {s.title} · {s.owner || "No owner"} ·{" "}
                            {s.dueDate || "No deadline"}
                          </p>
                        ))
                      : "No outstanding recorded promise"}
                  </td>
                  <td>
                    {r.suppression.length
                      ? r.suppression.map((reason: string) => (
                          <p key={reason}>{reason}</p>
                        ))
                      : "Explicit permission recorded"}
                    <p>{r.permission.evidence}</p>
                  </td>
                  <td>
                    {r.outreach ? (
                      <>
                        <p>
                          {r.outreach.status} ·{" "}
                          {r.outreach.owner || "Unassigned"}
                        </p>
                        <p>
                          {r.outreach.offer
                            ? "Explicit legacy offer recorded"
                            : "No automatic enrollment or session entitlement"}
                        </p>
                      </>
                    ) : (
                      <p>No reconnection campaign recorded</p>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {row && (
        <details open>
          <summary>Review {row.name}</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api.post(
                  "/integration/reconnect/" + row.clientId + "/permission",
                  {
                    expectedRevision: row.permission.revision,
                    reconnectEmail: permission,
                    doNotContact,
                    evidence,
                  },
                );
              });
            }}
          >
            <label>
              <input
                disabled={busy || user?.readOnly}
                type="checkbox"
                checked={permission}
                onChange={(e) => setPermission(e.target.checked)}
              />
              Explicit reconnection email permission
            </label>
            <label>
              <input
                disabled={busy || user?.readOnly}
                type="checkbox"
                checked={doNotContact}
                onChange={(e) => setDoNotContact(e.target.checked)}
              />
              Do not contact
            </label>
            <label>
              Permission / opt-out source evidence
              <textarea
                required
                maxLength={4000}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
              />
            </label>
            <button disabled={busy || user?.readOnly || !evidence.trim()}>
              Record permission review
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api.post(
                  "/integration/reconnect/" + row.clientId + "/contact",
                  {
                    expectedRevision: row.outreach?.revision || 0,
                    date,
                    evidence: contactEvidence,
                  },
                );
              });
            }}
          >
            <label>
              Actual meaningful-contact date
              <input
                required
                type="date"
                value={date}
                max={data.today}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Human contact evidence
              <textarea
                required
                maxLength={4000}
                value={contactEvidence}
                onChange={(e) => setContactEvidence(e.target.value)}
              />
            </label>
            <button
              disabled={
                busy || user?.readOnly || !date || !contactEvidence.trim()
              }
            >
              Record actual contact
            </button>
          </form>
        </details>
      )}
    </section>
  );
}
