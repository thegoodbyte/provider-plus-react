import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useWorkMode, workApi, workError } from "./WorkModeContext";
import "./workModes.css";
const labels: Record<string, string> = {
  pending: "Remaining",
  reviewed: "Reviewed by you",
  external: "Resolved outside this session",
  skipped: "Skipped",
  blocked: "Blocked",
  waiting: "Waiting",
};
const reasons = [
  ["later", "Review later"],
  ["needs_context", "More context needed"],
  ["missing_document", "Missing document"],
  ["needs_staff_help", "Staff help needed"],
];
const nextActions = [
  ["revisit", "Revisit in this session"],
  ["open_editor", "Review in source editor"],
  ["await_client", "Await client"],
  ["await_advisor", "Await advisor"],
  ["contact_staff", "Contact staff"],
];
export default function WorkModePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const mode = useWorkMode();
  const [queue, setQueue] = useState<any>(null),
    [session, setSession] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]),
    [arrivals, setArrivals] = useState<string[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState("reviewed"),
    [reason, setReason] = useState("no_further_operational_action"),
    [nextAction, setNextAction] = useState("none"),
    [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftKey = session?.currentKey || "";
  const note = drafts[draftKey] || "";
  const setNote = (value: string) =>
    setDrafts((d) => ({ ...d, [draftKey]: value }));
  const [confirmFinish, setConfirmFinish] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const generation = useRef(0);
  async function refresh() {
    const generationId = ++generation.current;
    setBusy(true);
    setError("");
    try {
      if (sessionId) {
        const value = await workApi.get(`/sessions/${sessionId}`);
        const refreshed =
          value.status === "finished"
            ? value
            : await workApi.post(`/sessions/${sessionId}/reconcile`, {
                revision: value.revision,
              });
        if (generationId === generation.current) setSession(refreshed);
      } else {
        const value = await workApi.get("/queue");
        if (generationId === generation.current) setQueue(value);
      }
      if (generationId !== generation.current) return;
      if (sessionId) await mode.enter(sessionId);
      else await mode.refresh();
    } catch (e) {
      if (generationId === generation.current) setError(workError(e));
    } finally {
      if (generationId === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    setSession(null);
    setQueue(null);
    setSelected([]);
    setArrivals([]);
    setDrafts({});
    setOutcome("reviewed");
    setReason("no_further_operational_action");
    setNextAction("none");
    void refresh();
    return () => {
      generation.current++;
    };
  }, [sessionId]); // refresh only on route change; mutations update the revision directly
  async function act(path: string, body: any, clearDraft = false) {
    const generationId = generation.current;
    setBusy(true);
    setError("");
    try {
      const value = await workApi.post(path, body);
      if (generationId !== generation.current) return;
      setSession(value);
      if (clearDraft) setNote("");
      setArrivals([]);
      await mode.refresh();
    } catch (e) {
      if (generationId === generation.current) setError(workError(e));
    } finally {
      if (generationId === generation.current) setBusy(false);
    }
  }
  async function start(keys?: string[]) {
    const generationId = generation.current;
    setBusy(true);
    setError("");
    try {
      const value = await workApi.post("/sessions", {
        mode: "medical",
        requestId: requestId.current,
        ...(keys ? { keys } : {}),
      });
      if (generationId !== generation.current) return;
      await mode.refresh();
      navigate(`/admin/work-modes/sessions/${value._id}`);
    } catch (e) {
      if (generationId === generation.current) setError(workError(e));
    } finally {
      if (generationId === generation.current) setBusy(false);
    }
  }
  const control = (action: string, extra: any = {}) =>
    act(`/sessions/${sessionId}/control`, {
      revision: session.revision,
      action,
      ...extra,
    });
  const current = session?.current;
  const toggle = (key: string, list: string[], setter: (v: string[]) => void) =>
    setter(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  function sourceLink(source: any, text = "Open source editor") {
    return (
      source && (
        <Link
          className="wm-button"
          to={`${source.route}${source.route.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(`/admin/work-modes/sessions/${sessionId}`)}`}
        >
          {text}
        </Link>
      )
    );
  }
  return (
    <section className="wm" aria-label="Work modes" aria-busy={busy}>
      <h1>Work modes</h1>
      <div role="status" aria-live="polite">
        {busy
          ? "Loading or saving work…"
          : session
            ? `Session ${session.status}; ${session.counts.pending} remaining.`
            : queue
              ? "Queue ready."
              : ""}
      </div>
      <p>
        Medical processing foundation · A fixed batch, with your progress saved
        across devices.
      </p>
      <p>
        Use the existing editors to change medical records. A recorded
        operational review does not approve a client, create a review request,
        or send a packet. Medical actions stay in the existing editors.
      </p>
      {(error || mode.error) && (
        <div role="alert" className="wm-error">
          {error || mode.error}
          <button disabled={busy} onClick={() => void refresh()}>
            Refresh current records
          </button>
          <p>
            Unsaved notes stay in this page until you leave it. Saved progress
            is kept on the server.
          </p>
        </div>
      )}
      <div className="wm-actions">
        <button disabled={busy} onClick={() => void refresh()}>
          Refresh queue and progress
        </button>
        <Link to="/admin/work-modes">Choose mode or session</Link>
      </div>
      {!sessionId && (
        <>
          <div className="wm-cards">
            <article>
              <h2>Medical processing</h2>
              <p>
                Review incoming artifacts, pending packets, and actual replies
                or follow-up needs.
              </p>
              <button
                disabled={busy}
                onClick={async () => {
                  try {
                    await mode.enter();
                  } catch (e) {
                    setError(workError(e));
                  }
                }}
              >
                Enter focused navigation
              </button>
            </article>
            <article>
              <h2>Payment processing</h2>
              <p>Not available yet</p>
            </article>
            <article>
              <h2>Upcoming retreat review</h2>
              <p>Not available yet</p>
            </article>
          </div>
          {queue && (
            <>
              <h2>Current queues</h2>
              {queue.steps.map((step: any) => (
                <p key={step.key}>
                  <strong>
                    {step.key}. {step.label}
                  </strong>{" "}
                  —{" "}
                  {
                    queue.items.filter(
                      (i: any) =>
                        i.step === step.key && i.state === "actionable",
                    ).length
                  }{" "}
                  actionable ·{" "}
                  {
                    queue.items.filter(
                      (i: any) => i.step === step.key && i.state === "waiting",
                    ).length
                  }{" "}
                  waiting ·{" "}
                  {
                    queue.items.filter(
                      (i: any) => i.step === step.key && i.state === "blocked",
                    ).length
                  }{" "}
                  blocked
                </p>
              ))}
              <div className="wm-actions">
                <button
                  disabled={busy || !selected.length}
                  onClick={() => void start(selected)}
                >
                  Start selected ({selected.length})
                </button>
                <button
                  disabled={
                    busy ||
                    !queue.items.some((i: any) => i.state === "actionable")
                  }
                  onClick={() =>
                    void start(
                      queue.items
                        .filter((i: any) => i.state === "actionable")
                        .slice(0, 5)
                        .map((i: any) => i.key),
                    )
                  }
                >
                  Start first 5
                </button>
                <button
                  disabled={
                    busy ||
                    !queue.items.some((i: any) => i.state === "actionable")
                  }
                  onClick={() => void start()}
                >
                  Start all actionable
                </button>
              </div>
              {!queue.items.length && (
                <p>No actionable, waiting or blocked work currently.</p>
              )}
              <ul className="wm-list">
                {queue.items.map((item: any) => (
                  <li key={item.key}>
                    {item.state === "actionable" && (
                      <input
                        aria-label={`Select ${item.label}`}
                        type="checkbox"
                        checked={selected.includes(item.key)}
                        onChange={() => toggle(item.key, selected, setSelected)}
                        disabled={busy}
                      />
                    )}
                    <span>
                      <strong>
                        {item.step} · {item.label}
                      </strong>{" "}
                      · {item.state}
                      <small>{item.explanation}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2>Your recent sessions</h2>
          <ul>
            {mode.data?.sessions?.map((s: any) => (
              <li key={s._id}>
                <Link
                  to={`/admin/work-modes/sessions/${s._id}`}
                  onClick={() =>
                    void mode.enter(s._id).catch((e) => setError(workError(e)))
                  }
                >
                  Medical · {s.status} · Step {s.step} ·{" "}
                  {new Date(s.updatedAt).toLocaleString()}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {session && (
        <>
          <h2>Medical session · {session.status}</h2>
          <p>
            Batch size: {session.total}. New arrivals stay outside this batch
            until you add them.
          </p>
          <dl className="wm-counts">
            {Object.entries(labels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{session.counts[key]}</dd>
              </div>
            ))}
          </dl>
          <nav className="wm-actions" aria-label="Session steps">
            {session.steps.map((s: any) => (
              <button
                key={s.key}
                aria-current={session.step === s.key ? "step" : undefined}
                disabled={busy || session.status === "finished"}
                onClick={() => void control("step", { step: s.key })}
              >
                {s.key}. {s.label} · {s.remaining} remaining
              </button>
            ))}
          </nav>
          <p>{session.steps.find((s: any) => s.key === session.step)?.help}</p>
          {session.status === "paused" && (
            <p>
              On a break.{" "}
              <button disabled={busy} onClick={() => void control("resume")}>
                Resume session
              </button>
            </p>
          )}
          {current && (
            <article className="wm-task">
              <h3>Current item · {current.source?.label}</h3>
              <p>{current.source?.explanation}</p>
              {sourceLink(current.source)}
              <p>
                Return here with the Medical mode banner after saving in the
                editor. Refresh rechecks the source; changed work is counted
                separately.
              </p>
              {session.status === "active" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(
                      `/sessions/${sessionId}/outcomes`,
                      {
                        revision: session.revision,
                        key: current.key,
                        sourceVersion: current.source.version,
                        outcome,
                        reason,
                        nextAction,
                        note,
                      },
                      true,
                    );
                  }}
                >
                  <label>
                    Outcome
                    <select
                      aria-label="Outcome"
                      value={outcome}
                      disabled={busy}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOutcome(v);
                        setReason(
                          v === "reviewed"
                            ? "no_further_operational_action"
                            : "needs_context",
                        );
                        setNextAction(v === "reviewed" ? "none" : "revisit");
                      }}
                    >
                      <option value="reviewed">
                        Record an explicit operational review
                      </option>
                      <option value="skip">Skip</option>
                      <option value="block">Block</option>
                    </select>
                  </label>
                  <label>
                    Reason
                    <select
                      aria-label="Reason"
                      value={reason}
                      disabled={busy}
                      onChange={(e) => setReason(e.target.value)}
                    >
                      {(outcome === "reviewed"
                        ? [
                            [
                              "no_further_operational_action",
                              "No further operational action required",
                            ],
                            [
                              "handled_in_existing_workflow",
                              "Handled in the existing workflow",
                            ],
                          ]
                        : reasons
                      ).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {outcome !== "reviewed" && (
                    <label>
                      Next action
                      <select
                        aria-label="Next action"
                        value={nextAction}
                        onChange={(e) => setNextAction(e.target.value)}
                        disabled={busy}
                      >
                        {nextActions.map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Short operational note (no medical details)
                    <textarea
                      maxLength={200}
                      minLength={outcome === "reviewed" ? 8 : undefined}
                      required={outcome === "reviewed"}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <button className="wm-primary" disabled={busy} type="submit">
                    Save {outcome === "reviewed" ? "review outcome" : outcome}{" "}
                    and advance
                  </button>
                </form>
              )}
            </article>
          )}
          {!current && session.status !== "finished" && (
            <div className="wm-task">
              <h3>No actionable items remain in step {session.step}</h3>
              <p>
                Waiting, skipped and blocked work is unresolved. Choose the next
                step, take a break, or finish this session.
              </p>
              {session.step !== "C" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void control("step", {
                      step: session.step === "A" ? "B" : "C",
                    })
                  }
                >
                  Continue to step {session.step === "A" ? "B" : "C"}
                </button>
              )}
            </div>
          )}
          {session.status !== "finished" && (
            <>
              <div className="wm-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    void control(
                      session.status === "paused" ? "resume" : "pause",
                    )
                  }
                >
                  {session.status === "paused" ? "Resume" : "Take a break"}
                </button>
                <button disabled={busy} onClick={() => setConfirmFinish(true)}>
                  Finish session
                </button>
              </div>
              {confirmFinish && (
                <div role="group" aria-label="Confirm finish">
                  <p>
                    Finish this batch? Unresolved work stays unresolved and will
                    not count as reviewed.
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void control("finish", { confirmUnfinished: true }).then(
                        () => setConfirmFinish(false),
                      )
                    }
                  >
                    Confirm finish
                  </button>
                  <button onClick={() => setConfirmFinish(false)}>
                    Keep working
                  </button>
                </div>
              )}
            </>
          )}
          <h3>Unresolved items in this batch</h3>
          <ul className="wm-list">
            {session.items
              .filter((i: any) =>
                ["blocked", "skipped", "waiting"].includes(i.disposition),
              )
              .map((i: any) => (
                <li key={i.key}>
                  <span>
                    {i.source?.label || i.key} · {labels[i.disposition]}
                    <small>
                      {i.reason ||
                        i.source?.explanation ||
                        "Source unavailable"}{" "}
                      · Next: {i.nextAction || "Review source record"}
                    </small>
                  </span>
                  {sourceLink(i.source)}
                  {session.status === "active" &&
                    ["blocked", "skipped"].includes(i.disposition) &&
                    i.source?.state === "actionable" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act(`/sessions/${sessionId}/outcomes`, {
                            revision: session.revision,
                            key: i.key,
                            sourceVersion: i.source.version,
                            outcome: "reopen",
                            reason: "needs_context",
                            nextAction: "revisit",
                          })
                        }
                      >
                        Retry item
                      </button>
                    )}
                </li>
              ))}
          </ul>
          <h3>New arrivals · {session.newArrivals.length}</h3>
          <ul className="wm-list">
            {session.newArrivals.map((i: any) => (
              <li key={i.key}>
                <label>
                  <input
                    type="checkbox"
                    disabled={busy || session.status === "finished"}
                    checked={arrivals.includes(i.key)}
                    onChange={() => toggle(i.key, arrivals, setArrivals)}
                  />
                  {i.step} · {i.label}
                </label>
              </li>
            ))}
          </ul>
          <button
            disabled={busy || !arrivals.length || session.status === "finished"}
            onClick={() => void control("add", { keys: arrivals })}
          >
            Add selected arrivals ({arrivals.length})
          </button>
          <h3>Outside this batch</h3>
          <p>
            {session.waitingSources.length} waiting ·{" "}
            {session.blockedSources.length} blocked. Waiting for a reply does
            not count as actionable follow-up.
          </p>
          <ul className="wm-list">
            {[...session.waitingSources, ...session.blockedSources].map(
              (i: any) => (
                <li key={i.key}>
                  <span>
                    {i.label} · {i.state}
                    <small>{i.explanation}</small>
                  </span>
                  {sourceLink(i)}
                </li>
              ),
            )}
          </ul>
        </>
      )}
    </section>
  );
}
