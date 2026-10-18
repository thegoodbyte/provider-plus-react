import React, { useEffect, useRef, useState } from "react";
import { integrationCalendarApi as callsApi } from "../services/integrationCalendarApi";
import IntegrationLiveSession from "./IntegrationLiveSession";
import { pragueInput } from "./IntegrationCalendar";
import "./IntegrationCalls.css";

export const supportPrompts = [
  "What would make this conversation useful for you?",
  "How are you feeling today, in your own words?",
  "What has helped since our last contact?",
  "What has been difficult, unchanged or harder than expected?",
  "How are home, relationships and daily routines affecting you?",
  "What support would be useful, and what should stay private?",
  "What one manageable next step do we agree on?",
  "Who will do what, by when, and when will we reconnect?",
];
const sid = (v: any) => String(v?._id || v || "");
const errorText = (e: any) =>
  e.response?.data?.message || e.message || "Could not save this call.";
const currentMonth = () => pragueInput(new Date().toISOString()).slice(0, 7);
export function callMonthRange(month: string) {
  const [year, number] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10),
  };
}
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function IntegrationCalls({
  clientId,
  bookingId,
  retreatId,
}: {
  clientId?: string;
  bookingId?: string;
  retreatId?: string;
}) {
  const [month, setMonth] = useState(currentMonth),
    [view, setView] = useState<"calendar" | "list">("list");
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [filter, setFilter] = useState(""),
    [kind, setKind] = useState(""),
    [status, setStatus] = useState("");
  const [editor, setEditor] = useState<any>(null),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [options, setOptions] = useState<any>({ clients: [], bookings: [] });
  const [people, setPeople] = useState<Record<string, any>>({}),
    [conflicts, setConflicts] = useState<any[]>([]);
  const generation = useRef(0),
    heading = useRef<HTMLHeadingElement>(null);
  const range = callMonthRange(month);
  const load = async () => {
    const revision = ++generation.current;
    try {
      const r = await callsApi.get({ ...range, clientId, bookingId });
      if (revision === generation.current) {
        setData(r.data);
        setError("");
      }
    } catch (e) {
      if (revision === generation.current) setError(errorText(e));
    }
  };
  useEffect(() => {
    setData(null);
    void load();
    return () => {
      generation.current++;
    };
  }, [month, clientId, bookingId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editor || editor._id) return;
    let active = true;
    const timeout = setTimeout(() => {
      callsApi
        .options({
          search,
          clientId:
            editor.kind === "individual" ? clientId || undefined : undefined,
        })
        .then((r) => {
          if (!active) return;
          setOptions(r.data);
          setPeople((old) => ({
            ...old,
            ...Object.fromEntries(r.data.clients.map((c: any) => [c.id, c])),
          }));
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [search, clientId, !!editor, editor?.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (notes) heading.current?.focus();
  }, [notes]);
  const newCall = (now = false) => {
    setError("");
    setNotice("");
    setSearch("");
    setConflicts([]);
    setEditor({
      requestId: crypto.randomUUID(),
      kind: "individual",
      title: now ? "Individual support call" : "Integration call",
      localStart: now
        ? pragueInput(new Date().toISOString())
        : `${month === currentMonth() ? pragueInput(new Date().toISOString()).slice(0, 10) : range.from}T18:00`,
      durationMinutes: 30,
      clientIds: clientId ? [clientId] : [],
      bookingId: bookingId || "",
      retreatId: retreatId || "",
      facilitator: "",
      meetingUrl: "",
      notes: "",
      status: "scheduled",
      attendance: [],
      allowOverlap: false,
      openNotes: now,
    });
  };
  const editCall = (call: any) => {
    setError("");
    setConflicts([]);
    setPeople((old) => ({
      ...old,
      ...Object.fromEntries(
        call.participants.map((p: any) => [
          sid(p.clientId),
          { id: sid(p.clientId), name: p.name },
        ]),
      ),
    }));
    setEditor({
      ...call,
      localStart: pragueInput(call.startsAt),
      durationMinutes: Math.round(
        (+new Date(call.endsAt) - +new Date(call.startsAt)) / 60000,
      ),
      retreatId: sid(call.retreatId),
      clientIds: call.participants.map((p: any) => sid(p.clientId)),
      attendance: call.participants,
      expectedUpdatedAt: call.updatedAt,
      allowOverlap: false,
    });
  };
  const change = (patch: any) => {
    setEditor((old: any) => ({
      ...old,
      ...patch,
      allowOverlap: patch.allowOverlap ?? false,
    }));
    if (!patch.allowOverlap) setConflicts([]);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await callsApi.save(editor._id, {
          ...editor,
          attendance: editor.attendance.filter((p: any) =>
            editor.clientIds.includes(sid(p.clientId)),
          ),
        }),
        openNotes = editor.openNotes;
      setEditor(null);
      setNotice("Call saved. No invitation or reminder was sent.");
      setMonth(editor.localStart.slice(0, 7));
      await load();
      if (openNotes) setNotes(sid(r.data));
    } catch (e: any) {
      setError(errorText(e));
      setConflicts(e.response?.data?.conflicts || []);
    } finally {
      setBusy(false);
    }
  };
  const cancelEditor = () => {
    if (!busy && window.confirm("Discard this unsaved call form?"))
      setEditor(null);
  };
  const calls = (data?.calls || []).filter(
    (c: any) =>
      (!kind || c.kind === kind) &&
      (!status || c.status === status) &&
      `${c.title} ${c.facilitator} ${c.participants.map((p: any) => p.name).join(" ")}`
        .toLocaleLowerCase()
        .includes(filter.toLocaleLowerCase()),
  );
  const moveMonth = (offset: number) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(
      new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7),
    );
  };
  if (notes)
    return (
      <section className="integration-calls">
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Return to calls? Keep this page open until every edited note is marked Saved. Unsaved drafts remain available in this browser tab.",
              )
            ) {
              setNotes("");
              void load();
            }
          }}
        >
          ← Back to calls
        </button>
        <h2 tabIndex={-1} ref={heading}>
          Call notes
        </h2>
        <details>
          <summary>Optional conversation prompts</summary>
          <p>
            Follow the client's priorities; skip any prompt that does not fit.
          </p>
          <ul>
            {supportPrompts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
        <IntegrationLiveSession key={notes} initialCallId={notes} />
      </section>
    );
  return (
    <section className="integration-calls" aria-label="Integration calls">
      <header>
        <div>
          <h2>Integration Calls</h2>
          <p>
            Plan the conversation. Record what matters. Keep the next promise.
          </p>
        </div>
        <div className="call-actions">
          <button
            type="button"
            disabled={!!editor || !data}
            onClick={() => newCall()}
          >
            Schedule call
          </button>
          <button
            type="button"
            disabled={!!editor || !data}
            onClick={() => newCall(true)}
          >
            Record a call now
          </button>
        </div>
      </header>
      {error && (
        <p role="alert">
          {error}{" "}
          {!editor && <button onClick={() => void load()}>Retry</button>}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!editor && (
        <>
          <div className="call-toolbar">
            <div className="call-actions">
              <button aria-label="Previous month" onClick={() => moveMonth(-1)}>
                ←
              </button>
              <label>
                Month
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (e.target.value) setMonth(e.target.value);
                  }}
                />
              </label>
              <button aria-label="Next month" onClick={() => moveMonth(1)}>
                →
              </button>
              <button onClick={() => setMonth(currentMonth())}>Today</button>
            </div>
            <div className="call-actions" aria-label="Call views">
              <button
                aria-pressed={view === "calendar"}
                onClick={() => setView("calendar")}
              >
                Calendar
              </button>
              <button
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                List
              </button>
            </div>
            <label>
              Find a call
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Client, title or facilitator"
              />
            </label>
            <label>
              Call type
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">All types</option>
                <option value="individual">Individual</option>
                <option value="group">Group</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>
          <p className="call-muted">
            Times: Europe/Prague · Private staff notes · Saving never sends
            invitations.
          </p>
          {!data ? (
            <p role="status">Loading calls…</p>
          ) : (
            <>
              {!calls.length && (
                <p>
                  No calls match this month. Schedule a call, record one now, or
                  choose another month.
                </p>
              )}
              <div className={view === "calendar" ? "call-month-scroll" : ""}>
                {view === "calendar" ? (
                  <div
                    className="call-month"
                    role="region"
                    aria-label="Monthly integration calendar"
                  >
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (day) => (
                        <div className="call-weekday" key={day}>
                          {day}
                        </div>
                      ),
                    )}
                    {Array.from(
                      {
                        length:
                          (new Date(`${range.from}T12:00:00Z`).getUTCDay() +
                            6) %
                          7,
                      },
                      (_, i) => (
                        <div key={`blank-${i}`} />
                      ),
                    )}
                    {Array.from(
                      { length: Number(range.to.slice(-2)) },
                      (_, i) => {
                        const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                        return (
                          <div className="call-day" key={date}>
                            <strong>{i + 1}</strong>
                            {calls
                              .filter(
                                (c: any) =>
                                  pragueInput(c.startsAt).slice(0, 10) === date,
                              )
                              .map((c: any) => (
                                <button
                                  className={`call-event ${c.kind}`}
                                  key={c._id}
                                  onClick={() => editCall(c)}
                                >
                                  {pragueInput(c.startsAt).slice(11)} ·{" "}
                                  {c.title}
                                  <small>
                                    {c.participants
                                      .map((p: any) => p.name)
                                      .join(", ")}
                                  </small>
                                </button>
                              ))}
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div className="call-list">
                    {calls.map((c: any) => (
                      <article key={c._id} className={`call-card ${c.kind}`}>
                        <div>
                          <span className="call-tag">
                            {c.kind} · {c.status}
                          </span>
                          <h3>{c.title}</h3>
                          <p>
                            {dateLabel(c.startsAt)} ·{" "}
                            {Math.round(
                              (+new Date(c.endsAt) - +new Date(c.startsAt)) /
                                60000,
                            )}{" "}
                            min
                          </p>
                          <p>
                            {c.participants.map((p: any) => p.name).join(", ")}{" "}
                            · {c.retreatName}
                          </p>
                        </div>
                        <div className="call-actions">
                          <button onClick={() => setNotes(c._id)}>
                            Start notes
                          </button>
                          <button onClick={() => editCall(c)}>
                            Details / edit
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
      {editor && (
        <form aria-label="Call details" onSubmit={save}>
          <h3>
            {editor._id
              ? "Call details"
              : editor.openNotes
                ? "Start a support call"
                : "Schedule a call"}
          </h3>
          <div className="call-form-grid">
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
              Type
              <select
                disabled={!!bookingId || !!editor._id}
                value={editor.kind}
                onChange={(e) =>
                  change({
                    kind: e.target.value,
                    bookingId: "",
                    durationMinutes: e.target.value === "group" ? 75 : 30,
                    clientIds: clientId ? [clientId] : [],
                  })
                }
              >
                <option value="individual">Individual</option>
                <option value="group">Group</option>
              </select>
            </label>
            <label>
              Starts (Europe/Prague)
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
              Meeting link
              <input
                type="url"
                value={editor.meetingUrl || ""}
                onChange={(e) => change({ meetingUrl: e.target.value })}
                placeholder="Zoom, WhatsApp or another meeting link"
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
                <option value="cancelled">Cancelled · keep history</option>
              </select>
            </label>
            <label>
              Retreat context
              <select
                disabled={!!retreatId || !!editor._id || !!editor.bookingId}
                value={editor.retreatId || ""}
                onChange={(e) => change({ retreatId: e.target.value })}
              >
                <option value="">Direct support · no retreat</option>
                {(data?.retreats || []).map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!editor._id && (
            <>
              <label>
                Find clients
                <input
                  type="search"
                  disabled={!!clientId && editor.kind === "individual"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or RE number (2+ characters)"
                />
              </label>
              <div className="call-client-results">
                {options.clients.map((p: any) => (
                  <label key={p.id}>
                    <input
                      type="checkbox"
                      checked={editor.clientIds.includes(p.id)}
                      onChange={(e) =>
                        change({
                          clientIds:
                            editor.kind === "individual"
                              ? e.target.checked
                                ? [p.id]
                                : []
                              : e.target.checked
                                ? [...editor.clientIds, p.id]
                                : editor.clientIds.filter(
                                    (id: string) => id !== p.id,
                                  ),
                          bookingId: bookingId || "",
                        })
                      }
                    />
                    #{p.number} {p.name}
                  </label>
                ))}
              </div>
              {editor.kind === "individual" && (
                <label>
                  Booking context
                  <select
                    disabled={!!bookingId}
                    value={editor.bookingId || ""}
                    onChange={(e) => {
                      const b = options.bookings.find(
                        (b: any) => b.id === e.target.value,
                      );
                      change({
                        bookingId: b?.id || "",
                        retreatId: b?.retreatId || retreatId || "",
                      });
                    }}
                  >
                    <option value="">No booking · direct support</option>
                    {options.bookings
                      .filter((b: any) => editor.clientIds.includes(b.clientId))
                      .map((b: any) => (
                        <option key={b.id} value={b.id}>
                          #{b.number || b.id.slice(-6)} · {b.retreatName}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </>
          )}
          <p>
            Participants:{" "}
            {editor.clientIds
              .map((id: string) => people[id]?.name || id)
              .join(", ") || "Choose at least one client"}
          </p>
          {editor.kind === "group" && !!editor.clientIds.length && (
            <fieldset>
              <legend>Who will attend?</legend>
              <p>
                Check everyone who has confirmed they will attend. Unchecked
                means unconfirmed. Record actual attendance after the call.
              </p>
              {editor.clientIds.map((id: string) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={
                      !!editor.attendance.find(
                        (p: any) => sid(p.clientId) === id,
                      )?.willAttend
                    }
                    onChange={(e) =>
                      change({
                        attendance: [
                          ...editor.attendance.filter(
                            (p: any) => sid(p.clientId) !== id,
                          ),
                          {
                            ...editor.attendance.find(
                              (p: any) => sid(p.clientId) === id,
                            ),
                            clientId: id,
                            willAttend: e.target.checked,
                          },
                        ],
                      })
                    }
                  />
                  {people[id]?.name || id} will attend
                </label>
              ))}
            </fieldset>
          )}
          <label>
            Call preparation
            <textarea
              maxLength={4000}
              value={editor.notes || ""}
              onChange={(e) => change({ notes: e.target.value })}
              placeholder="What would make this call useful? Detailed private notes are taken after saving."
            />
          </label>
          {!!conflicts.length && (
            <div role="alert">
              <p>
                Overlapping calls: {conflicts.map((c) => c.title).join(", ")}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={editor.allowOverlap}
                  onChange={(e) => change({ allowOverlap: e.target.checked })}
                />
                I reviewed these overlaps and want to save anyway
              </label>
            </div>
          )}
          <div className="call-actions">
            <button type="button" disabled={busy} onClick={cancelEditor}>
              Discard
            </button>
            <button disabled={busy || !editor.clientIds.length} type="submit">
              {busy
                ? "Saving…"
                : editor.openNotes
                  ? "Save and open notes"
                  : "Save call"}
            </button>
            {editor._id && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Discard any unsaved call changes and open saved notes?",
                    )
                  ) {
                    setNotes(editor._id);
                    setEditor(null);
                  }
                }}
              >
                Open saved notes
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
