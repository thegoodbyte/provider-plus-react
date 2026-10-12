import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import "./IntegrationPrograms.css";
export default function IntegrationGroupInvitations() {
  const [data, setData] = useState<any>({ calls: [], groups: [] }),
    [id, setId] = useState(""),
    [proposalId, setProposalId] = useState(""),
    [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    const [r, g] = await Promise.all([
      api.get("/integration/group-invitations"),
      api.get("/integration/group-proposals"),
    ]);
    setData({ ...r.data, groups: g.data.proposals });
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
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  const call = data.calls.find((c: any) => c._id === id);
  return (
    <section className="integration-programs integration-care">
      <h3>Group invitations & RSVP</h3>
      <p>
        Meeting readiness, email delivery, client RSVP and actual attendance are
        tracked separately. Reviewed content, communication preferences, quiet
        hours and contact caps apply. Each calendar attachment has one attendee.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button
        disabled={busy}
        onClick={() =>
          run(async () => {
            await load();
          })
        }
      >
        Refresh group invitation status
      </button>
      <button
        disabled={busy}
        onClick={() =>
          run(async () => {
            const r = await api.post("/integration/group-invitations/process");
            await load();
            setNotice(
              `Prepared ${r.data.processed} group sources; review held recipients. No email was sent by this preparation action.`,
            );
          })
        }
      >
        Prepare reviewed group notices
      </button>
      <label>
        Confirmed group call{" "}
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setPreview(null);
          }}
        >
          <option value="">Choose call</option>
          {data.calls.map((c: any) => (
            <option key={c._id} value={c._id}>
              {c.title} · {new Date(c.startsAt).toLocaleString()} · {c.status}
            </option>
          ))}
        </select>
      </label>
      {call && (
        <>
          <p>
            Appointment revision {call.appointmentRevision} · provider revision{" "}
            {call.providerRevision || 0} · preparation {call.invitationStatus}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await api.get(
                  `/integration/group-invitations/calls/${id}/preview`,
                );
                setPreview(r.data);
              })
            }
          >
            Preview current invitation updates
          </button>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Notice</th>
                  <th>Email delivery</th>
                  <th>RSVP</th>
                  <th>Owner / next action</th>
                </tr>
              </thead>
              <tbody>
                {call.recipients.map((r: any) => (
                  <tr key={r._id}>
                    <th>{r.name}</th>
                    <td>
                      {r.action || "Not prepared"} · revision{" "}
                      {r.invitationRevision || 0}
                    </td>
                    <td>
                      {r.delivery?.status || r.status}
                      <br />
                      {r.delivery?.reason || r.reason}
                    </td>
                    <td>{r.rsvp || "unknown"}</td>
                    <td>
                      {r.owner} · backup {r.backup} · due {r.dueDate}
                      <br />
                      {r.rsvp === "declined"
                        ? "Arrange alternative personal contact in Group dates."
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!call.recipients.length && (
            <p>
              No recipient notices prepared yet. Preview the current call to see
              channel/content eligibility.
            </p>
          )}
        </>
      )}
      <details>
        <summary>Availability notice for an open proposal</summary>
        <p>
          Choose the proposed dates being collected in Group dates. This notice
          asks for availability; it has no calendar attachment.
        </p>
        <label>
          Open group proposal{" "}
          <select
            value={proposalId}
            onChange={(e) => {
              setProposalId(e.target.value);
              setPreview(null);
            }}
          >
            <option value="">Choose proposal</option>
            {data.groups
              .filter((g: any) =>
                ["collecting", "awaiting_confirmation"].includes(g.status),
              )
              .map((g: any) => (
                <option key={g._id} value={g._id}>
                  {g.title} · proposal {g.proposalVersion}
                </option>
              ))}
          </select>
        </label>
        <button
          disabled={busy || !proposalId.trim()}
          onClick={() =>
            run(async () => {
              const r = await api.get(
                `/integration/group-invitations/proposals/${proposalId}/preview`,
              );
              setPreview(r.data);
            })
          }
        >
          Preview availability notices
        </button>
      </details>
      {preview && (
        <>
          <h4>
            {preview.isProposal
              ? "Proposed date notice"
              : "Confirmed appointment notice"}{" "}
            · {preview.candidates.length} recipients
          </h4>
          {preview.candidates.map((c: any) => (
            <article key={c._id}>
              <p>
                <strong>{c.clientName}</strong> · {c.groupMessage} ·{" "}
                {c.language} · {c.timezone}
              </p>
              <p>{c.recipient}</p>
              {c.reasons.length > 0 && (
                <p role="alert">{c.reasons.join(" ")}</p>
              )}
              <p>{c.subject}</p>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {c.bodyText}
              </pre>
              <p>
                {c.attachments?.length
                  ? "Individual calendar attachment included."
                  : "No calendar attachment."}
              </p>
            </article>
          ))}
          <button
            disabled={busy || !preview.candidates.length}
            onClick={() =>
              run(async () => {
                const path = preview.isProposal
                  ? `proposals/${preview.groupId}`
                  : `calls/${preview.callId}`;
                const r = await api.post(
                  `/integration/group-invitations/${path}/queue`,
                  { reviewed: true, previewHash: preview.previewHash },
                );
                await load();
                setPreview(null);
                setNotice(
                  `${r.data.queued} queued, ${r.data.held} held for review. Delivery is shown separately.`,
                );
              })
            }
          >
            Queue reviewed eligible notices
          </button>
        </>
      )}
      <p>
        Review or seed the group invite, update, cancellation and availability
        templates in Supportive content. Publish the response policy and approve
        each message before queueing. Delivery failures and uncertain receipts
        are resolved in Delivery & preferences.
      </p>
    </section>
  );
}
