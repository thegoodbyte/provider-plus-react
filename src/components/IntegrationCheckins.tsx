import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import "./IntegrationPrograms.css";
export default function IntegrationCheckins() {
  const [data, setData] = useState<any>(null),
    [settings, setSettings] = useState<any>(null),
    [requestId, setRequestId] = useState(""),
    [state, setState] = useState("acknowledged"),
    [owner, setOwner] = useState(""),
    [backup, setBackup] = useState(""),
    [due, setDue] = useState(""),
    [evidence, setEvidence] = useState(""),
    [formId, setFormId] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [ruleKey, setRuleKey] = useState(""),
    [ruleValue, setRuleValue] = useState(""),
    [previewHash, setPreviewHash] = useState("");
  const load = async () => {
    const r = await api.get("/integration/checkins");
    setData(r.data);
    setSettings(r.data.settings);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const run = async (fn: () => Promise<void>, reload = true) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (reload) await load();
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  const selected = data?.requests.find((r: any) => r._id === requestId),
    form = data?.forms.find((r: any) => r._id === formId),
    library = data?.libraries.find((l: any) => l._id === settings?.libraryId),
    questions =
      library?.draft?.questions.filter(
        (q: any) => q.visibility === "staff_checkin",
      ) || [],
    question = questions.find((q: any) => q.key === ruleKey);
  useEffect(() => {
    setOwner(selected?.owner || "");
    setBackup(selected?.backup || "");
    setDue(selected?.dueDate || "");
    setEvidence("");
    setState("acknowledged");
  }, [requestId, selected?.revision]);
  const edit = (key: string, value: any) => {
    setPreviewHash("");
    setSettings((s: any) => ({ ...s, [key]: value }));
  };
  const addRule = () => {
    if (!question || !ruleValue) return;
    const equals =
      question.type === "boolean"
        ? ruleValue === "true"
        : question.type === "scale"
          ? Number(ruleValue)
          : ruleValue;
    edit("concernRules", [...settings.concernRules, { key: ruleKey, equals }]);
    setRuleValue("");
  };
  return (
    <section className="integration-programs integration-care">
      <h3>Check-ins & support triage</h3>
      <p>
        Shared answers create human review, never a diagnosis. Private drafts
        are excluded from this page. Unknown means no shared response;
        submitting does not resolve support.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button disabled={busy} onClick={() => run(load)}>
        Refresh check-ins and requests
      </button>
      {data && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Client / request</th>
                  <th>Review state</th>
                  <th>Owner / backup</th>
                  <th>Due</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map((r: any) => (
                  <tr key={r._id}>
                    <th>
                      {[r.clientId?.firstName, r.clientId?.lastName].join(" ")}
                      {r.concern ? " · shared concern" : ""}
                    </th>
                    <td>{r.status}</td>
                    <td>
                      {r.owner || "Assignment needed"} /{" "}
                      {r.backup || "Assignment needed"}
                    </td>
                    <td>{r.dueDate || "Deadline needed"}</td>
                    <td>
                      <button onClick={() => setRequestId(r._id)}>
                        Review request
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <article>
              <h4>Owned support request</h4>
              <p>{selected.message}</p>
              <p>
                {selected.channel} · {selected.preferredTime}
              </p>
              {selected.history
                ?.filter((h: any) => h.sourceCheckin)
                .map((h: any, i: number) => (
                  <button key={i} onClick={() => setFormId(h.sourceCheckin)}>
                    Open shared check-in · version {h.sourceSubmission}
                  </button>
                ))}
              {selected.active && (
                <>
                  <label>
                    Request state
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    >
                      {[
                        "acknowledged",
                        "contacted",
                        "in_progress",
                        "resolved",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Request owner
                    <input
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                    />
                  </label>
                  <label>
                    Request backup
                    <input
                      value={backup}
                      onChange={(e) => setBackup(e.target.value)}
                    />
                  </label>
                  <label>
                    Response deadline
                    <input
                      type="date"
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </label>
                  <label>
                    Response / agreed resolution evidence
                    <textarea
                      value={evidence}
                      maxLength={4000}
                      onChange={(e) => setEvidence(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy || !evidence.trim()}
                    onClick={() =>
                      run(async () => {
                        await api.post(
                          "/integration/checkins/requests/" + requestId,
                          {
                            expectedRevision: selected.revision || 1,
                            status: state,
                            owner,
                            backup,
                            dueDate: due,
                            evidence,
                          },
                        );
                        setNotice("Request updated with response evidence.");
                      })
                    }
                  >
                    Save support state
                  </button>
                </>
              )}
              <details>
                <summary>Request history</summary>
                {selected.history?.map((h: any, i: number) => (
                  <p key={i}>
                    {h.action} · {h.evidence || "Shared source requires review"}
                  </p>
                ))}
              </details>
            </article>
          )}
          <h4>Check-in response matrix</h4>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Day / due</th>
                  <th>Shared response</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.forms.map((f: any) => (
                  <tr key={f._id}>
                    <th>
                      {[f.clientId?.firstName, f.clientId?.lastName].join(" ")}
                    </th>
                    <td>
                      {f.day} · {f.dueDate}
                    </td>
                    <td>
                      {f.sharedAt
                        ? "Shared " + new Date(f.sharedAt).toLocaleString()
                        : "Unknown — no shared response"}
                      {f.triagePending
                        ? " · Review routing needs reconciliation"
                        : ""}
                    </td>
                    <td>
                      <button onClick={() => setFormId(f._id)}>
                        View shared versions
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {form && (
            <article>
              <h4>Shared versions only · day {form.day}</h4>
              {!form.submissions.length && (
                <p>No shared response. Draft answers are private.</p>
              )}
              {form.submissions.map((s: any) => (
                <div key={s.number}>
                  <p>
                    Version {s.number} · {new Date(s.at).toLocaleString()}
                  </p>
                  {Object.entries(s.answers).map(([key, value]) => (
                    <p key={key}>
                      {form.snapshot.questions.find((q: any) => q.key === key)
                        ?.label.en || key}
                      :{" "}
                      {Array.isArray(value) ? value.join(", ") : String(value)}
                    </p>
                  ))}
                </div>
              ))}
            </article>
          )}
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await api.post("/integration/checkins/reconcile");
                setNotice(
                  `${r.data.reconciled} pending reviews routed; ${r.data.held} need ownership review. No messages sent.`,
                );
              })
            }
          >
            Reconcile pending shared reviews
          </button>
          <details>
            <summary>Configure check-ins and review capacity</summary>
            <p>
              Only published question versions and a qualified-reviewed
              response/urgent-help policy can be enabled. Review owner/backup
              coverage, alert routing and retention/export practices first.
              Calendly is appointment availability; it does not guarantee a
              response time.
            </p>
            <label>
              Shared check-in question set
              <select
                value={settings.libraryId}
                onChange={(e) => edit("libraryId", e.target.value)}
              >
                <option value="">Choose published questions</option>
                {data.libraries.map((l: any) => (
                  <option key={l._id} value={l._id}>
                    {l.name} · published {l.publishedVersion || "none"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Published response policy
              <select
                value={settings.policyId}
                onChange={(e) => edit("policyId", e.target.value)}
              >
                <option value="">Choose policy</option>
                {data.policies.map((p: any) => (
                  <option key={p._id} value={p._id}>
                    {p.name} · versions {p.versions.length}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Days after homecoming
              <input
                value={settings.days.join(", ")}
                onChange={(e) =>
                  edit(
                    "days",
                    e.target.value.split(",").map((v) => Number(v.trim())),
                  )
                }
              />
            </label>
            <label>
              Retention in days
              <input
                type="number"
                min={30}
                max={3650}
                value={settings.retentionDays}
                onChange={(e) => edit("retentionDays", Number(e.target.value))}
              />
            </label>
            {["en", "cz", "pl"].map((l) => (
              <label key={l}>
                Privacy / retention / sharing notice · {l}
                <textarea
                  maxLength={4000}
                  value={settings.privacyNotice[l]}
                  onChange={(e) =>
                    edit("privacyNotice", {
                      ...settings.privacyNotice,
                      [l]: e.target.value,
                    })
                  }
                />
              </label>
            ))}
            <h4>Answers that request human review</h4>
            {settings.concernRules.map((r: any, i: number) => (
              <p key={i}>
                {r.key} = {String(r.equals)}{" "}
                <button
                  onClick={() =>
                    edit(
                      "concernRules",
                      settings.concernRules.filter(
                        (_: any, index: number) => index !== i,
                      ),
                    )
                  }
                >
                  Remove review rule
                </button>
              </p>
            ))}
            <label>
              Shared question
              <select
                value={ruleKey}
                onChange={(e) => {
                  setRuleKey(e.target.value);
                  setRuleValue("");
                }}
              >
                <option value="">Choose question</option>
                {questions
                  .filter((q: any) =>
                    ["single", "boolean", "scale"].includes(q.type),
                  )
                  .map((q: any) => (
                    <option key={q.key} value={q.key}>
                      {q.label.en}
                    </option>
                  ))}
              </select>
            </label>
            {question && (
              <label>
                Response to review
                <select
                  value={ruleValue}
                  onChange={(e) => setRuleValue(e.target.value)}
                >
                  <option value="">Choose response</option>
                  {question.type === "boolean" ? (
                    <>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </>
                  ) : question.type === "scale" ? (
                    Array.from({ length: 10 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))
                  ) : (
                    question.options.map((o: any) => (
                      <option key={o.key} value={o.key}>
                        {o.label.en}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}
            <button disabled={!ruleValue} onClick={addRule}>
              Add review rule
            </button>
            {["capacityEvidence", "alertEvidence", "privacyEvidence"].map(
              (k) => (
                <label key={k}>
                  {k === "capacityEvidence"
                    ? "Owner/backup capacity review"
                    : k === "alertEvidence"
                      ? "Tested alert routing and escalation evidence"
                      : "Privacy, retention and client-export review"}
                  <textarea
                    maxLength={4000}
                    value={settings[k]}
                    onChange={(e) => edit(k, e.target.value)}
                  />
                </label>
              ),
            )}
            <label>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => edit("enabled", e.target.checked)}
              />
              Enable reviewed client check-ins
            </label>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const draftSettings = settings;
                  const r = await api.post("/integration/checkins/simulate", {
                    ...settings,
                    expectedRevision: settings.revision,
                  });
                  setPreviewHash(r.data.previewHash);
                  setSettings(draftSettings);
                  setNotice(
                    `${r.data.routes.length} owner/backup routes tested; ${r.data.held.length} assignment gaps. No alerts sent.`,
                  );
                }, false)
              }
            >
              Simulate review routing
            </button>
            <button
              disabled={busy || (settings.enabled && !previewHash)}
              onClick={() =>
                run(async () => {
                  await api.post("/integration/checkins/settings", {
                    ...settings,
                    previewHash,
                    expectedRevision: settings.revision,
                  });
                  setPreviewHash("");
                  setNotice(
                    "Settings saved. Existing forms keep their published version.",
                  );
                })
              }
            >
              Save check-in settings
            </button>
          </details>
        </>
      )}
    </section>
  );
}
