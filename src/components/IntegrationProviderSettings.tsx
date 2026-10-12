import React, { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import "./IntegrationPrograms.css";
export default function IntegrationProviderSettings() {
  const loadId = useRef(0);
  const [rows, setRows] = useState<any[]>([]),
    [provider, setProvider] = useState("calendly"),
    [draft, setDraft] = useState<any>(null),
    [secrets, setSecrets] = useState<any>({}),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [discovery, setDiscovery] = useState<any>(null),
    [queue, setQueue] = useState<any>(null),
    [reason, setReason] = useState(""),
    [enrollmentId, setEnrollmentId] = useState("");
  const load = async () => {
    const requestId = ++loadId.current;
    const r = await api.get("/external-resources");
    if (requestId !== loadId.current) return;
    setRows(r.data.resources);
    const chosen = r.data.resources.find((v: any) => v.provider === provider);
    setDraft(chosen);
    setSecrets({});
    setDirty(false);
    {
      const q = await api.get(`/integration/providers/${provider}`);
      if (requestId === loadId.current) setQueue(q.data);
    }
    return chosen;
  };
  useEffect(() => {
    load().catch((e) => setError(e.response?.data?.message || e.message));
  }, [provider]);
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
  const option = (key: string, value: any) => {
    setDraft({
      ...draft,
      enabled: false,
      options: { ...draft.options, [key]: value },
    });
    setDirty(true);
  };
  const save = (enabled = false, disconnect = false) =>
    run(async () => {
      const r = await api.post(`/external-resources/${provider}`, {
        expectedRevision: draft.revision,
        mode: draft.mode,
        enabled,
        options: draft.options,
        secrets,
        disconnect,
      });
      setDraft(r.data);
      setSecrets({});
      setDirty(false);
      setNotice(
        disconnect
          ? "Account disconnected; prior appointment/history retained."
          : "Resource settings saved without returning secrets.",
      );
    });
  if (!draft || draft.provider !== provider)
    return (
      <p role={error ? "alert" : undefined}>
        {error || "Loading environment resource settings…"}
      </p>
    );
  return (
    <section className="integration-programs integration-care">
      <h3>External resource settings</h3>
      <p>
        Administrator-only environment settings shared by integration providers.
        Calendly supplies working hours, buffers, minimum notice and
        connected-calendar availability. Manage those in Calendly and verify
        them here; the app does not create another availability schedule.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <label>
        Provider{" "}
        <select
          disabled={busy}
          value={provider}
          onChange={(e) => {
            loadId.current++;
            setDraft(null);
            setProvider(e.target.value);
            setDiscovery(null);
            setQueue(null);
          }}
        >
          <option value="calendly">Calendly personal sessions</option>
          <option value="zoom">Zoom group meetings</option>
        </select>
      </label>
      <p>
        Environment: <strong>{draft.environment}</strong> · {draft.mode} ·{" "}
        {draft.enabled ? "enabled" : "disabled"} · saved revision{" "}
        {draft.revision}. Secret storage:{" "}
        {draft.secretStorageReady
          ? "ready"
          : "deployment encryption key needed"}
        .
      </p>
      <fieldset disabled={busy}>
        <label>
          Connection mode{" "}
          <select
            value={draft.mode}
            onChange={(e) => {
              setDraft({ ...draft, mode: e.target.value, enabled: false });
              setDirty(true);
            }}
          >
            <option value="sandbox">
              Sandbox — synthetic fixtures, no provider writes
            </option>
            {draft.environment === "production" && (
              <option value="live">Live — verified production account</option>
            )}
          </select>
        </label>
        <label>
          Provider API origin{" "}
          <input
            value={draft.options.apiOrigin}
            onChange={(e) => option("apiOrigin", e.target.value)}
          />
        </label>
        {provider === "calendly" ? (
          <>
            <label>
              Staff user URI{" "}
              <input
                value={draft.options.userUri}
                onChange={(e) => option("userUri", e.target.value)}
              />
            </label>
            <label>
              Organization URI{" "}
              <input
                value={draft.options.organizationUri}
                onChange={(e) => option("organizationUri", e.target.value)}
              />
            </label>
            <label>
              Event type URI{" "}
              <input
                value={draft.options.eventTypeUri}
                onChange={(e) => option("eventTypeUri", e.target.value)}
              />
            </label>
            <label>
              Evergreen scheduling URL{" "}
              <input
                value={draft.options.bookingUrl}
                onChange={(e) => option("bookingUrl", e.target.value)}
              />
            </label>
            <label>
              Reconciliation owner{" "}
              <input
                value={draft.options.queueOwner}
                onChange={(e) => option("queueOwner", e.target.value)}
              />
            </label>
            <label>
              Reconciliation backup{" "}
              <input
                value={draft.options.queueBackup}
                onChange={(e) => option("queueBackup", e.target.value)}
              />
            </label>
            <p>
              Personal appointment confirmations, native Zoom invitations and
              reminders are owned by Calendly. RE supportive emails are
              separate.
            </p>
            <a
              href="https://calendly.com/event_types"
              target="_blank"
              rel="noreferrer"
            >
              Manage Calendly event type, working hours, buffers and minimum
              notice
            </a>
            <label>
              Connected calendars, buffers/notice, Scheduling API permissions
              and native reminders reviewed{" "}
              <input
                type="checkbox"
                checked={draft.options.accountSettingsReviewed}
                onChange={(e) =>
                  option("accountSettingsReviewed", e.target.checked)
                }
              />
            </label>
            <label>
              Account settings review evidence{" "}
              <textarea
                value={draft.options.accountSettingsEvidence}
                onChange={(e) =>
                  option("accountSettingsEvidence", e.target.value)
                }
                maxLength={2000}
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Zoom host user ID{" "}
              <input
                value={draft.options.hostUserId}
                onChange={(e) => option("hostUserId", e.target.value)}
              />
            </label>
            <p>
              Zoom uses an activated Server-to-Server OAuth app. Confirm the
              licensed host, capacity and scopes. Recording and AI summaries
              stay off. RE owns group invitations; meeting readiness is separate
              from invitation delivery.
            </p>
            <label>
              <input
                type="checkbox"
                checked={draft.options.waitingRoom}
                onChange={(e) => option("waitingRoom", e.target.checked)}
              />
              Waiting room enabled
            </label>
            <p>
              A passcode is always required. Leave the saved passcode blank to
              generate a strong passcode for each new meeting.
            </p>
            <label>
              Reconciliation owner{" "}
              <input
                value={draft.options.queueOwner || ""}
                onChange={(e) => option("queueOwner", e.target.value)}
              />
            </label>
            <label>
              Reconciliation backup{" "}
              <input
                value={draft.options.queueBackup || ""}
                onChange={(e) => option("queueBackup", e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={!!draft.options.accountSettingsReviewed}
                onChange={(e) =>
                  option("accountSettingsReviewed", e.target.checked)
                }
              />
              Licensed host, account capacity, recording/AI locks and passcode
              policy reviewed
            </label>
            <label>
              Account settings review evidence{" "}
              <textarea
                value={draft.options.accountSettingsEvidence || ""}
                maxLength={2000}
                onChange={(e) =>
                  option("accountSettingsEvidence", e.target.value)
                }
              />
            </label>
          </>
        )}
        {(provider === "calendly"
          ? ["accessToken", "webhookKey"]
          : ["accountId", "clientId", "clientSecret", "meetingPasscode"]
        ).map((k) => (
          <label key={k}>
            {
              (
                {
                  accessToken: "Access token",
                  webhookKey: "Webhook signing key",
                  accountId: "Account ID",
                  clientId: "Client ID",
                  clientSecret: "Client secret",
                  meetingPasscode: "Optional meeting passcode",
                } as any
              )[k]
            }{" "}
            · {draft.configuredSecrets[k] ? "saved (hidden)" : "not configured"}
            <input
              type="password"
              autoComplete="new-password"
              value={secrets[k] || ""}
              onChange={(e) => {
                setSecrets({ ...secrets, [k]: e.target.value });
                setDraft({ ...draft, enabled: false });
                setDirty(true);
              }}
              placeholder="Leave blank to retain saved value"
            />
          </label>
        ))}
        <button onClick={() => save(false)}>
          Save disabled connection settings
        </button>
        <button
          disabled={dirty || !draft.health?.verified}
          onClick={() => save(true)}
        >
          Enable verified unchanged connection
        </button>
        <button onClick={() => save(false, true)}>
          Disconnect account and remove saved secrets
        </button>
      </fieldset>
      <button
        disabled={busy || dirty}
        onClick={() =>
          run(async () => {
            await load();
          })
        }
      >
        Refresh connection and reconciliation queue
      </button>
      {provider === "calendly" && (
        <>
          <button
            disabled={busy || dirty || draft.enabled || !draft.revision}
            onClick={() =>
              run(async () => {
                await api.post("/integration/providers/calendly/test");
                await load();
                setNotice(
                  "Connection test completed; no provider write or invitation was made.",
                );
              })
            }
          >
            Test connection read-only
          </button>
          <button
            disabled={
              busy ||
              dirty ||
              !draft.configuredSecrets.accessToken ||
              draft.mode !== "live"
            }
            onClick={() =>
              run(async () => {
                const r = await api.get(
                  "/integration/providers/calendly/discover",
                );
                setDiscovery(r.data);
              })
            }
          >
            Read account staff and event types
          </button>
          {discovery && (
            <>
              <p>
                {discovery.user.name} · {discovery.user.uri}
              </p>
              <label>
                Select verified-account event type{" "}
                <select
                  value={draft.options.eventTypeUri}
                  onChange={(e) => {
                    const t = discovery.eventTypes.find(
                      (v: any) => v.uri === e.target.value,
                    );
                    if (t) {
                      setDraft({
                        ...draft,
                        enabled: false,
                        options: {
                          ...draft.options,
                          eventTypeUri: t.uri,
                          bookingUrl: t.schedulingUrl,
                          userUri: discovery.user.uri,
                          organizationUri: discovery.user.organizationUri,
                        },
                      });
                      setDirty(true);
                    }
                  }}
                >
                  <option value="">Choose event type</option>
                  {discovery.eventTypes.map((t: any) => (
                    <option key={t.uri} value={t.uri}>
                      {t.name} · {t.duration} min ·{" "}
                      {t.nativeZoom ? "native Zoom" : "Zoom review needed"}
                    </option>
                  ))}
                </select>
              </label>
              {discovery.moreAvailable && (
                <p>
                  More event types exist; select an exact URI from Calendly if
                  not listed.
                </p>
              )}
            </>
          )}
          <p>
            Webhook path: /integration/providers/calendly/webhook. Configure
            invitee.created and invitee.canceled with a signing key. Native Zoom
            must be connected in Calendly. Live booking remains gated by the
            deployment provider-write switch and a controlled account pilot.
          </p>
        </>
      )}
      {provider === "zoom" && (
        <>
          <button
            disabled={busy || dirty || draft.enabled || !draft.revision}
            onClick={() =>
              run(async () => {
                await api.post("/integration/providers/zoom/test");
                await load();
                setNotice(
                  "Host, capacity and scope check completed; no meeting or invitation created.",
                );
              })
            }
          >
            Test Zoom connection read-only
          </button>
          <button
            disabled={busy || dirty}
            onClick={() =>
              run(async () => {
                const r = await api.post("/integration/providers/zoom/process");
                await load();
                setNotice(
                  r.data.disabled
                    ? "Live Zoom operations are disabled; no provider writes."
                    : "Recorded group meeting operations processed. Review unresolved rows and invitation delivery separately.",
                );
              })
            }
          >
            Process confirmed group meeting updates
          </button>
          <h4>Group meeting operations</h4>
          <p>
            Uncertain creation is reconciled by its recorded reference. An empty
            lookup never authorizes creating another room.
          </p>
          {queue?.meetings?.length === 0 && (
            <p>No recorded group meeting operations.</p>
          )}
          {queue?.meetings?.map((m: any) => (
            <article key={m._id}>
              <p>
                Call {m.callId} · {m.status} · appointment revision{" "}
                {m.callRevision || 0}
              </p>
              <p>{m.reason}</p>
              <p>
                Owner {m.owner} · backup {m.backup} · due {m.dueDate}
              </p>
              {m.joinUrl && (
                <a href={m.joinUrl} target="_blank" rel="noreferrer">
                  Participant join link
                </a>
              )}
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api.post(
                      `/integration/providers/zoom/calls/${m.callId}/reconcile`,
                    );
                    await load();
                  })
                }
              >
                Reconcile recorded outcome
              </button>
              <button
                disabled={busy || !draft.enabled}
                onClick={() =>
                  run(async () => {
                    await api.post(
                      `/integration/providers/zoom/calls/${m.callId}/sync`,
                    );
                    await load();
                  })
                }
              >
                Apply current confirmed appointment revision
              </button>
              {m.status === "failed" && (
                <>
                  <label>
                    Verified rejection / correction evidence{" "}
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={2000}
                    />
                  </label>
                  <button
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      run(async () => {
                        await api.post(
                          `/integration/providers/zoom/calls/${m.callId}/retry-rejected`,
                          { evidence: reason },
                        );
                        await load();
                      })
                    }
                  >
                    Authorize retry of explicitly rejected creation
                  </button>
                </>
              )}
            </article>
          ))}
        </>
      )}
      {draft.health && (
        <p role="status">
          {draft.health.status}: {draft.health.message}
        </p>
      )}
      {provider === "calendly" && queue && (
        <>
          <h4>Bookings and events needing reconciliation</h4>
          <label>
            Verified reconciliation evidence{" "}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
            />
          </label>
          <label>
            Reviewed enrollment ID for an unmatched event{" "}
            <input
              value={enrollmentId}
              onChange={(e) => setEnrollmentId(e.target.value)}
            />
          </label>
          {!queue.pending.length && !queue.events.length && (
            <p>No pending reconciliation.</p>
          )}
          {queue.pending.map((p: any) => (
            <article key={p._id}>
              <p>
                Booking {p._id.slice(0, 8)} · {p.status} · {p.startsAt}
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api.post(
                      `/integration/providers/calendly/intents/${p._id}/reconcile`,
                    );
                    await load();
                  })
                }
              >
                Find provider receipt; keep hold if uncertain
              </button>
              <button
                disabled={busy || !reason.trim() || !!p.providerInvitee}
                onClick={() =>
                  run(async () => {
                    await api.post(
                      `/integration/providers/calendly/intents/${p._id}/release-verified`,
                      { providerOutcomeVerified: "not_created", reason },
                    );
                    await load();
                  })
                }
              >
                Record verified non-creation and release hold
              </button>
            </article>
          ))}
          {queue.events.map((e: any) => (
            <article key={e._id}>
              <p>
                {e.reason || e.status} · owner {e.owner}, backup {e.backup} ·
                due {e.dueDate} · {e.inviteeUri}
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api.post(
                      `/integration/providers/calendly/events/${e._id}/replay`,
                    );
                    await load();
                  })
                }
              >
                Reconcile current provider record
              </button>
              {e.status === "needs_resolution" && (
                <button
                  disabled={busy || !reason.trim() || !enrollmentId}
                  onClick={() =>
                    run(async () => {
                      await api.post(
                        `/integration/providers/calendly/events/${e._id}/match`,
                        { enrollmentId, reason },
                      );
                      await load();
                    })
                  }
                >
                  Record trusted identity match and reconcile
                </button>
              )}
            </article>
          ))}
        </>
      )}
      <details>
        <summary>Configuration audit</summary>
        {draft.history.map((h: any, i: number) => (
          <p key={i}>
            {new Date(h.at).toLocaleString()} · {h.actor} · {h.action} ·{" "}
            {h.fields.join(", ")}
          </p>
        ))}
      </details>
    </section>
  );
}
