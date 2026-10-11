import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import "./IntegrationPrograms.css";
const name = (e: any) =>
  [
    e.clientId?.firstName || e.clientId?.fname,
    e.clientId?.lastName || e.clientId?.lname,
  ]
    .filter(Boolean)
    .join(" ") || "Client";
export default function IntegrationDelivery() {
  const [data, setData] = useState<any>(null),
    [settings, setSettings] = useState<any>(null),
    [enrollmentId, setEnrollmentId] = useState("");
  const [preference, setPreference] = useState<any>(null),
    [preview, setPreview] = useState<any>(null),
    [templateId, setTemplateId] = useState("");
  const [approvalPolicyId, setApprovalPolicyId] = useState("");
  const [reference, setReference] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () => {
    const r = await api.get("/integration/delivery");
    setData(r.data);
    setSettings(r.data.settings);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || e.message));
  }, []);
  if (!data)
    return (
      <p role={error ? "alert" : undefined}>
        {error || "Loading integration delivery…"}
      </p>
    );
  const enrollment = data.enrollments.find((e: any) => e._id === enrollmentId);
  const template = data.templates.find((t: any) => t._id === templateId);
  const clientId = enrollment?.clientId?._id || enrollment?.clientId;
  const changePreference = (key: string, value: any) => {
    setPreference({ ...preference, [key]: value });
    setPreview(null);
  };
  return (
    <section className="integration-programs integration-care">
      <h3>Integration delivery</h3>
      <p>
        Review content, channel consent and recipients before queueing. Delivery
        and email opens never complete a human-care promise.
      </p>
      <p>
        Production delivery environment:{" "}
        {settings.environmentEnabled ? "Enabled" : "Disabled"} · worker{" "}
        {settings.enabled ? "enabled" : "disabled"} · last run{" "}
        {data.worker?.lastFinishedAt
          ? new Date(data.worker.lastFinishedAt).toLocaleString()
          : "not run"}
        .
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button type="button" disabled={busy} onClick={() => run(load)}>
        Refresh delivery queue
      </button>
      <details>
        <summary>Delivery worker settings</summary>
        <fieldset disabled={busy}>
          <label>
            Worker enabled{" "}
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
            Capacity and response coverage reviewed{" "}
            <input
              type="checkbox"
              checked={settings.capacityReviewed}
              onChange={(e) =>
                setSettings({ ...settings, capacityReviewed: e.target.checked })
              }
            />
          </label>
          <label>
            Supportive send time{" "}
            <input
              type="time"
              value={settings.sendTime}
              onChange={(e) => {
                setSettings({ ...settings, sendTime: e.target.value });
                setPreview(null);
              }}
            />
          </label>
          <label>
            Reminder hours before call (comma separated){" "}
            <input
              value={settings.reminderHours.join(",")}
              onChange={(e) => {
                setSettings({
                  ...settings,
                  reminderHours: e.target.value.trim()
                    ? e.target.value.split(",").map(Number)
                    : [],
                });
                setPreview(null);
              }}
            />
          </label>
          <label>
            Maximum safe retry attempts{" "}
            <input
              type="number"
              min={1}
              max={10}
              value={settings.maxAttempts}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxAttempts: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Initial retry delay (minutes){" "}
            <input
              type="number"
              min={1}
              max={1440}
              value={settings.retryMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  retryMinutes: Number(e.target.value),
                })
              }
            />
          </label>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                await api.post("/integration/delivery/settings", {
                  ...settings,
                  expectedRevision: settings.revision || 0,
                });
                setPreview(null);
                await load();
              })
            }
          >
            Save delivery settings (admin)
          </button>
          <p>
            Server gates also require production APP_ENV/NODE_ENV,
            INTEGRATION_DELIVERY_ENABLED=true and OUTBOUND_EMAIL_ENABLED=true.
            Local tests cannot send client email.
          </p>
        </fieldset>
      </details>
      <h4>Approved content versions</h4>
      <p>
        Create/edit templates in Communications with category integration_care,
        integration_appointment or integration_reconnect. Use a generic subject.
        Approval pins the current text; changing a template does not rewrite
        queued messages.
      </p>
      <fieldset disabled={busy}>
        <label>
          Integration message template{" "}
          <select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              setApprovalPolicyId(
                String(
                  data.templates.find((t: any) => t._id === e.target.value)
                    ?.integrationPolicyId || "",
                ),
              );
              setReference("");
              setReviewed(false);
            }}
          >
            <option value="">Choose template</option>
            {data.templates.map((t: any) => (
              <option key={t._id} value={t._id}>
                {t.name} · {t.language} · {t.templateKey}
              </option>
            ))}
          </select>
        </label>
        {template && (
          <>
            <p>
              <strong>{template.subject}</strong>
            </p>
            <pre style={{ whiteSpace: "pre-wrap" }}>{template.bodyText}</pre>
            <label>
              Reviewed response/urgent-help policy{" "}
              <select
                value={approvalPolicyId}
                onChange={(e) => {
                  setApprovalPolicyId(e.target.value);
                  setReviewed(false);
                }}
              >
                <option value="">Choose a published policy</option>
                {(data.policies || [])
                  .filter((p: any) => p.versions.length && !p.archived)
                  .map((p: any) => (
                    <option key={p._id} value={p._id}>
                      {p.name} · v{p.versions.at(-1).number}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Author/source and review reference{" "}
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={1000}
              />
            </label>
            <label>
              Content reviewed for this use{" "}
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
            </label>
            <button
              type="button"
              disabled={
                !reviewed ||
                !reference.trim() ||
                !approvalPolicyId ||
                !template.active
              }
              onClick={() =>
                run(async () => {
                  await api.post(
                    `/integration/delivery/templates/${templateId}/approve`,
                    {
                      kind: template.category.replace("integration_", ""),
                      reviewed,
                      contentReference: reference,
                      policyId: approvalPolicyId,
                      expectedUpdatedAt: template.updatedAt,
                    },
                  );
                  setPreview(null);
                  await load();
                  setNotice(
                    "Content version approved. Preview recipient plans before queueing.",
                  );
                })
              }
            >
              Approve this content version
            </button>
          </>
        )}
      </fieldset>
      <ul>
        {data.approvals.map((a: any) => (
          <li key={a._id}>
            {a.key} · {a.language} · version {a.messageVersion.slice(0, 8)} ·{" "}
            {a.active ? "Approved" : "Withdrawn"}{" "}
            {a.active && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt(
                    "Why is this content approval being withdrawn?",
                  );
                  if (reason?.trim())
                    run(async () => {
                      await api.post(
                        `/integration/delivery/approvals/${a._id}/withdraw`,
                        { reason },
                      );
                      setPreview(null);
                      await load();
                    });
                }}
              >
                Withdraw approval
              </button>
            )}
          </li>
        ))}
      </ul>
      <h4>Client preferences and recipient preview</h4>
      <label>
        Client enrollment for delivery{" "}
        <select
          value={enrollmentId}
          onChange={(e) => {
            const id = e.target.value;
            setEnrollmentId(id);
            setPreview(null);
            setPreference(null);
            const target = data.enrollments.find((en: any) => en._id === id);
            if (target)
              run(async () => {
                setPreference(
                  (
                    await api.get(
                      `/integration/delivery/preferences/${target.clientId?._id || target.clientId}`,
                    )
                  ).data,
                );
              });
          }}
        >
          <option value="">Choose enrollment</option>
          {data.enrollments.map((e: any) => (
            <option key={e._id} value={e._id}>
              {name(e)} · {e.homecomingDate} · {e.status}
            </option>
          ))}
        </select>
      </label>
      {preference && (
        <fieldset disabled={busy}>
          <p>
            Consent is not inferred from attendance or retreat completion. Care
            and marketing are separate.
          </p>
          {(
            [
              "careEmail",
              "appointmentEmail",
              "marketingEmail",
              "paused",
            ] as const
          ).map((key) => (
            <label key={key}>
              {
                {
                  careEmail: "Care email permitted",
                  appointmentEmail: "Appointment email permitted",
                  marketingEmail:
                    "Marketing permission (not used by care delivery)",
                  paused: "Pause communications",
                }[key]
              }{" "}
              <input
                type="checkbox"
                checked={preference[key]}
                onChange={(e) => changePreference(key, e.target.checked)}
              />
            </label>
          ))}
          <label>
            Preferred message language{" "}
            <select
              value={preference.language}
              onChange={(e) => changePreference("language", e.target.value)}
            >
              <option value="en">English</option>
              <option value="cz">Czech</option>
              <option value="pl">Polish</option>
            </select>
          </label>
          <label>
            Client timezone{" "}
            <input
              value={preference.timezone}
              onChange={(e) => changePreference("timezone", e.target.value)}
            />
          </label>
          <label>
            Quiet hours start{" "}
            <input
              type="time"
              value={preference.quietStart}
              onChange={(e) => changePreference("quietStart", e.target.value)}
            />
          </label>
          <label>
            Quiet hours end{" "}
            <input
              type="time"
              value={preference.quietEnd}
              onChange={(e) => changePreference("quietEnd", e.target.value)}
            />
          </label>
          <label>
            Client daily contact cap{" "}
            <input
              type="number"
              min={1}
              max={10}
              value={preference.dailyContactCap}
              onChange={(e) =>
                changePreference("dailyContactCap", Number(e.target.value))
              }
            />
          </label>
          <label>
            Consent/change source{" "}
            <textarea
              value={preference.consentEvidence || ""}
              onChange={(e) =>
                changePreference("consentEvidence", e.target.value)
              }
              maxLength={4000}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                const r = await api.post(
                  `/integration/delivery/preferences/${clientId}`,
                  { ...preference, expectedRevision: preference.revision },
                );
                setPreference(r.data);
                setPreview(null);
                await load();
                setNotice("Communication preferences saved.");
              })
            }
          >
            Save communication preferences
          </button>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                setPreview(
                  (
                    await api.post(
                      `/integration/delivery/enrollments/${enrollmentId}/preview`,
                    )
                  ).data,
                );
              })
            }
          >
            Preview recipients and messages
          </button>
        </fieldset>
      )}
      {preview && (
        <section aria-label="Message delivery preview">
          <p>
            Queued jobs survive restart. Past supportive steps are skipped.
            Calendly-owned appointments suppress RE reminders.
          </p>
          <ul>
            {preview.candidates.map((c: any) => (
              <li key={c._id}>
                <strong>{c.title || c.messageKey}</strong> · {c.recipient} ·{" "}
                {c.language} ·{" "}
                {new Date(c.dueAt).toLocaleString(undefined, {
                  timeZone: c.timezone,
                })}{" "}
                · {c.timezone}
                <p>
                  {c.reasons.length
                    ? c.reasons.join(" ")
                    : "Ready for reviewed queueing"}
                </p>
                <details>
                  <summary>Review message text</summary>
                  <p>{c.subject}</p>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{c.bodyText}</pre>
                </details>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await api.post(
                  `/integration/delivery/enrollments/${enrollmentId}/queue`,
                  { previewHash: preview.previewHash, reviewed: true },
                );
                setPreview(null);
                await load();
                setNotice(
                  `${r.data.queued} queued; ${r.data.skipped} skipped. No messages were sent by queueing.`,
                );
              })
            }
          >
            Queue reviewed messages
          </button>
        </section>
      )}
      <h4>Durable delivery queue</h4>
      <div className="program-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Message / recipient</th>
              <th>Due</th>
              <th>State / attempts</th>
              <th>Owner</th>
              <th>Reason / recovery</th>
            </tr>
          </thead>
          <tbody>
            {data.jobs.map((j: any) => (
              <tr key={j._id}>
                <td>
                  {j.title || j.messageKey}
                  <small>{j.recipient}</small>
                </td>
                <td>{new Date(j.dueAt).toLocaleString()}</td>
                <td>
                  {j.status} · {j.attempts}
                </td>
                <td>{j.owner}</td>
                <td>
                  {j.reason}
                  {j.status === "uncertain" && (
                    <button
                      type="button"
                      disabled={busy || !settings.environmentEnabled}
                      onClick={() =>
                        run(async () => {
                          const r = await api.post(
                            `/integration/delivery/jobs/${j._id}/reconcile`,
                          );
                          await load();
                          setNotice(
                            r.data.reconciled
                              ? "Verified provider receipt recorded."
                              : r.data.reason,
                          );
                        })
                      }
                    >
                      Verify provider receipt
                    </button>
                  )}
                  <details>
                    <summary>Delivery history</summary>
                    <ul>
                      {j.history.map((h: any, i: number) => (
                        <li key={i}>
                          {String(h.at)} · {h.action} · {h.reason || ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
