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
    [busy, setBusy] = useState(false),
    [chosen, setChosen] = useState<string[]>([]),
    [preview, setPreview] = useState<any>(),
    [batchReviewed, setBatchReviewed] = useState(false),
    [policy, setPolicy] = useState<any>({
      owner: "",
      backup: "",
      maxBatchSize: 5,
      responseDays: 2,
      reminderDays: 0,
      capacityEvidence: "",
    }),
    [offer, setOffer] = useState<any>({
      kind: "conversation",
      sessionCount: 0,
      durationMinutes: 30,
      accessDays: 60,
      programId: "",
      programVersion: 0,
      reviewed: false,
      evidence: "",
    });
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
    setPreview(undefined);
    setChosen([]);
    setError("");
    load().catch((e) => {
      if (live) setError(e.response?.data?.message || e.message);
    });
    return () => {
      live = false;
    };
  }, [user?.id, before]);
  useEffect(() => {
    setBatchReviewed(false);
  }, [preview]);
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
                    <label>
                      <input
                        type="checkbox"
                        aria-label={"Select " + r.name + " for reconnection"}
                        disabled={busy || user?.readOnly}
                        checked={chosen.includes(r.clientId)}
                        onChange={(e) => {
                          setChosen(
                            e.target.checked
                              ? [...chosen, r.clientId]
                              : chosen.filter((id) => id !== r.clientId),
                          );
                          setPreview(undefined);
                        }}
                      />
                      Batch selection
                    </label>
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
                        {r.outreach.initialDelivery && (
                          <p>
                            Initial delivery:{" "}
                            {r.outreach.initialDelivery.status} ·{" "}
                            {r.outreach.initialDelivery.reason}
                          </p>
                        )}
                        {r.outreach.replyReceivedAt && (
                          <p>
                            Verified reply received. Further reminders are
                            stopped.
                          </p>
                        )}
                        {!!r.outreach.pendingReplyCount && (
                          <p role="status">
                            {r.outreach.pendingReplyCount} reply(s) still need
                            an owned task. Routing will retry; review the inbox
                            now.
                          </p>
                        )}
                        {r.outreach.replyTaskId && (
                          <p>Owned reply task: {r.outreach.replyTaskId}</p>
                        )}
                        {r.outreach.offerDecision && (
                          <p>
                            Client offer decision: {r.outreach.offerDecision}.
                            {r.outreach.legacyEnrollmentId
                              ? " Separate legacy grant recorded."
                              : r.outreach.offerDecision === "accepted"
                                ? " Fulfilment is still owed; no session grant yet."
                                : " Respect the decline; no offer reminder."}
                          </p>
                        )}
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
      {data && (
        <details>
          <summary>Preview a reviewed reconnection batch</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const r = await api.post("/integration/reconnect/preview", {
                  clientIds: chosen,
                  policy,
                  offer,
                });
                setPreview(r.data);
              }, false);
            }}
          >
            <p>
              {chosen.length} clients selected. No enrollment or credits are
              automatically granted by this outreach.
            </p>
            <label>
              Owner
              <select
                required
                aria-label="Reconnection owner"
                value={policy.owner}
                onChange={(e) => {
                  setPolicy({ ...policy, owner: e.target.value });
                  setPreview(undefined);
                }}
              >
                <option value="">Choose named owner</option>
                {data.staff?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Backup
              <select
                required
                aria-label="Reconnection backup"
                value={policy.backup}
                onChange={(e) => {
                  setPolicy({ ...policy, backup: e.target.value });
                  setPreview(undefined);
                }}
              >
                <option value="">Choose named backup</option>
                {data.staff?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Maximum reviewed batch size
              <input
                type="number"
                required
                min={1}
                max={50}
                value={policy.maxBatchSize}
                onChange={(e) => {
                  setPolicy({
                    ...policy,
                    maxBatchSize: Number(e.target.value),
                  });
                  setPreview(undefined);
                }}
              />
            </label>
            <label>
              Reply follow-up deadline in days
              <input
                type="number"
                required
                min={1}
                max={14}
                value={policy.responseDays}
                onChange={(e) => {
                  setPolicy({
                    ...policy,
                    responseDays: Number(e.target.value),
                  });
                  setPreview(undefined);
                }}
              />
            </label>
            <label>
              Optional single reminder
              <select
                aria-label="Optional single reminder"
                value={policy.reminderDays}
                onChange={(e) => {
                  setPolicy({
                    ...policy,
                    reminderDays: Number(e.target.value),
                  });
                  setPreview(undefined);
                }}
              >
                <option value={0}>No reminder</option>
                {[10, 11, 12, 13, 14].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reviewed availability / response capacity evidence
              <textarea
                required
                maxLength={4000}
                aria-label="Reviewed availability / response capacity evidence"
                value={policy.capacityEvidence}
                onChange={(e) => {
                  setPolicy({ ...policy, capacityEvidence: e.target.value });
                  setPreview(undefined);
                }}
              />
            </label>
            <label>
              Explicit legacy offer
              <select
                aria-label="Explicit legacy offer"
                value={offer.kind}
                onChange={(e) => {
                  setOffer({
                    ...offer,
                    kind: e.target.value,
                    sessionCount: e.target.value === "conversation" ? 0 : 1,
                    reviewed: false,
                  });
                  setPreview(undefined);
                }}
              >
                <option value="conversation">
                  Agree a conversation; no automatic entitlement
                </option>
                <option value="sessions">
                  Explicit legacy personal sessions
                </option>
                <option value="program">
                  Explicit published legacy programme
                </option>
              </select>
            </label>
            {offer.kind !== "conversation" && (
              <>
                <label>
                  Offered sessions
                  <input
                    required
                    type="number"
                    min={1}
                    max={6}
                    value={offer.sessionCount}
                    onChange={(e) => {
                      setOffer({
                        ...offer,
                        sessionCount: Number(e.target.value),
                        reviewed: false,
                      });
                      setPreview(undefined);
                    }}
                  />
                </label>
                <label>
                  Access days after explicit agreement
                  <input
                    required
                    type="number"
                    min={7}
                    max={365}
                    value={offer.accessDays}
                    onChange={(e) => {
                      setOffer({
                        ...offer,
                        accessDays: Number(e.target.value),
                        reviewed: false,
                      });
                      setPreview(undefined);
                    }}
                  />
                </label>
                <p>
                  Each offered session is 30 minutes and separate from the
                  original retreat entitlement.
                </p>
              </>
            )}
            {offer.kind === "program" && (
              <label>
                Published programme
                <select
                  required
                  aria-label="Published legacy programme"
                  value={
                    offer.programId
                      ? offer.programId + "|" + offer.programVersion
                      : ""
                  }
                  onChange={(e) => {
                    const p = data.programs.find(
                      (p: any) => p.id + "|" + p.version === e.target.value,
                    );
                    setOffer({
                      ...offer,
                      programId: p?.id || "",
                      programVersion: p?.version || 0,
                      sessionCount: p?.personal?.count || 1,
                      accessDays: p?.personal?.accessDays || 60,
                      reviewed: false,
                    });
                    setPreview(undefined);
                  }}
                >
                  <option value="">Choose published legacy programme</option>
                  {data.programs?.map((p: any) => (
                    <option
                      key={p.id + "|" + p.version}
                      value={p.id + "|" + p.version}
                    >
                      {p.name} · version {p.version}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Legacy offer review evidence
              <textarea
                required
                maxLength={4000}
                aria-label="Legacy offer review evidence"
                value={offer.evidence}
                onChange={(e) => {
                  setOffer({
                    ...offer,
                    evidence: e.target.value,
                    reviewed: false,
                  });
                  setPreview(undefined);
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={offer.reviewed}
                onChange={(e) => {
                  setOffer({ ...offer, reviewed: e.target.checked });
                  setPreview(undefined);
                }}
              />
              I reviewed this explicit legacy offer and its capacity
            </label>
            <button
              disabled={
                busy || user?.readOnly || !chosen.length || !offer.reviewed
              }
            >
              Preview recipients, text and capacity
            </button>
          </form>
          {preview && (
            <section aria-label="Reviewed reconnection preview">
              <p>
                {preview.eligibleCount} eligible · {preview.heldCount} held ·{" "}
                {preview.totalSessionsOffered} sessions /{" "}
                {preview.totalSessionMinutes} minutes offered.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={batchReviewed}
                  onChange={(e) => setBatchReviewed(e.target.checked)}
                />
                I reviewed recipients, suppression, legacy offers and response
                capacity
              </label>
              <button
                disabled={
                  busy ||
                  user?.readOnly ||
                  !batchReviewed ||
                  !preview.eligibleCount
                }
                onClick={() =>
                  run(async () => {
                    const result = await api.post(
                      "/integration/reconnect/queue",
                      {
                        clientIds: chosen,
                        policy,
                        offer,
                        previewHash: preview.previewHash,
                        reviewed: batchReviewed,
                      },
                    );
                    setNotice(
                      result.data.alreadyPrepared
                        ? "This reviewed batch already exists; no duplicate campaign created."
                        : `${result.data.queued} records queued for gated delivery. This action sends no messages and grants no enrollment or credits.`,
                    );
                    setBatchReviewed(false);
                  }, false)
                }
              >
                Queue reviewed reconnection batch
              </button>
              {preview.candidates.map((c: any) => (
                <article key={c.clientId}>
                  <h4>
                    {c.name} · {c.recipient}
                  </h4>
                  <p>
                    {c.language.toUpperCase()}
                    {c.languageFallback
                      ? " · English fallback — review comprehension"
                      : ""}
                  </p>
                  <p>{c.reasons.join(" ")}</p>
                  <strong>{c.subject}</strong>
                  <p style={{ whiteSpace: "pre-wrap" }}>{c.bodyText}</p>
                  {c.reminder && (
                    <section aria-label="Single reminder preview">
                      <h5>
                        One optional reminder after{" "}
                        {preview.policy.reminderDays} days
                      </h5>
                      <strong>{c.reminder.subject}</strong>
                      <p style={{ whiteSpace: "pre-wrap" }}>
                        {c.reminder.bodyText}
                      </p>
                      <p>
                        Cancelled after any verified reply or opt-out; expires
                        after day 14.
                      </p>
                    </section>
                  )}
                </article>
              ))}
            </section>
          )}
        </details>
      )}
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
                aria-label="Permission / opt-out source evidence"
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
                aria-label="Human contact evidence"
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
