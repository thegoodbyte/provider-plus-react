import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import "./IntegrationPrograms.css";
const clone = (value: any) => JSON.parse(JSON.stringify(value));
export default function IntegrationEmailContent({
  reviewOnly = false,
}: {
  reviewOnly?: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [templateId, setTemplateId] = useState(""),
    [template, setTemplate] = useState<any>(null);
  const [policyId, setPolicyId] = useState(""),
    [policy, setPolicy] = useState<any>(null),
    [language, setLanguage] = useState("en");
  const [templateDirty, setTemplateDirty] = useState(false),
    [policyDirty, setPolicyDirty] = useState(false);
  const [reference, setReference] = useState(""),
    [evidence, setEvidence] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () => {
    const r = await api.get("/integration/email-content");
    setData(r.data);
    return r.data;
  };
  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || e.message));
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
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
      <p role={error ? "alert" : undefined}>
        {error || "Loading supportive content…"}
      </p>
    );
  const changePolicy = (key: string, value: any) => {
    setPolicyDirty(true);
    setPolicy({ ...policy, draft: { ...policy.draft, [key]: value } });
  };
  return (
    <section className="integration-programs integration-care">
      <h3>
        {reviewOnly
          ? "Integration urgent-help content review"
          : "Welcome-home and supportive content"}
      </h3>
      <p>
        Drafts invite an honest reply. They make no healing guarantees,
        transformation demands or claims about unfinished app features.
        Individual appointment availability comes from Calendly; message reply
        coverage is reviewed separately.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button
        type="button"
        disabled={busy || templateDirty || policyDirty}
        onClick={() =>
          run(async () => {
            const latest = await load();
            if (policyId)
              setPolicy(
                clone(latest.policies.find((p: any) => p._id === policyId)),
              );
            if (templateId)
              setTemplate(
                clone(latest.templates.find((t: any) => t._id === templateId)),
              );
          })
        }
      >
        Refresh saved content
      </button>
      {!reviewOnly && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await api.post("/integration/email-content/seed");
                await load();
                setNotice(
                  `${r.data.created} English/Czech/Polish drafts added. Nothing was published or sent.`,
                );
              })
            }
          >
            Add initial email drafts
          </button>
          <p>
            Suggested offsets:{" "}
            {data.cadence
              .map((e: any) => `${e.title} day ${e.day}`)
              .join(" · ")}
            . Copy these rows into the reviewed program's email settings if
            appropriate; existing enrollments are never changed automatically.
          </p>
        </>
      )}
      <h4>Response coverage and urgent-help footer</h4>
      <label>
        Response policy{" "}
        <select
          value={policyId}
          onChange={(e) => {
            const id = e.target.value;
            setPolicyId(id);
            setPolicy(
              id
                ? clone(data.policies.find((p: any) => p._id === id))
                : {
                    name: "",
                    draft: clone(data.starter),
                    revision: 0,
                    versions: [],
                  },
            );
            setEvidence("");
            setPolicyDirty(false);
          }}
        >
          <option value="">
            {reviewOnly ? "Choose policy" : "New response policy"}
          </option>
          {data.policies.map((p: any) => (
            <option key={p._id} value={p._id}>
              {p.name} ·{" "}
              {p.versions.length
                ? `published v${p.versions.at(-1).number}`
                : "draft"}
            </option>
          ))}
        </select>
      </label>
      {!policy && !reviewOnly && (
        <button
          type="button"
          onClick={() =>
            setPolicy({
              name: "",
              draft: clone(data.starter),
              revision: 0,
              versions: [],
            })
          }
        >
          Create response policy draft
        </button>
      )}
      {policy && (
        <fieldset disabled={busy || reviewOnly}>
          <label>
            Policy name{" "}
            <input
              value={policy.name}
              onChange={(e) => {
                setPolicyDirty(true);
                setPolicy({ ...policy, name: e.target.value });
              }}
              maxLength={160}
            />
          </label>
          <label>
            Editing language{" "}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="cz">Czech</option>
              <option value="pl">Polish</option>
            </select>
          </label>
          <label>
            Actual message response hours and expected reply target{" "}
            <textarea
              value={policy.draft.responseHours[language]}
              onChange={(e) =>
                changePolicy("responseHours", {
                  ...policy.draft.responseHours,
                  [language]: e.target.value,
                })
              }
              maxLength={2000}
            />
          </label>
          <p>
            No response hours were assumed from Calendly availability. Enter
            truthful coverage in all three languages.
          </p>
          <label>
            Urgent-help guidance{" "}
            <textarea
              value={policy.draft.urgentHelp[language]}
              onChange={(e) =>
                changePolicy("urgentHelp", {
                  ...policy.draft.urgentHelp,
                  [language]: e.target.value,
                })
              }
              maxLength={2000}
            />
          </label>
          <label>
            Contact preferences footer{" "}
            <textarea
              value={policy.draft.preferences[language]}
              onChange={(e) =>
                changePolicy("preferences", {
                  ...policy.draft.preferences,
                  [language]: e.target.value,
                })
              }
              maxLength={2000}
            />
          </label>
          <label>
            Guidance source and review context{" "}
            <textarea
              value={policy.draft.sourceReference}
              onChange={(e) => changePolicy("sourceReference", e.target.value)}
              maxLength={2000}
            />
          </label>
          <label>
            Reply coverage/capacity reviewed{" "}
            <input
              type="checkbox"
              checked={policy.draft.capacityReviewed}
              onChange={(e) =>
                changePolicy("capacityReviewed", e.target.checked)
              }
            />
          </label>
          <label>
            Authenticated account link verified{" "}
            <input
              type="checkbox"
              checked={policy.draft.portalLinkVerified}
              onChange={(e) =>
                changePolicy("portalLinkVerified", e.target.checked)
              }
            />
          </label>
          {!reviewOnly && (
            <button
              type="button"
              onClick={() =>
                run(async () => {
                  const r = await api.post(
                    policyId
                      ? `/integration/email-content/policies/${policyId}`
                      : "/integration/email-content/policies",
                    {
                      name: policy.name,
                      draft: policy.draft,
                      expectedRevision: policy.revision,
                    },
                  );
                  setPolicy(r.data);
                  setPolicyId(r.data._id);
                  setPolicyDirty(false);
                  await load();
                  setNotice(
                    "Draft saved. Changes require a fresh qualified urgent-help review.",
                  );
                })
              }
            >
              Save response policy draft
            </button>
          )}
        </fieldset>
      )}
      {policy && (
        <>
          <p>
            Qualified review:{" "}
            {policy.clinicalReview
              ? `${policy.clinicalReview.actor} · ${new Date(policy.clinicalReview.at).toLocaleString()}`
              : "Pending"}
            . Published versions: {policy.versions.length}.
          </p>
          <details open={reviewOnly}>
            <summary>Review all footer translations</summary>
            {["en", "cz", "pl"].map((l) => (
              <div key={l}>
                <strong>{l.toUpperCase()}</strong>
                <pre style={{ whiteSpace: "pre-wrap" }}>
                  {[
                    policy.draft.responseHours[l],
                    policy.draft.preferences[l],
                    policy.draft.urgentHelp[l],
                  ].join("\n\n")}
                </pre>
              </div>
            ))}
          </details>
          {reviewOnly ? (
            <fieldset disabled={busy || !policyId || policyDirty}>
              <label>
                Qualified review evidence{" "}
                <textarea
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  maxLength={4000}
                />
              </label>
              <button
                type="button"
                disabled={!evidence.trim()}
                onClick={() =>
                  run(async () => {
                    const r = await api.post(
                      `/integration/email-content/policies/${policyId}/clinical-review`,
                      {
                        expectedRevision: policy.revision,
                        reviewed: true,
                        evidence,
                      },
                    );
                    setPolicy(r.data);
                    await load();
                    setNotice(
                      "Qualified urgent-help review recorded for this draft.",
                    );
                  })
                }
              >
                Approve reviewed urgent-help translations
              </button>
            </fieldset>
          ) : (
            <>
              <p>
                A medical staff/advisor account reviews this saved draft at
                /medical/integration-content.
              </p>
              <button
                type="button"
                disabled={busy || !policyId || policyDirty}
                onClick={() =>
                  run(async () => {
                    const r = await api.post(
                      `/integration/email-content/policies/${policyId}/publish`,
                      { expectedRevision: policy.revision },
                    );
                    setPolicy(r.data);
                    await load();
                    setNotice(
                      "Response policy version published. Existing approvals retain their original footer snapshot.",
                    );
                  })
                }
              >
                Publish reviewed response policy
              </button>
            </>
          )}
        </>
      )}
      {!reviewOnly && (
        <>
          <h4>Edit and publish a message translation</h4>
          <label>
            Supportive message draft{" "}
            <select
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setTemplate(
                  clone(
                    data.templates.find((t: any) => t._id === e.target.value) ||
                      null,
                  ),
                );
                setReviewed(false);
                setReference("");
                setTemplateDirty(false);
              }}
            >
              <option value="">Choose translation</option>
              {data.templates.map((t: any) => (
                <option key={t._id} value={t._id}>
                  {t.name} · {t.active ? "enabled text" : "draft"}
                </option>
              ))}
            </select>
          </label>
          {template && (
            <fieldset disabled={busy}>
              <label>
                Message subject{" "}
                <input
                  value={template.subject}
                  onChange={(e) => {
                    setTemplateDirty(true);
                    setTemplate({ ...template, subject: e.target.value });
                    setReviewed(false);
                  }}
                  maxLength={160}
                />
              </label>
              <label>
                Message body{" "}
                <textarea
                  value={template.bodyText}
                  onChange={(e) => {
                    setTemplateDirty(true);
                    setTemplate({ ...template, bodyText: e.target.value });
                    setReviewed(false);
                  }}
                  maxLength={16000}
                />
              </label>
              <label>
                Published footer policy{" "}
                <select
                  value={String(template.integrationPolicyId || "")}
                  onChange={(e) => {
                    setTemplateDirty(true);
                    setTemplate({
                      ...template,
                      integrationPolicyId: e.target.value,
                    });
                    setReviewed(false);
                  }}
                >
                  <option value="">Choose policy</option>
                  {data.policies
                    .filter((p: any) => p.versions.length && !p.archived)
                    .map((p: any) => (
                      <option key={p._id} value={p._id}>
                        {p.name} · v{p.versions.at(-1).number}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    const r = await api.post(
                      `/integration/email-content/templates/${templateId}`,
                      {
                        subject: template.subject,
                        bodyText: template.bodyText,
                        policyId: template.integrationPolicyId,
                        expectedUpdatedAt: template.updatedAt,
                      },
                    );
                    setTemplate(r.data);
                    setReviewed(false);
                    setTemplateDirty(false);
                    await load();
                    setNotice(
                      "Translation saved as a draft; published snapshots remain unchanged.",
                    );
                  })
                }
              >
                Save message draft
              </button>
              <label>
                Author/source and translation review reference{" "}
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={1000}
                />
              </label>
              <label>
                This exact message and translation reviewed{" "}
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
              </label>
              <button
                type="button"
                disabled={!reviewed || !reference.trim() || templateDirty}
                onClick={() =>
                  run(async () => {
                    await api.post(
                      `/integration/email-content/templates/${templateId}/publish`,
                      {
                        expectedUpdatedAt: template.updatedAt,
                        reviewed,
                        contentReference: reference,
                      },
                    );
                    const latest = await load();
                    setTemplate(
                      clone(
                        latest.templates.find((t: any) => t._id === templateId),
                      ),
                    );
                    setNotice(
                      "Pinned message + reviewed footer approved. Preview client recipients in Delivery & preferences before queueing.",
                    );
                  })
                }
              >
                Publish reviewed message translation
              </button>
            </fieldset>
          )}
        </>
      )}
    </section>
  );
}
