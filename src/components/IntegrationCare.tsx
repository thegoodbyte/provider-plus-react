import React, { useEffect, useState } from "react";
import { api, integrationApi } from "../services/api";
import "./IntegrationPrograms.css";

type Step = {
  key: string;
  title: string;
  dueDate: string;
  earliestDate?: string;
  latestDate?: string;
  owner: string;
  backup: string;
  status: string;
  evidence: string;
  condition: string;
  visibility: string;
  required: boolean;
  history: any[];
};
type Care = {
  _id: string;
  revision: number;
  clientId: any;
  retreatId: any;
  homecomingDate: string;
  owner: string;
  backup: string;
  status: string;
  steps: Step[];
  history: any[];
};
const name = (c: Care) =>
  [
    c.clientId?.firstName || c.clientId?.fname,
    c.clientId?.lastName || c.clientId?.lname,
  ]
    .filter(Boolean)
    .join(" ") || "Client";
const errorText = (e: any) =>
  e?.response?.data?.message || e.message || "Unable to save care.";

export default function IntegrationCare({
  initialCaseId = "",
}: {
  initialCaseId?: string;
}) {
  const [cases, setCases] = useState<Care[]>([]),
    [retreats, setRetreats] = useState<any[]>([]);
  const [selected, setSelected] = useState(initialCaseId),
    [retreatId, setRetreatId] = useState("");
  const [status, setStatus] = useState("active"),
    [preview, setPreview] = useState<any>(null);
  const [edit, setEdit] = useState<Step | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const current = cases.find((c) => c._id === selected);
  const load = async () => {
    const [plans, r] = await Promise.all([
      api.get("/integration/care"),
      integrationApi.listRetreats(),
    ]);
    setCases(plans.data.cases);
    setRetreats(r.data);
  };
  useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="integration-programs integration-care">
      <h3>Post-retreat care</h3>
      <p>
        Care has its own phase. Retreat completion stays complete. Sending an
        email or invitation does not fulfil a personal care promise.
      </p>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy}>
        <legend>Prepare a completed retreat</legend>
        <label>
          Retreat{" "}
          <select
            value={retreatId}
            onChange={(e) => setRetreatId(e.target.value)}
          >
            <option value="">Choose retreat</option>
            {retreats.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name || r.id}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!retreatId}
          onClick={() =>
            run(async () => {
              await api.post(`/integration/care/retreats/${retreatId}/prepare`);
              await load();
            })
          }
        >
          Prepare draft care plans
        </button>
        <p>
          Newly completed retreats create drafts automatically. This action
          retries preparation or includes historical completed retreats without
          sending messages.
        </p>
      </fieldset>
      <label>
        Client care plan{" "}
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setPreview(null);
            setEdit(null);
          }}
        >
          <option value="">Choose client</option>
          {cases.map((c) => (
            <option key={c._id} value={c._id}>
              {name(c)} · {c.retreatId?.code || c.retreatId?.name} · {c.status}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          run(async () => {
            setPreview(null);
            setEdit(null);
            await load();
          })
        }
      >
        Refresh care & source tasks
      </button>
      {current && (
        <>
          <h4>
            {name(current)} · {current.status}
          </h4>
          <p>
            Homecoming {current.homecomingDate} · Owner{" "}
            {current.owner || "Unassigned"} · Backup{" "}
            {current.backup || "Unassigned"}
          </p>
          <p>
            First configure the reviewed client enrollment in Programs &
            enrollments. Change the return-home date or plan owners there, then
            preview here. Enrollment changes pause active care until reviewed.
          </p>
          <fieldset disabled={busy || current.status === "cancelled"}>
            <legend>Activate, pause or close care</legend>
            <label>
              Care phase{" "}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                run(async () => {
                  const r = await api.post(
                    `/integration/care/${current._id}/preview`,
                    { expectedRevision: current.revision, status },
                  );
                  setPreview(r.data);
                })
              }
            >
              Preview obligations
            </button>
            {preview && (
              <div>
                <p>{preview.warnings.join(" ")}</p>
                <ul>
                  {preview.proposed.steps.map((s: Step) => (
                    <li key={s.key}>
                      {s.title} · {s.dueDate} · {s.owner} · {s.status}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    run(async () => {
                      await api.post(`/integration/care/${current._id}/apply`, {
                        expectedRevision: current.revision,
                        status,
                        previewHash: preview.previewHash,
                      });
                      setPreview(null);
                      setEdit(null);
                      await load();
                    })
                  }
                >
                  Apply reviewed care plan
                </button>
              </div>
            )}
          </fieldset>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Care promise</th>
                  <th>Due</th>
                  <th>Owner / backup</th>
                  <th>Status</th>
                  <th>Visibility</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {current.steps.map((s) => (
                  <tr key={s.key}>
                    <td>
                      {s.title}
                      <small style={{ display: "block" }}>
                        {s.required ? "Required" : "Optional"} · {s.condition}
                      </small>
                      {s.earliestDate && (
                        <small>
                          Suggested window {s.earliestDate}–{s.latestDate}
                        </small>
                      )}
                    </td>
                    <td>{s.dueDate}</td>
                    <td>
                      {s.owner || "Unassigned"} / {s.backup || "Unassigned"}
                    </td>
                    <td>{s.status}</td>
                    <td>{s.visibility}</td>
                    <td>
                      <button
                        type="button"
                        disabled={busy || current.status !== "active"}
                        onClick={() => setEdit({ ...s })}
                      >
                        Update / hand over
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {edit && (
            <fieldset disabled={busy}>
              <legend>{edit.title}</legend>
              <label>
                Owner{" "}
                <input
                  value={edit.owner}
                  onChange={(e) => setEdit({ ...edit, owner: e.target.value })}
                />
              </label>
              <label>
                Backup{" "}
                <input
                  value={edit.backup}
                  onChange={(e) => setEdit({ ...edit, backup: e.target.value })}
                />
              </label>
              <label>
                Due date{" "}
                <input
                  type="date"
                  value={edit.dueDate}
                  onChange={(e) =>
                    setEdit({ ...edit, dueDate: e.target.value })
                  }
                />
              </label>
              <label>
                Step status{" "}
                <select
                  value={edit.status}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                >
                  <option value="pending">Pending / reopen</option>
                  <option value="completed">Completed with evidence</option>
                  {!edit.required && (
                    <option value="waived">Waived with reason</option>
                  )}
                </select>
              </label>
              <label>
                Required care step{" "}
                <input
                  type="checkbox"
                  checked={edit.required}
                  onChange={(e) =>
                    setEdit({ ...edit, required: e.target.checked })
                  }
                />
              </label>
              <label>
                Visibility{" "}
                <select
                  value={edit.visibility}
                  onChange={(e) =>
                    setEdit({ ...edit, visibility: e.target.value })
                  }
                >
                  <option value="staff">Staff only</option>
                  <option value="client">
                    Client title, due date and status
                  </option>
                </select>
              </label>
              <label>
                Completion evidence or change / handover reason{" "}
                <textarea
                  value={edit.evidence}
                  onChange={(e) =>
                    setEdit({ ...edit, evidence: e.target.value })
                  }
                  maxLength={4000}
                />
              </label>
              <p>
                Staff-only evidence. Record the response, agreed next action and
                follow-up; never infer wellbeing from delivery or attendance.
              </p>
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    await api.post(
                      `/integration/care/${current._id}/steps/${encodeURIComponent(edit.key)}`,
                      { ...edit, expectedRevision: current.revision },
                    );
                    setEdit(null);
                    setPreview(null);
                    await load();
                  })
                }
              >
                Save care evidence
              </button>
              <button type="button" onClick={() => setEdit(null)}>
                Cancel editing
              </button>
              <details>
                <summary>Step history</summary>
                <ul>
                  {edit.history.map((h, i) => (
                    <li key={i}>
                      {String(h.at)} · {h.actor} · {h.action} {h.evidence || ""}
                    </li>
                  ))}
                </ul>
              </details>
            </fieldset>
          )}
          <details>
            <summary>Care phase history</summary>
            <ul>
              {current.history.map((h, i) => (
                <li key={i}>
                  {String(h.at)} · {h.actor} · {h.action}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
