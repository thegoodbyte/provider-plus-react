import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import "./IntegrationPrograms.css";
export default function IntegrationDashboard({
  openCare,
  openCalendar,
}: {
  openCare: (id: string) => void;
  openCalendar: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [settings, setSettings] = useState<any>(null),
    [simulation, setSimulation] = useState<any>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [cohort, setCohort] = useState(""),
    [filter, setFilter] = useState("open");
  const load = async () => {
    const r = await api.get("/integration/operations");
    setData(r.data);
    setSettings(r.data.settings);
  };
  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || e.message));
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <section>
        <p>{error || "Loading follow-up dashboard…"}</p>
      </section>
    );
  const rows = data.actions.filter(
    (a: any) =>
      (!cohort || a.retreatId === cohort) &&
      (!search ||
        `${a.client} ${a.retreat} ${a.owner} ${a.backup}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter === "open" ||
        (filter === "overdue" && a.overdue && a.phase === "active") ||
        (filter === "today" && a.dueToday) ||
        (filter === "week" && a.thisWeek) ||
        (filter === "unassigned" && (!a.owner || !a.backup)) ||
        (filter === "no-next-contact" && a.derived) ||
        (filter === "support" && a.key.startsWith("support:")) ||
        (filter === "failed" &&
          (a.key.startsWith("email:") || a.key.startsWith("delivery:")))),
  );
  const cohorts = [
    ...new Map<string, string>(
      data.actions.map((a: any) => [a.retreatId, a.retreat || a.retreatId]),
    ).entries(),
  ];
  return (
    <section className="integration-programs integration-care">
      <h3>Integration control centre</h3>
      <p>
        Every open promise has a next action. Contact and delivery status are
        separate from client-reported wellbeing.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="program-grid" aria-label="Care totals">
        {Object.entries(data.totals).map(([key, count]) => (
          <div key={key}>
            <strong style={{ fontSize: 26 }}>{String(count)}</strong>
            <p>
              {
                (
                  {
                    overdue: "Overdue active care",
                    unanswered: "Unanswered support tasks",
                    noNextContact: "No scheduled next contact",
                    unusedSessions: "Remaining session promises",
                    availableSessionCredits: "Available granted session credits",
                    sessionBookingResolutions: "Session bookings needing resolution",
                    failedMessages: "Failed delivery tasks",
                    unassigned: "Missing owner or backup",
                    paused: "Paused care plans",
                  } as any
                )[key]
              }
            </p>
          </div>
        ))}
      </div>
      {!!data.personalSessions?.length && <details><summary>Personal session balances and next reservations</summary><div style={{overflowX:'auto'}}><table><thead><tr><th>Client</th><th>Available</th><th>Reserved</th><th>Next appointment</th><th>Access through</th></tr></thead><tbody>{data.personalSessions.map((s:any)=><tr key={s._id}><td>{s.clientName}</td><td>{s.available}</td><td>{s.reserved}</td><td>{s.nextReservation?new Date(s.nextReservation).toLocaleString():'Not reserved'}</td><td>{s.expiresOn}</td></tr>)}</tbody></table></div></details>}
      <div className="program-grid">
        <label>
          Search client or owner{" "}
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Retreat cohort{" "}
          <select value={cohort} onChange={(e) => setCohort(e.target.value)}>
            <option value="">All retreats</option>
            {cohorts.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Care queue{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">All open</option>
            <option value="overdue">Overdue active care</option>
            <option value="today">Due today</option>
            <option value="week">Next seven days</option>
            <option value="support">Support requests</option>
            <option value="failed">Failed messages</option>
            <option value="unassigned">Unassigned</option>
            <option value="no-next-contact">No next contact</option>
          </select>
        </label>
      </div>
      <button type="button" disabled={busy} onClick={() => run(load)}>
        Refresh dashboard
      </button>
      <div className="program-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client / retreat</th>
              <th>Next action</th>
              <th>Due / care phase</th>
              <th>Owner / backup</th>
              <th>Work on it</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a: any) => (
              <tr key={`${a.caseId}:${a.key}`}>
                <td>
                  {a.client}
                  <small>{a.retreat}</small>
                </td>
                <td>
                  {a.title}
                  <small>{a.condition}</small>
                </td>
                <td>
                  {a.dueDate}
                  <small>
                    {a.phase}{" "}
                    {a.overdue && a.phase === "active"
                      ? `· ${a.daysLate} days overdue`
                      : ""}
                  </small>
                </td>
                <td>
                  {a.owner || "Unassigned"}
                  <small>Backup: {a.backup || "Unassigned"}</small>
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      a.derived ? openCalendar() : openCare(a.caseId)
                    }
                  >
                    {a.derived
                      ? "Schedule next contact"
                      : "Assign / complete / defer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>No actions match this view.</p>}
      </div>
      <h4>Confirmed call timeline</h4>
      <button type="button" onClick={openCalendar}>
        Open full calendar
      </button>
      <ul>
        {data.calls
          .filter((c: any) => c.status === "scheduled")
          .map((c: any) => (
            <li key={c._id}>
              {new Date(c.startsAt).toLocaleString(undefined, {
                timeZone: c.timezone || "Europe/Prague",
              })}{" "}
              · {c.title} · {c.participantCount} participants ·{" "}
              {c.wellbeing === "client_reported_concern"
                ? "Client-reported concern — review restricted care"
                : "Wellbeing not assessed by contact status"}
            </li>
          ))}
      </ul>
      <h4>Internal digest and backup escalations</h4>
      {data.worker?.lastError && <p role="alert">{data.worker.lastError}</p>}
      <p>
        Last worker run:{" "}
        {data.worker?.lastFinishedAt
          ? new Date(data.worker.lastFinishedAt).toLocaleString()
          : "Not run yet"}
        . Worker environment: {settings.workerEnabled ? "Enabled" : "Disabled"}.
        Notifications appear as internal Tasks; notification titles contain no
        client details.
      </p>
      <ul>
        {data.alerts.slice(0, 20).map((a: any) => (
          <li key={a._id}>
            {a.subject} · {a.recipient} ·{" "}
            {a.type === "digest"
              ? `${a.counts?.open || 0} open, ${a.counts?.overdue || 0} overdue`
              : `Escalation stage ${a.stage + 1}`}{" "}
            · {a.delivered ? "Internal task created" : "Pending retry"}
          </li>
        ))}
      </ul>
      <details>
        <summary>Response hours and escalation settings</summary>
        <p>
          Ordinary response target: next configured working day. This is not
          emergency monitoring. Review available staff capacity before enabling.
        </p>
        <fieldset disabled={busy}>
          <label>
            Operations enabled{" "}
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  enabled: e.target.checked,
                  capacityReviewed: false,
                })
              }
            />
          </label>
          <label>
            Response timezone{" "}
            <input
              value={settings.timezone}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  timezone: e.target.value,
                  capacityReviewed: false,
                })
              }
            />
          </label>
          <label>
            Working days (0 Sunday–6 Saturday, comma separated){" "}
            <input
              value={settings.workingDays.join(",")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  workingDays: e.target.value.split(",").map(Number),
                  capacityReviewed: false,
                })
              }
            />
          </label>
          <label>
            Response start{" "}
            <input
              type="time"
              value={settings.responseStart}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  responseStart: e.target.value,
                  capacityReviewed: false,
                })
              }
            />
          </label>
          <label>
            Response end{" "}
            <input
              type="time"
              value={settings.responseEnd}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  responseEnd: e.target.value,
                  capacityReviewed: false,
                })
              }
            />
          </label>
          <label>
            Daily internal digest time{" "}
            <input
              type="time"
              value={settings.digestAt}
              onChange={(e) =>
                setSettings({ ...settings, digestAt: e.target.value })
              }
            />
          </label>
          <label>
            Escalation days after deadline (increasing, comma separated){" "}
            <input
              value={settings.escalationDays.join(",")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  escalationDays: e.target.value.split(",").map(Number),
                  capacityReviewed: false,
                })
              }
            />
          </label>
          <label>
            Response capacity reviewed{" "}
            <input
              type="checkbox"
              checked={settings.capacityReviewed}
              onChange={(e) =>
                setSettings({ ...settings, capacityReviewed: e.target.checked })
              }
            />
          </label>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                await api.post("/integration/operations/settings", {
                  ...settings,
                  expectedRevision: settings.revision || 0,
                });
                await load();
              })
            }
          >
            Save operations settings (admin)
          </button>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                setSimulation(
                  (await api.post("/integration/operations/simulate")).data,
                );
              })
            }
          >
            Preview internal alerts
          </button>
          {simulation && (
            <p>
              {simulation.events.length} alerts/digests would be generated. This
              preview created no notifications.
            </p>
          )}
        </fieldset>
      </details>
    </section>
  );
}
