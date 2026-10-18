import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./IntegrationLiveSession.css";
const localKey = (clientId: string, field: string, rowId = "") =>
  [clientId, field, rowId].join("|");
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
export default function IntegrationLiveSession({ initialCallId = '' }: { initialCallId?: string } = {}) {
  const { user } = useAuth(),
    actor = String(user?.id || user?.email || ""),
    readonly = !!user?.readOnly;
  const [calls, setCalls] = useState<any[]>([]),
    [callId, setCallId] = useState(initialCallId),
    [data, setData] = useState<any>(null),
    [drafts, setDrafts] = useState<Record<string, any>>({}),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [libraryId, setLibraryId] = useState(""),
    [custom, setCustom] = useState(""),
    [participant, setParticipant] = useState(""),
    [action, setAction] = useState<any>({
      text: "",
      owner: "",
      backup: "",
      dueDate: "",
      status: "pending",
      completionEvidence: "",
    }),
    [permission, setPermission] = useState(false),
    [permissionEvidence, setPermissionEvidence] = useState(""),
    [end, setEnd] = useState<any>({
      attendanceReviewed: false,
      concernsReviewed: false,
      nextContactReviewed: false,
      evidence: "",
    }),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(
      () => window.matchMedia?.("(max-width: 900px)").matches || false,
    );
  const current = useRef({ actor, callId });
  useEffect(() => { if (initialCallId) setCallId(initialCallId); }, [initialCallId]);
  current.current = { actor, callId };
  const draftRef = useRef(drafts);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({}),
    inflight = useRef(new Set<string>());
  const storeKey = `integration-live:${actor}:${callId}`;
  const persist = (next: Record<string, any>, key = storeKey) => {
    try {
      const pending = Object.fromEntries(
        Object.entries(next).filter(([, v]) => v.state !== "saved"),
      );
      if (Object.keys(pending).length)
        sessionStorage.setItem(
          key,
          JSON.stringify({ at: Date.now(), drafts: pending }),
        );
      else sessionStorage.removeItem(key);
    } catch {
      setError(
        "Browser draft storage is unavailable. Keep this page open until all cells are saved.",
      );
    }
  };
  const changeDrafts = (fn: (previous: any) => any) => {
    const next = fn(draftRef.current);
    draftRef.current = next;
    setDrafts(next);
    persist(next);
  };
  useEffect(() => {
    let live = true;
    api
      .get("/integration/sessions")
      .then((r) => {
        if (live) setCalls(r.data.calls);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [actor]);
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 900px)");
    if (!media) return;
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    setData(null);
    draftRef.current = {};
    setDrafts({});
    setEnd({
      attendanceReviewed: false,
      concernsReviewed: false,
      nextContactReviewed: false,
      evidence: "",
    });
    setError("");
    setParticipant("");
    if (!callId || !actor) return;
    let live = true;
    api
      .get("/integration/sessions/" + callId)
      .then((r) => {
        if (!live) return;
        setData(r.data);
        let stored: any;
        try {
          stored = JSON.parse(sessionStorage.getItem(storeKey) || "null");
        } catch {}
        if (stored && Date.now() - stored.at < 86400000) {
          const restored: any = {};
          for (const [key, value] of Object.entries(stored.drafts) as any) {
            const server = Object.values(r.data.session.cells).find(
              (c: any) => localKey(c.clientId, c.field, c.rowId) === key,
            ) as any;
            if (
              server?.operationId === value.operationId &&
              same(server.value, value.value)
            )
              continue;
            restored[key] = {
              ...value,
              state:
                (server?.revision || 0) !== value.baseRevision
                  ? "conflict"
                  : "failed",
              error: "Recovered draft from this tab. Review before retrying.",
              server,
            };
          }
          setDrafts(restored);
          draftRef.current = restored;
          persist(restored);
        } else if (stored) sessionStorage.removeItem(storeKey);
      })
      .catch((e) => {
        if (live) setError(e.response?.data?.message || e.message);
      });
    return () => {
      live = false;
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, [callId, actor]);
  const cells = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(data?.session.cells || {}).map(([serverKey, c]: any) => [
          localKey(c.clientId, c.field, c.rowId),
          { ...c, serverKey },
        ]),
      ),
    [data?.session.cells],
  );
  const initial = (p: any, field: string, row?: any) =>
    field === "attendance"
      ? p.attendance || "not_recorded"
      : field === "wellbeing"
        ? p.wellbeing || "not_recorded"
        : field === "reportedState"
          ? "unknown"
          : field === "privateNotes"
            ? p.notes || ""
            : field === "sharedSummary"
              ? ""
              : row?.origin === "legacy"
                ? p.answers?.[row.question.key] || null
                : null;
  const value = (p: any, field: string, row?: any) => {
    const key = localKey(p.clientId, field, row?.id);
    return drafts[key]?.value !== undefined
      ? drafts[key].value
      : cells[key]?.value !== undefined
        ? cells[key].value
        : initial(p, field, row);
  };
  const load = async () => {
    const source = { ...current.current };
    const r = await api.get("/integration/sessions/" + source.callId);
    if (
      source.actor === current.current.actor &&
      source.callId === current.current.callId
    )
      setData(r.data);
  };
  const schedule = (key: string) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => save(key), 700);
  };
  const save = async (key: string) => {
    if (current.current.actor !== actor || current.current.callId !== callId)
      return;
    if (inflight.current.has(key)) {
      schedule(key);
      return;
    }
    const d = draftRef.current[key];
    if (!d || d.state === "conflict" || d.state === "saved" || readonly) return;
    const source = { ...current.current };
    inflight.current.add(key);
    changeDrafts((old) => ({
      ...old,
      [key]: { ...old[key], state: "saving" },
    }));
    try {
      const r = await api.post(`/integration/sessions/${source.callId}/cells`, {
        clientId: d.clientId,
        field: d.field,
        rowId: d.rowId,
        expectedRevision: d.baseRevision,
        value: d.value,
        operationId: d.operationId,
      });
      if (
        current.current.actor !== source.actor ||
        current.current.callId !== source.callId
      )
        return;
      setData((old: any) => ({
        ...old,
        session: {
          ...old.session,
          revision: Math.max(old.session.revision, r.data.sessionRevision),
          endReviewRequired: true,
          cells: { ...old.session.cells, [r.data.key]: r.data.cell },
        },
      }));
      changeDrafts((old) => {
        const latest = old[key];
        if (latest.operationId !== d.operationId)
          return {
            ...old,
            [key]: {
              ...latest,
              baseRevision: r.data.cell.revision,
              state: "dirty",
            },
          };
        return {
          ...old,
          [key]: {
            ...latest,
            baseRevision: r.data.cell.revision,
            state: r.data.cell.mirrorPending ? "pending_sync" : "saved",
            server: r.data.cell,
            error: r.data.cell.mirrorPending
              ? "Draft saved; core call state needs review."
              : "",
          },
        };
      });
      if (draftRef.current[key]?.state === "dirty") schedule(key);
    } catch (e: any) {
      if (
        current.current.actor !== source.actor ||
        current.current.callId !== source.callId
      )
        return;
      if (e.response?.status === 409 && e.response.data.current)
        setData((old: any) => ({
          ...old,
          session: {
            ...old.session,
            revision: Math.max(
              old.session.revision,
              e.response.data.sessionRevision || 0,
            ),
            cells: {
              ...old.session.cells,
              [e.response.data.key]: {
                ...e.response.data.current,
                clientId: d.clientId,
                field: d.field,
                rowId: d.rowId,
              },
            },
          },
        }));
      changeDrafts((old) => ({
        ...old,
        [key]: {
          ...old[key],
          state: e.response?.status === 409 ? "conflict" : "failed",
          error:
            e.response?.data?.message ||
            "Save failed. Draft retained in this tab.",
          server: e.response?.data?.current,
        },
      }));
    } finally {
      inflight.current.delete(key);
    }
  };
  const edit = (p: any, field: string, next: any, row?: any) => {
    const key = localKey(p.clientId, field, row?.id);
    changeDrafts((old) => ({
      ...old,
      [key]: {
        ...old[key],
        clientId: p.clientId,
        field,
        rowId: row?.id || "",
        value: next,
        baseRevision: old[key]?.baseRevision ?? cells[key]?.revision ?? 0,
        operationId: crypto.randomUUID(),
        state: "dirty",
        error: "",
      },
    }));
    schedule(key);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await load();
      setEnd({
        attendanceReviewed: false,
        concernsReviewed: false,
        nextContactReviewed: false,
        evidence: "",
      });
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  const selected = data?.call.participants.find(
      (p: any) => p.clientId === participant,
    ),
    existingAction = data?.actions.find(
      (a: any) => String(a.clientId) === participant,
    );
  useEffect(() => {
    setAction(
      existingAction
        ? { ...existingAction }
        : {
            text: "",
            owner: "",
            backup: "",
            dueDate: "",
            status: "pending",
            completionEvidence: "",
          },
    );
    setPermission(false);
    setPermissionEvidence("");
  }, [participant, existingAction?.revision]);
  const previous = Object.fromEntries(
    Object.values(data?.previous || {}).map((p: any) => [
      localKey(p.clientId, "answer", p.rowId),
      p,
    ]),
  );
  const field = (p: any, name: string, label: string, row?: any) => {
    const key = localKey(p.clientId, name, row?.id),
      d = drafts[key],
      c = cells[key],
      v = value(p, name, row),
      disabled = readonly || data.call.status === "cancelled",
      aria = p.name + " · " + label;
    const q = row?.question;
    const options: any = {
      attendance: [
        ["not_recorded", "Not recorded"],
        ["attended", "Attended"],
        ["no_show", "No-show"],
        ["excused", "Excused"],
      ],
      wellbeing: [
        ["not_recorded", "Not recorded"],
        ["okay", "Okay"],
        ["needs_follow_up", "Needs follow-up"],
      ],
      reportedState: [
        ["unknown", "Unknown"],
        ["better", "Better"],
        ["same", "Same"],
        ["worse", "Harder"],
        ["mixed", "Mixed"],
        ["unsure", "Unsure"],
      ],
    };
    const picks =
      options[name] ||
      (q?.type === "boolean"
        ? [
            ["true", "Yes"],
            ["false", "No"],
          ]
        : q?.type === "scale"
          ? Array.from({ length: 10 }, (_, i) => [String(i + 1), String(i + 1)])
          : q?.options?.map((o: any) => [o.key, o.label.en]) || []);
    return (
      <div className="live-cell" key={key}>
        {name === "answer" && q.type === "multiple" ? (
          <fieldset disabled={disabled} aria-label={aria}>
            {q.options.map((o: any) => (
              <label key={o.key}>
                <input
                  type="checkbox"
                  checked={(v || []).includes(o.key)}
                  onChange={(e) =>
                    edit(
                      p,
                      name,
                      e.target.checked
                        ? [...(v || []), o.key]
                        : (v || []).filter((x: string) => x !== o.key),
                      row,
                    )
                  }
                />
                {o.label.en}
              </label>
            ))}
          </fieldset>
        ) : options[name] || (name === "answer" && q.type !== "text") ? (
          <select
            aria-label={aria}
            disabled={disabled}
            value={v === null ? "" : String(v)}
            onChange={(e) =>
              edit(
                p,
                name,
                e.target.value === ""
                  ? null
                  : q?.type === "boolean"
                    ? e.target.value === "true"
                    : q?.type === "scale"
                      ? Number(e.target.value)
                      : e.target.value,
                row,
              )
            }
          >
            {name === "answer" && (
              <option value="">Skipped / unanswered</option>
            )}
            {picks.map(([k, l]: any) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        ) : (
          <textarea
            aria-label={aria}
            disabled={disabled}
            maxLength={
              name === "privateNotes" || row?.origin === "legacy" ? 4000 : 8000
            }
            value={v || ""}
            onChange={(e) => edit(p, name, e.target.value, row)}
          />
        )}
        <span role="status" aria-live="polite">
          {d?.state === "dirty"
            ? "Unsaved draft"
            : d?.state === "saving"
              ? "Saving…"
              : d?.state === "failed"
                ? "Save failed — draft retained"
                : d?.state === "conflict"
                  ? "Conflict — review required"
                  : d?.state === "pending_sync" || c?.mirrorPending
                    ? "Saved draft — core state needs review"
                    : c || d?.state === "saved"
                      ? "Saved"
                      : "Unchanged"}
        </span>
        {d?.error && <p>{d.error}</p>}
        {d?.state === "failed" && (
          <button disabled={disabled} onClick={() => save(key)}>
            Retry save
          </button>
        )}
        {d?.state === "conflict" && (
          <>
            <p>
              Current saved answer: {String(d.server?.value ?? "Unanswered")}
            </p>
            <button
              onClick={() =>
                changeDrafts((old) => {
                  const next = { ...old };
                  delete next[key];
                  return next;
                })
              }
            >
              Use saved answer
            </button>
            <button
              disabled={disabled}
              onClick={() => {
                changeDrafts((old) => ({
                  ...old,
                  [key]: {
                    ...old[key],
                    baseRevision: d.server?.revision || 0,
                    state: "dirty",
                    operationId: crypto.randomUUID(),
                  },
                }));
                schedule(key);
              }}
            >
              Save my draft after reviewing
            </button>
          </>
        )}
        {c?.mirrorPending && (
          <button
            disabled={disabled}
            onClick={() =>
              run(async () => {
                await api.post(
                  `/integration/sessions/${callId}/reconcile-cell`,
                  {
                    key: c.serverKey,
                    expectedRevision: c.revision,
                    expectedCallUpdatedAt: new Date(
                      data.call.updatedAt,
                    ).toISOString(),
                    reviewed: true,
                  },
                );
                changeDrafts((old) => {
                  const next = { ...old };
                  delete next[key];
                  return next;
                });
              })
            }
          >
            Apply reviewed draft to core call
          </button>
        )}
        {row && previous[key] && (
          <small>
            Previously: {String(previous[key].value)} · version{" "}
            {previous[key].version || "legacy"}
          </small>
        )}
      </div>
    );
  };

  const dirty =
    Object.values(drafts).some((d: any) => d.state !== "saved") ||
    Object.values(data?.session.cells || {}).some((c: any) => c.mirrorPending);
  return (
    <section className="integration-programs live-session">
      <h3>Live-session notes</h3>
      <p>
        Answers and private notes stay with the support team. Only a separately
        reviewed summary with recorded client permission is shared with that
        client. Reported states are observations, not a recovery score.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <label>
        Integration call
        <select
          aria-label="Integration call"
          disabled={!!initialCallId}
          value={callId}
          onChange={(e) => setCallId(e.target.value)}
        >
          <option value="">Choose call</option>
          {initialCallId && !calls.some(c => c._id === initialCallId) && <option value={initialCallId}>Selected support call</option>}
          {calls.map((c) => (
            <option key={c._id} value={c._id}>
              {c.title} · {new Date(c.startsAt).toLocaleString()} ·{" "}
              {c.retreatId?.name || c.retreatId?.code || ""}
            </option>
          ))}
        </select>
      </label>
      {data && (
        <>
          <h4>{data.call.title}</h4>
          <p>
            {data.call.status} ·{" "}
            {data.session.endReviewRequired
              ? "End-of-call review needed"
              : "End-of-call checklist recorded"}
          </p>
          <button disabled={busy} onClick={() => run(load)}>
            Refresh saved answers
          </button>
          <details>
            <summary>Choose questions</summary>
            <label>
              Published question set
              <select
                value={libraryId}
                onChange={(e) => setLibraryId(e.target.value)}
              >
                <option value="">Choose reviewed version</option>
                {data.libraries.map((l: any) => (
                  <option key={l._id} value={l._id}>
                    {l.name} · version {l.publishedVersion}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy || readonly || !libraryId || dirty}
              onClick={() =>
                run(async () => {
                  await api.post(`/integration/sessions/${callId}/questions`, {
                    libraryId,
                    expectedRevision: data.session.revision,
                  });
                })
              }
            >
              Add published questions
            </button>
            <label>
              Custom optional question
              <input
                maxLength={500}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
            <button
              disabled={busy || readonly || !custom.trim() || dirty}
              onClick={() =>
                run(async () => {
                  await api.post(
                    `/integration/sessions/${callId}/custom-question`,
                    { label: custom, expectedRevision: data.session.revision },
                  );
                  setCustom("");
                })
              }
            >
              Add custom question
            </button>
          </details>
          {mobile ? (
            <div className="live-participant-cards">
              {data.call.participants.map((p: any) => (
                <article key={p.clientId}>
                  <h4>{p.name}</h4>
                  {["attendance", "wellbeing", "reportedState"].map((f) => (
                    <div key={f}>
                      <strong>
                        {f === "reportedState"
                          ? "Client-reported state"
                          : f === "wellbeing"
                            ? "Follow-up state"
                            : "Attendance"}
                      </strong>
                      {field(p, f, f)}
                    </div>
                  ))}
                  {data.session.rows.map((row: any) => (
                    <div key={row.id}>
                      <strong>
                        {row.question.label.en} ·{" "}
                        {row.version || "legacy/custom"}
                      </strong>
                      {field(p, "answer", row.question.label.en, row)}
                    </div>
                  ))}
                  <strong>Private staff notes</strong>
                  {field(p, "privateNotes", "Private staff notes")}
                  <strong>Draft client summary</strong>
                  {field(p, "sharedSummary", "Draft client summary")}
                </article>
              ))}
            </div>
          ) : (
            <div className="live-matrix-scroll">
              <table>
                <caption>Clients in columns, questions in rows</caption>
                <thead>
                  <tr>
                    <th scope="col">Question / observation</th>
                    {data.call.participants.map((p: any) => (
                      <th scope="col" key={p.clientId}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["attendance", "wellbeing", "reportedState"].map((f) => (
                    <tr key={f}>
                      <th scope="row">
                        {f === "reportedState"
                          ? "Client-reported state"
                          : f === "wellbeing"
                            ? "Follow-up state"
                            : "Attendance"}
                      </th>
                      {data.call.participants.map((p: any) => (
                        <td key={p.clientId}>{field(p, f, f)}</td>
                      ))}
                    </tr>
                  ))}
                  {data.session.rows.map((row: any) => (
                    <tr key={row.id}>
                      <th scope="row">
                        {row.question.label.en}
                        <small>
                          {row.version
                            ? "Published version " + row.version
                            : row.origin}
                        </small>
                      </th>
                      {data.call.participants.map((p: any) => (
                        <td key={p.clientId}>
                          {field(p, "answer", row.question.label.en, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {["privateNotes", "sharedSummary"].map((f) => (
                    <tr key={f}>
                      <th scope="row">
                        {f === "privateNotes"
                          ? "Private staff notes"
                          : "Draft client summary"}
                      </th>
                      {data.call.participants.map((p: any) => (
                        <td key={p.clientId}>
                          {field(
                            p,
                            f,
                            f === "privateNotes"
                              ? "Private staff notes"
                              : "Draft client summary",
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h4>Agreed next action and client summary</h4>
          <label>
            Participant
            <select
              value={participant}
              onChange={(e) => setParticipant(e.target.value)}
            >
              <option value="">Choose participant</option>
              {data.call.participants.map((p: any) => (
                <option key={p.clientId} value={p.clientId}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <>
              <label>
                Agreed next action
                <textarea
                  value={action.text}
                  onChange={(e) =>
                    setAction({ ...action, text: e.target.value })
                  }
                />
              </label>
              {["owner", "backup", "dueDate"].map((k) => (
                <label key={k}>
                  {k === "dueDate"
                    ? "Action due date"
                    : k === "backup"
                      ? "Action backup"
                      : "Action owner"}
                  <input
                    type={k === "dueDate" ? "date" : "text"}
                    value={action[k]}
                    onChange={(e) =>
                      setAction({ ...action, [k]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Action state
                <select
                  value={action.status}
                  onChange={(e) =>
                    setAction({ ...action, status: e.target.value })
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed with evidence</option>
                </select>
              </label>
              <label>
                Completion evidence
                <textarea
                  value={action.completionEvidence}
                  onChange={(e) =>
                    setAction({ ...action, completionEvidence: e.target.value })
                  }
                />
              </label>
              <button
                disabled={busy || readonly}
                onClick={() =>
                  run(async () => {
                    await api.post(`/integration/sessions/${callId}/actions`, {
                      ...action,
                      clientId: participant,
                      expectedRevision: existingAction?.revision || 0,
                    });
                    setNotice(
                      selected.bookingId ? "Owned action saved to post-retreat care and the control centre." : "Owned follow-up saved with this support call.",
                    );
                  })
                }
              >
                Save agreed action
              </button>
              <p>
                Summary currently shared:{" "}
                {data.session.summaries?.[participant]?.shared ? "Yes" : "No"}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={permission}
                  onChange={(e) => setPermission(e.target.checked)}
                />
                Client gave permission to receive the reviewed summary
              </label>
              <label>
                Permission and wording review evidence
                <textarea
                  value={permissionEvidence}
                  onChange={(e) => setPermissionEvidence(e.target.value)}
                />
              </label>
              <button
                disabled={
                  busy ||
                  readonly ||
                  dirty ||
                  !permission ||
                  !permissionEvidence.trim()
                }
                onClick={() =>
                  run(async () => {
                    await api.post(`/integration/sessions/${callId}/summary`, {
                      clientId: participant,
                      share: true,
                      expectedRevision:
                        data.session.summaries?.[participant]?.revision || 0,
                      expectedCellRevision:
                        cells[localKey(participant, "sharedSummary")]?.revision,
                      consentEvidence: permissionEvidence,
                    });
                    setNotice("Summary shared only with the selected client.");
                  })
                }
              >
                Share reviewed summary with this client
              </button>
            </>
          )}
          <details>
            <summary>End-of-call checklist</summary>
            {[
              [
                "attendanceReviewed",
                "I reviewed attendance, including unknown/no-show/excused states",
              ],
              [
                "concernsReviewed",
                "I reviewed unresolved concerns and their owned actions",
              ],
              ["nextContactReviewed", "I confirmed the next promised contact"],
            ].map(([k, label]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={end[k]}
                  onChange={(e) => setEnd({ ...end, [k]: e.target.checked })}
                />
                {label}
              </label>
            ))}
            <label>
              Agreed outcome and next-contact evidence
              <textarea
                value={end.evidence}
                onChange={(e) => setEnd({ ...end, evidence: e.target.value })}
              />
            </label>
            <button
              disabled={
                busy ||
                readonly ||
                dirty ||
                !end.attendanceReviewed ||
                !end.concernsReviewed ||
                !end.nextContactReviewed ||
                !end.evidence.trim()
              }
              onClick={() =>
                run(async () => {
                  const r = await api.post(
                    `/integration/sessions/${callId}/end`,
                    { ...end, expectedRevision: data.session.revision },
                  );
                  setNotice(
                    `Checklist recorded. ${r.data.unresolvedActions} owned actions remain open.`,
                  );
                })
              }
            >
              Record end-of-call review
            </button>
          </details>
        </>
      )}
    </section>
  );
}
