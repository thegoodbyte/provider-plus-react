import React, { useCallback, useEffect, useState } from "react";
import { integrationCalendarApi } from "../services/integrationCalendarApi";
import "./IntegrationCalendar.css";
export const pragueInput = (value: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Prague",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
const dayOf = (value: string) => pragueInput(value).slice(0, 10);
const timeOf = (value: string) => pragueInput(value).slice(11);
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value + "T12:00:00Z"));
export const calendarDays = (from: string, to: string) => {
  const dates: string[] = [];
  const date = new Date(from + "T12:00:00Z");
  for (let i = 0; i < 94 && date.toISOString().slice(0, 10) <= to; i++) {
    dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
};
const message = (e: any) =>
  e.response?.data?.message ||
  e.message ||
  "Unable to save the integration call.";
export default function IntegrationCalendar({
  retreatId,
}: {
  retreatId?: string;
}) {
  const [selected, setSelected] = useState(retreatId || "");
  const [range, setRange] = useState({ from: "", to: "" });
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<any>(null);
  const [context, setContext] = useState<any>(null);
  const [view, setView] = useState<"matrix" | "agenda">("matrix");
  const [showCancelled, setShowCancelled] = useState(false);
  const [onlyFollowUp, setOnlyFollowUp] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setSelected(retreatId || "");
    setRange({ from: "", to: "" });
    setEditor(null);
  }, [retreatId]);
  const load = useCallback(async () => {
    const r = await integrationCalendarApi.get({
      retreatId: selected || undefined,
      from: range.from || undefined,
      to: range.to || undefined,
    });
    setData(r.data);
  }, [selected, range]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    integrationCalendarApi
      .get({
        retreatId: selected || undefined,
        from: range.from || undefined,
        to: range.to || undefined,
      })
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [selected, range]);
  const open = async (call?: any, suggestion?: any) => {
    setBusy(true);
    setError("");
    setConflicts([]);
    setNotice("");
    try {
      const callRetreat = call?.retreatId || selected;
      if (!callRetreat) throw new Error("Choose a retreat to schedule a call.");
      const details =
        selected === callRetreat
          ? data
          : (await integrationCalendarApi.get({ retreatId: callRetreat })).data;
      setContext(details);
      const firstDate = suggestion?.date || details.from;
      setEditor(
        call
          ? {
              ...call,
              localStart: pragueInput(call.startsAt),
              durationMinutes: Math.round(
                (new Date(call.endsAt).getTime() -
                  new Date(call.startsAt).getTime()) /
                  60000,
              ),
              clientIds: call.participants.map((p: any) => p.clientId),
              attendance: call.participants,
              expectedUpdatedAt: call.updatedAt,
              allowOverlap: false,
            }
          : {
              requestId: crypto.randomUUID(),
              retreatId: callRetreat,
              kind: "group",
              checkpointNumber: suggestion?.checkpointNumber || "",
              title: suggestion?.title || "Group integration call",
              localStart: firstDate + "T18:00",
              durationMinutes: 60,
              clientIds: details.clients
                .filter((p: any) => !p.archived)
                .map((p: any) => p.clientId),
              meetingUrl: "",
              facilitator: "",
              status: "scheduled",
              notes: "",
              attendance: [],
              allowOverlap: false,
            },
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const change = (patch: any) => {
    setEditor((old: any) => ({
      ...old,
      ...patch,
      allowOverlap: patch.allowOverlap ?? false,
    }));
    if (patch.allowOverlap === undefined) setConflicts([]);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await integrationCalendarApi.save(editor._id, editor);
      setEditor(null);
      setNotice(
        result.data?.syncWarning ||
          "Integration call saved. No invitations or reminders were sent.",
      );
      await load();
    } catch (e: any) {
      setError(message(e));
      setConflicts(e.response?.data?.conflicts || []);
    } finally {
      setBusy(false);
    }
  };
  const updateParticipant = (clientId: string, patch: any) => {
    const old = editor.attendance.find((p: any) => p.clientId === clientId) || {
      clientId,
      attendance: "not_recorded",
      wellbeing: "not_recorded",
      answers: {},
    };
    change({
      attendance: [
        ...editor.attendance.filter((p: any) => p.clientId !== clientId),
        { ...old, ...patch },
      ],
    });
  };
  const event = (call: any) => (
    <button
      type="button"
      className={`integration-calendar-event ${call.kind} ${call.status}`}
      disabled={busy || !!editor}
      onClick={() => open(call)}
      key={call._id}
    >
      <strong>
        {timeOf(call.startsAt)}–{timeOf(call.endsAt)} · {call.title}
      </strong>
      <span>
        {call.retreatName} ·{" "}
        {call.kind === "group"
          ? `${call.participants.length} participants: ${call.participants.map((p: any) => p.name).join(", ")}`
          : call.participants[0]?.name}
      </span>
      <small>
        {call.status} ·{" "}
        {
          call.participants.filter((p: any) => p.attendance === "attended")
            .length
        }{" "}
        attended{" "}
        {call.participants.some((p: any) => p.wellbeing === "needs_follow_up")
          ? "· Follow-up needed"
          : ""}
      </small>
    </button>
  );
  const calls = (data?.calls || []).filter(
    (call: any) =>
      (showCancelled || call.status !== "cancelled") &&
      (!onlyFollowUp ||
        call.participants.some((p: any) => p.wellbeing === "needs_follow_up")),
  );
  const pastDue = calls.filter(
    (call: any) =>
      call.status === "scheduled" &&
      new Date(call.endsAt).getTime() < Date.now(),
  ).length;
  return (
    <section className="integration-calendar">
      <header>
        <div>
          <h2>
            Integration calendar{data?.retreat ? " · " + data.retreat.name : ""}
          </h2>
          <p>
            Six weeks after the retreat. Burgundy = group · Orange = individual.
            All times are Europe/Prague.
          </p>
        </div>
        <button
          type="button"
          disabled={
            !selected ||
            busy ||
            !!editor ||
            !data ||
            data.retreat?.status === "cancelled"
          }
          onClick={() => open()}
        >
          Schedule a call
        </button>
      </header>
      {error && (
        <div role="alert" className="integration-calendar-error">
          {error}{" "}
          {!editor && (
            <button
              type="button"
              onClick={() => {
                setError("");
                load().catch((e) => setError(message(e)));
              }}
            >
              Reload calendar
            </button>
          )}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {!!data?.legacyAppointments?.length && <aside>
        <h3>Appointments from checkpoint notes</h3>
        <p>These earlier appointments have no calendar duration or meeting link. Manage them in Checkpoint notes; they do not reserve a calendar slot.</p>
        <ul>{data.legacyAppointments.map((appointment: any) => <li key={appointment.id}>
          {dateLabel(dayOf(appointment.scheduledAt))} · {timeOf(appointment.scheduledAt)} · {appointment.name} · {appointment.retreatName} · Checkpoint {appointment.checkpointNumber} · {appointment.status}
        </li>)}</ul>
      </aside>}
      <div className="integration-calendar-toolbar">
        {!retreatId && (
          <label>
            Retreat
            <select
              value={selected}
              disabled={busy || !!editor}
              onChange={(e) => {
                setSelected(e.target.value);
                setRange({ from: "", to: "" });
                setEditor(null);
              }}
            >
              <option value="">All retreats · agenda</option>
              {data?.retreats.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          From
          <input
            type="date"
            disabled={busy || !!editor}
            value={range.from || data?.from || ""}
            onChange={(e) => {
              if (e.target.value)
                setRange({
                  ...range,
                  from: e.target.value,
                  to: range.to || data?.to || "",
                });
            }}
          />
        </label>
        <label>
          Through
          <input
            type="date"
            disabled={busy || !!editor}
            value={range.to || data?.to || ""}
            onChange={(e) => {
              if (e.target.value)
                setRange({
                  ...range,
                  from: range.from || data?.from || "",
                  to: e.target.value,
                });
            }}
          />
        </label>
        <button
          type="button"
          disabled={busy || !!editor}
          onClick={() => setRange({ from: "", to: "" })}
        >
          Reset six weeks
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => setView(view === "matrix" ? "agenda" : "matrix")}
          >
            {view === "matrix" ? "Agenda view" : "Client columns"}
          </button>
        )}
        <label>
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
          />{" "}
          Show cancelled
        </label>
        <label>
          <input
            type="checkbox"
            checked={onlyFollowUp}
            onChange={(e) => setOnlyFollowUp(e.target.checked)}
          />{" "}
          Needs follow-up
        </label>
      </div>
      {!data ? (
        <p>Loading calendar…</p>
      ) : (
        <>
          <p>
            {pastDue} past scheduled calls need an outcome recorded. Attendance
            is never assumed automatically.
          </p>
          {data.suggestions?.length > 0 && (
            <div className="integration-calendar-suggestions">
              <strong>Suggested group calls</strong>
              {data.suggestions.map((s: any) => (
                <button
                  type="button"
                  disabled={
                    busy || !!editor || data.retreat?.status === "cancelled"
                  }
                  key={s.checkpointNumber}
                  onClick={() => open(undefined, s)}
                >
                  {s.title} · {dateLabel(s.date)} · Schedule
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {editor && (
        <form
          onSubmit={save}
          className="integration-call-editor"
          aria-label="Integration call"
        >
          <h3>
            {editor._id
              ? "Edit call / record attendance"
              : "Schedule integration call"}{" "}
            · {context?.retreat?.name}
          </h3>
          <div className="integration-call-fields">
            <label>
              Call type
              <select
                value={editor.kind}
                onChange={(e) =>
                  change({
                    kind: e.target.value,
                    clientIds:
                      e.target.value === "individual"
                        ? editor.clientIds.slice(0, 1)
                        : editor.clientIds,
                  })
                }
              >
                <option value="group">Group call</option>
                <option value="individual">Individual call</option>
              </select>
            </label>
            <label>
              Checkpoint
              <select
                value={editor.checkpointNumber || ""}
                onChange={(e) =>
                  change({
                    checkpointNumber: e.target.value
                      ? Number(e.target.value)
                      : "",
                  })
                }
              >
                <option value="">Additional call</option>
                <option value="1">I · week 1</option>
                <option value="2">II · week 3</option>
                <option value="3">III · week 5</option>
              </select>
            </label>
            <label>
              Title
              <input
                required
                maxLength={160}
                value={editor.title}
                onChange={(e) => change({ title: e.target.value })}
              />
            </label>
            <label>
              Starts (Prague time)
              <input
                required
                type="datetime-local"
                value={editor.localStart}
                onChange={(e) => change({ localStart: e.target.value })}
              />
            </label>
            <label>
              Duration (minutes)
              <input
                required
                type="number"
                min={15}
                max={240}
                value={editor.durationMinutes}
                onChange={(e) =>
                  change({ durationMinutes: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Facilitator
              <input
                maxLength={160}
                value={editor.facilitator || ""}
                onChange={(e) => change({ facilitator: e.target.value })}
              />
            </label>
            <label>
              Zoom / WhatsApp / meeting link
              <input
                type="url"
                placeholder="https://…"
                value={editor.meetingUrl || ""}
                onChange={(e) => change({ meetingUrl: e.target.value })}
              />
            </label>
            <label>
              Call status
              <select
                value={editor.status}
                onChange={(e) => change({ status: e.target.value })}
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled · retain history</option>
              </select>
            </label>
          </div>
          {editor.meetingUrl && /^https?:\/\//i.test(editor.meetingUrl) && (
            <a href={editor.meetingUrl} target="_blank" rel="noreferrer">
              Open meeting link ↗
            </a>
          )}
          <fieldset>
            <legend>Participants</legend>
            {[
              ...(context?.clients || []).filter(
                (p: any) =>
                  !p.archived || editor.clientIds.includes(p.clientId),
              ),
              ...(editor.participants || []).filter(
                (p: any) =>
                  !context?.clients.some((c: any) => c.clientId === p.clientId),
              ),
            ].map((p: any) => (
              <label
                key={p.clientId}
                className="integration-participant-choice"
              >
                <input
                  type={editor.kind === "individual" ? "radio" : "checkbox"}
                  name="participants"
                  checked={editor.clientIds.includes(p.clientId)}
                  onChange={(e) =>
                    change({
                      clientIds:
                        editor.kind === "individual"
                          ? [p.clientId]
                          : e.target.checked
                            ? [...editor.clientIds, p.clientId]
                            : editor.clientIds.filter(
                                (id: string) => id !== p.clientId,
                              ),
                    })
                  }
                />
                {p.name}
              </label>
            ))}
          </fieldset>
          <label>
            Session notes
            <textarea
              maxLength={4000}
              value={editor.notes || ""}
              onChange={(e) => change({ notes: e.target.value })}
            />
          </label>
          {editor.clientIds.map((clientId: string) => {
            const p = editor.attendance.find(
              (p: any) => p.clientId === clientId,
            ) || {
              attendance: "not_recorded",
              wellbeing: "not_recorded",
              answers: {},
            };
            const name =
              context?.clients.find((p: any) => p.clientId === clientId)
                ?.name ||
              editor.participants?.find((p: any) => p.clientId === clientId)
                ?.name;
            return (
              <details
                key={clientId}
                className="integration-participant-record"
              >
                <summary>
                  {name} · {p.attendance.replaceAll("_", " ")} ·{" "}
                  {p.wellbeing.replaceAll("_", " ")}
                </summary>
                <div className="integration-call-fields">
                  <label>
                    Attendance for {name}
                    <select
                      value={p.attendance}
                      onChange={(e) =>
                        updateParticipant(clientId, {
                          attendance: e.target.value,
                        })
                      }
                    >
                      <option value="not_recorded">Not recorded</option>
                      <option value="attended">Attended</option>
                      <option value="no_show">No-show</option>
                      <option value="excused">Excused</option>
                    </select>
                  </label>
                  <label>
                    Follow-up for {name}
                    <select
                      value={p.wellbeing}
                      onChange={(e) =>
                        updateParticipant(clientId, {
                          wellbeing: e.target.value,
                        })
                      }
                    >
                      <option value="not_recorded">Not recorded</option>
                      <option value="okay">Okay</option>
                      <option value="needs_follow_up">Needs follow-up</option>
                    </select>
                  </label>
                </div>
                {context?.questions.map((q: any) => (
                  <label key={q.key}>
                    {q.label}
                    <textarea
                      maxLength={4000}
                      value={p.answers?.[q.key] || ""}
                      onChange={(e) =>
                        updateParticipant(clientId, {
                          answers: { ...p.answers, [q.key]: e.target.value },
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Next step for {name}
                  <textarea
                    maxLength={4000}
                    value={p.nextStep || ""}
                    onChange={(e) =>
                      updateParticipant(clientId, { nextStep: e.target.value })
                    }
                  />
                </label>
                <label>
                  Private staff notes for {name}
                  <textarea
                    maxLength={4000}
                    value={p.notes || ""}
                    onChange={(e) =>
                      updateParticipant(clientId, { notes: e.target.value })
                    }
                  />
                </label>
              </details>
            );
          })}
          {conflicts.length > 0 && (
            <aside className="integration-calendar-error">
              <strong>Overlapping calls</strong>
              {conflicts.map((c) => (
                <p key={c.id}>
                  {c.title} · {pragueInput(c.startsAt).replace("T", " ")}
                </p>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={editor.allowOverlap}
                  onChange={(e) => change({ allowOverlap: e.target.checked })}
                />{" "}
                I reviewed these conflicts; allow the overlap
              </label>
            </aside>
          )}
          {editor.history?.length > 0 && (
            <details>
              <summary>Change history</summary>
              {editor.history.map((h: any, i: number) => (
                <p key={i}>
                  {h.at} · {h.actor} · {h.action} · {h.fromStatus || "new"} →{" "}
                  {h.toStatus}
                </p>
              ))}
            </details>
          )}
          <div className="integration-calendar-toolbar">
            <button type="submit" disabled={busy || !editor.clientIds.length}>
              Save call
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditor(null)}
            >
              Close editor
            </button>
            <small>
              Saving does not send an invitation. Attendance and notes are
              staff-only.
            </small>
          </div>
        </form>
      )}
      {data &&
        (selected && view === "matrix" ? (
          <div
            className="integration-calendar-scroll"
            tabIndex={0}
            aria-label="Six-week client calendar"
          >
            <table style={{tableLayout:'fixed',minWidth:110+data.clients.length*180}}>
              <colgroup><col style={{width:110}}/>{data.clients.map((p:any)=><col key={p.clientId}/>)}</colgroup>
              <thead>
                <tr>
                  <th>Date</th>
                  {data.clients.map((p: any) => (
                    <th key={p.clientId}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendarDays(data.from, data.to).map((date) => {
                  const today = calls.filter(
                    (c: any) =>
                      dayOf(c.startsAt) <= date &&
                      dayOf(
                        new Date(
                          new Date(c.endsAt).getTime() - 1,
                        ).toISOString(),
                      ) >= date,
                  );
                  const groups = today.filter((c: any) => c.kind === "group");
                  return (
                    <React.Fragment key={date}>
                      {groups.map((call: any, index: number) => (
                        <tr key={call._id}>
                          <th>{index === 0 ? dateLabel(date) : ""}</th>
                          <td colSpan={Math.max(1, data.clients.length)}>
                            {event(call)}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <th>{dateLabel(date)}</th>
                        {data.clients.length ? (
                          data.clients.map((p: any) => (
                            <td key={p.clientId}>
                              {today
                                .filter(
                                  (c: any) =>
                                    c.kind === "individual" &&
                                    c.participants.some(
                                      (a: any) => a.clientId === p.clientId,
                                    ),
                                )
                                .map(event)}
                            </td>
                          ))
                        ) : (
                          <td>No eligible clients for this retreat.</td>
                        )}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="integration-calendar-agenda">
            {!calls.length ? (
              <p>
                No calls in this date range. Choose a retreat to schedule one.
              </p>
            ) : (
              calls.map((call: any) => (
                <article key={call._id}>
                  <h3>{dateLabel(dayOf(call.startsAt))}</h3>
                  {event(call)}
                </article>
              ))
            )}
          </div>
        ))}
    </section>
  );
}
