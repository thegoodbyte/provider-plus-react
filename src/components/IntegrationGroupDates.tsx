import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import "./IntegrationPrograms.css";
const local = (iso: string) => {
  const d = new Date(iso);
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function IntegrationGroupDates() {
  const [data, setData] = useState<any>({ proposals: [], enrollments: [] }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [draft, setDraft] = useState<any>(null),
    [selected, setSelected] = useState(""),
    [reason, setReason] = useState(""),
    [slot, setSlot] = useState(""),
    [verified, setVerified] = useState(false),
    [due, setDue] = useState(""),
    [evidence, setEvidence] = useState("");
  const load = async () => {
    const r = await api.get("/integration/group-proposals");
    setData(r.data);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  const cohorts = Array.from(
      new Set<string>(data.enrollments.map((e: any) => e.retreatId)),
    ),
    cohort = data.enrollments.filter(
      (e: any) => e.retreatId === draft?.retreatId,
    ),
    keys = Array.from(
      new Set<string>(
        cohort.flatMap((e: any) => e.calls.map((c: any) => c.key)),
      ),
    );
  const row = data.proposals.find((p: any) => p._id === selected);
  useEffect(()=>{setVerified(false);setSlot('');},[row?.revision]);
  const edit = (p: any) => {
    setDraft({
      _id: p._id,
      expectedRevision: p.revision,
      retreatId: p.retreatId,
      groupKey: p.groupKey,
      title: p.title,
      durationMinutes: p.durationMinutes,
      facilitator: p.facilitator,
      enrollmentIds: p.participants
        .map((v: any) => v.enrollmentId)
        .filter((id: string) =>
          data.enrollments.some((e: any) => e._id === id),
        ),
      slots: p.slots.map((s: any) => ({
        localStart: s.localStart,
        facilitatorAvailable: s.facilitatorAvailable,
      })),
      replyDeadline: local(p.replyDeadline),
      reason: "",
      outsideWindowReason: "",
      collect: true,
    });
    setSelected(p._id);
    setVerified(false);
  };
  const field = (key: string, value: any) =>
    setDraft({ ...draft, [key]: value });
  return (
    <section className="integration-programs integration-care">
      <h3>Group dates & availability</h3>
      <p>
        Proposed dates are not invitations. Client votes use each client’s
        timezone. Verify facilitator availability in Calendly; staff chooses the
        final date without requiring unanimity.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button disabled={busy} onClick={()=>run(load)}>Refresh group dates & responses</button>
      <button
        disabled={busy}
        onClick={() => {
          setSelected("");
          setDraft({
            requestId: crypto.randomUUID(),
            retreatId: "",
            groupKey: "",
            title: "Group integration call",
            durationMinutes: 75,
            facilitator: "",
            enrollmentIds: [],
            slots: [
              { localStart: "", facilitatorAvailable: false },
              { localStart: "", facilitatorAvailable: false },
            ],
            replyDeadline: "",
            reason: "",
            outsideWindowReason: "",
            collect: false,
          });
        }}
      >
        New group proposal
      </button>
      {draft && (
        <fieldset disabled={busy}>
          <legend>
            {draft._id ? "Move / re-propose dates" : "Propose dates"}
          </legend>
          <p>
            Dates below are in Europe/Prague. Current confirmed calls stay in
            place until a replacement is explicitly confirmed.
          </p>
          <label>
            Retreat{" "}
            <select
              disabled={!!draft._id}
              value={draft.retreatId}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  retreatId: e.target.value,
                  groupKey: "",
                  enrollmentIds: data.enrollments
                    .filter((v: any) => v.retreatId === e.target.value)
                    .map((v: any) => v._id),
                })
              }
            >
              <option value="">Choose retreat</option>
              {cohorts.map((id) => (
                <option key={id} value={id}>
                  {data.enrollments.find((e: any) => e.retreatId === id)
                    ?.retreatName || id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Program group call{" "}
            <select
              disabled={!!draft._id}
              value={draft.groupKey}
              onChange={(e) => {
                const call = cohort
                  .flatMap((v: any) => v.calls)
                  .find((c: any) => c.key === e.target.value);
                setDraft({
                  ...draft,
                  groupKey: e.target.value,
                  title: call?.title || draft.title,
                  durationMinutes: call?.durationMinutes || 75,
                });
              }}
            >
              <option value="">Choose configured call</option>
              {keys.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <p>
            Add more calls in Programs & enrollments, then explicitly
            review/apply the new program to clients.
          </p>
          <label>
            Call title{" "}
            <input
              value={draft.title}
              onChange={(e) => field("title", e.target.value)}
              maxLength={160}
            />
          </label>
          <label>
            Facilitator{" "}
            <input
              value={draft.facilitator}
              onChange={(e) => field("facilitator", e.target.value)}
              maxLength={160}
            />
          </label>
          <label>
            Duration in minutes{" "}
            <input
              type="number"
              min={15}
              max={240}
              value={draft.durationMinutes}
              onChange={(e) => field("durationMinutes", Number(e.target.value))}
            />
          </label>
          <div>
            {cohort.map((e: any) => {
              const c = e.calls.find((c: any) => c.key === draft.groupKey);
              return (
                <label key={e._id}>
                  <input
                    type="checkbox"
                    checked={draft.enrollmentIds.includes(e._id)}
                    onChange={(v) =>
                      field(
                        "enrollmentIds",
                        v.target.checked
                          ? [...draft.enrollmentIds, e._id]
                          : draft.enrollmentIds.filter(
                              (id: string) => id !== e._id,
                            ),
                      )
                    }
                  />
                  {e.clientName || e.clientId} ·{" "}
                  {c
                    ? `${c.earliestDate}–${c.latestDate} (target ${c.targetDate})`
                    : "Call not configured for this enrollment"}
                </label>
              );
            })}
          </div>
          {draft.slots.map((s: any, i: number) => (
            <div key={i}>
              <label>
                Proposed date {i + 1} (Prague){" "}
                <input
                  type="datetime-local"
                  value={s.localStart}
                  onChange={(e) =>
                    field(
                      "slots",
                      draft.slots.map((v: any, j: number) =>
                        j === i
                          ? {
                              ...v,
                              localStart: e.target.value,
                              facilitatorAvailable: false,
                            }
                          : v,
                      ),
                    )
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={s.facilitatorAvailable}
                  onChange={(e) =>
                    field(
                      "slots",
                      draft.slots.map((v: any, j: number) =>
                        j === i
                          ? { ...v, facilitatorAvailable: e.target.checked }
                          : v,
                      ),
                    )
                  }
                />
                Facilitator available for date {i + 1} (checked in Calendly)
              </label>
            </div>
          ))}
          {draft.slots.length === 2 ? (
            <button
              onClick={() =>
                field("slots", [
                  ...draft.slots,
                  { localStart: "", facilitatorAvailable: false },
                ])
              }
            >
              Add third proposed date
            </button>
          ) : (
            <button onClick={() => field("slots", draft.slots.slice(0, 2))}>
              Remove third proposed date
            </button>
          )}
          <label>
            Reply deadline (your browser timezone){" "}
            <input
              type="datetime-local"
              value={draft.replyDeadline}
              onChange={(e) => field("replyDeadline", e.target.value)}
            />
          </label>
          <label>
            Proposal / change reason and availability evidence{" "}
            <textarea
              value={draft.reason}
              onChange={(e) => field("reason", e.target.value)}
              maxLength={2000}
            />
          </label>
          <label>
            Outside-window reason, if needed{" "}
            <textarea
              value={draft.outsideWindowReason}
              onChange={(e) => field("outsideWindowReason", e.target.value)}
              maxLength={2000}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.collect}
              onChange={(e) => field("collect", e.target.checked)}
            />
            Open availability voting in client portal
          </label>
          <button
            disabled={!draft.reason.trim() || !draft.replyDeadline}
            onClick={() =>
              run(async () => {
                const b = {
                  ...draft,
                  replyDeadline: new Date(draft.replyDeadline).toISOString(),
                };
                const r = draft._id
                  ? await api.patch(
                      `/integration/group-proposals/${draft._id}`,
                      b,
                    )
                  : await api.post("/integration/group-proposals", b);
                setSelected(r.data._id);
                setDraft(null);
                setNotice("Proposal saved. No invitation sent.");
              })
            }
          >
            Save proposed dates
          </button>
          <button onClick={() => setDraft(null)}>Close editor</button>
        </fieldset>
      )}
      <label>
        Existing group proposal{" "}
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setDraft(null);
            setVerified(false);
            setSlot("");
          }}
        >
          <option value="">Choose proposal</option>
          {data.proposals.map((p: any) => (
            <option key={p._id} value={p._id}>
              {p.title} · {p.status} · version {p.proposalVersion}
            </option>
          ))}
        </select>
      </label>
      {row && (
        <>
          <h4>
            {row.title} ·{" "}
            {row.status === "confirmed" ? "CONFIRMED" : "PROPOSED"} ·{" "}
            {row.status}
          </h4>
          <p>
            Reply by {new Date(row.replyDeadline).toLocaleString()}. Revision{" "}
            {row.revision}.
          </p>
          {row.confirmed && (
            <p>
              Current confirmed date:{" "}
              {new Date(row.confirmed.startsAt).toLocaleString()} · appointment
              revision {row.confirmed.revision}. Invitation delivery is managed
              separately.
            </p>
          )}
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Group consent</th>
                  {row.slots.map((s: any) => (
                    <th key={s.key}>
                      {new Date(s.startsAt).toLocaleString()}
                      <br />
                      Facilitator{" "}
                      {s.facilitatorAvailable ? "available" : "not verified"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row.participants.map((p: any) => {
                  const v = row.votes[p.clientId];
                  return (
                    <tr key={p.clientId}>
                      <th>{p.name || p.clientId}</th>
                      <td>
                        {v
                          ? v.groupConsent
                            ? "Agreed"
                            : "Personal alternative requested"
                          : "No response"}
                      </td>
                      {row.slots.map((s: any) => (
                        <td key={s.key}>
                          {v?.answers[s.key] || "No response"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <fieldset disabled={busy || !!draft}>
            <legend>Staff decision</legend>
            <label>
              Decision / cancellation reason{" "}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2000}
              />
            </label>
            {["collecting", "awaiting_confirmation", "confirming"].includes(
              row.status,
            ) && (
              <>
                <label>
                  Final proposed date{" "}
                  <select
                    value={slot}
                    onChange={(e) => {
                      setSlot(e.target.value);
                      setVerified(false);
                    }}
                  >
                    <option value="">Choose a date</option>
                    {row.slots.map((s: any) => (
                      <option
                        disabled={!s.facilitatorAvailable}
                        key={s.key}
                        value={s.key}
                      >
                        {new Date(s.startsAt).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                  />
                  I verified facilitator availability in Calendly and reviewed
                  the responses
                </label>
                <label>
                  Alternative personal contact due by{" "}
                  <input
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
                <button
                  disabled={!slot || !verified || !reason.trim()}
                  onClick={() =>
                    run(async () => {
                      await api.post(
                        `/integration/group-proposals/${row._id}/confirm`,
                        {
                          expectedRevision: row.revision,
                          proposalVersion: row.proposalVersion,
                          slotKey: slot,
                          reason,
                          facilitatorAvailabilityVerified: verified,
                          alternativeDueDate: due,
                        },
                      );
                      setNotice(
                        "Date confirmed in calendar. Invitation adapter is pending; no proposal email was sent.",
                      );
                    })
                  }
                >
                  Confirm selected date
                </button>
              </>
            )}
            {!["cancelled", "completed"].includes(row.status) && (
              <>
                <button
                  disabled={row.status === "confirming"}
                  onClick={() => edit(row)}
                >
                  Move / re-propose dates
                </button>
                <button
                  disabled={!reason.trim()}
                  onClick={() =>
                    run(async () => {
                      await api.post(
                        `/integration/group-proposals/${row._id}/cancel`,
                        { expectedRevision: row.revision, reason },
                      );
                      setNotice("Cancelled; calendar history preserved.");
                    })
                  }
                >
                  Cancel group call
                </button>
              </>
            )}
          </fieldset>
          <h4>Alternative personal contacts</h4>
          <label>
            Contact outcome and agreed next action{" "}
            <textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              maxLength={2000}
            />
          </label>
          {row.participants
            .filter((p: any) => p.alternative)
            .map((p: any) => (
              <article key={p.clientId}>
                <p>
                  {p.name} · {p.alternative.status} · owner{" "}
                  {p.alternative.owner}, backup {p.alternative.backup} · due{" "}
                  {p.alternative.dueDate}
                </p>
                <p>{p.alternative.evidence}</p>
                <button
                  disabled={busy || !evidence.trim()}
                  onClick={() =>
                    run(async () => {
                      await api.post(
                        `/integration/group-proposals/${row._id}/alternatives/${p.clientId}`,
                        {
                          expectedRevision: row.revision,
                          status:
                            p.alternative.status === "completed"
                              ? "open"
                              : "completed",
                          evidence,
                        },
                      );
                      setEvidence("");
                    })
                  }
                >
                  {p.alternative.status === "completed"
                    ? "Reopen contact follow-up"
                    : "Record completed contact follow-up"}
                </button>
              </article>
            ))}
          <details>
            <summary>Previous proposals and audit history</summary>
            {row.versions.map((v: any) => (
              <p key={v.version}>
                Proposal {v.version} ·{" "}
                {v.slots
                  .map((s: any) => new Date(s.startsAt).toLocaleString())
                  .join(" / ")}{" "}
                · {Object.keys(v.votes).length} preserved responses
              </p>
            ))}
            {row.history.map((h: any, i: number) => (
              <p key={i}>
                {new Date(h.at).toLocaleString()} · {h.actor} · {h.action} ·{" "}
                {h.reason || h.evidence}
              </p>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
