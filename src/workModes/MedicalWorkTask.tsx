import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import MedicalReviewWhatsAppForm from "../components/MedicalReviewWhatsAppForm";
import { workApi, workError } from "./WorkModeContext";
export default function MedicalWorkTask({
  session,
  source,
  onSession,
}: {
  session: any;
  source: any;
  onSession: (session: any) => void;
}) {
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [context, setContext] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [advisor, setAdvisor] = useState(""),
    [requestId, setRequestId] = useState(""),
    [modal, setModal] = useState<"sent" | "reply" | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [retryContext, setRetryContext] = useState(0);
  useEffect(() => {
    let live = true;
    setContext(null);
    void workApi
      .get(`/sessions/${session._id}/medical/${encodeURIComponent(source.key)}`)
      .then((value) => {
        if (live) {
          setContext(value);
          setAdvisor(
            value.request?.assignedToUserId?._id ||
              value.request?.assignedToUserId ||
              "",
          );
        }
      })
      .catch((e) => {
        if (live) setError(workError(e));
      });
    return () => {
      live = false;
    };
  }, [session._id, source.key, source.version, retryContext]);
  async function save(action: string, fields: any = {}) {
    const result = await workApi.post(
      `/sessions/${session._id}/medical-actions`,
      {
        revision: session.revision,
        key: source.key,
        sourceVersion: context.source.version,
        action,
        ...fields,
      },
    );
    if (live.current) onSession(result.session);
    return { ...context.request, _id: result.requestId };
  }
  async function prepare(action: "create" | "attach") {
    setBusy(true);
    setError("");
    try {
      await save(
        action,
        action === "attach"
          ? { requestId }
          : advisor
            ? { advisorId: advisor }
            : {},
      );
    } catch (e) {
      setError(workError(e));
    } finally {
      setBusy(false);
    }
  }
  async function download(groupId?: string) {
    setBusy(true);
    setError("");
    try {
      const route = groupId
        ? `/medical-review-requests/groups/${groupId}/pending-artifacts/download?unsentOnly=true`
        : `/medical-review-requests/${source.sourceId}/whatsapp-download`;
      const { data } = await api.get(route, {
        suppressGlobalError: true,
      } as any);
      const anchor = document.createElement("a");
      anchor.href = data.url;
      anchor.download = data.fileName || "medical-review.zip";
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.click();
      setDownloaded(true);
    } catch {
      setError(
        "The document download failed. Retry or open the source editor. Nothing has been marked sent.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!context)
    return (
      <div role="status">
        {error || "Loading medical context…"}
        {error && (
          <button onClick={() => setRetryContext((n) => n + 1)}>
            Retry medical context
          </button>
        )}
      </div>
    );
  const request = context.request,
    artifact = context.artifact;
  return (
    <div className="wm-medical" aria-label={`Medical action ${source.step}`}>
      {error && (
        <p role="alert" className="wm-error">
          {error}
        </p>
      )}
      {artifact && (
        <>
          <p>
            <strong>
              {[artifact.clientId?.firstName, artifact.clientId?.lastName]
                .filter(Boolean)
                .join(" ") || "Client"}{" "}
              · Client #{artifact.clientId?.display_id || "—"}
            </strong>
            {artifact.bookingId &&
              ` · Booking #${artifact.bookingId.bookingNumber || artifact.bookingId._id}`}
          </p>
          <p>
            {artifact.title} · {artifact.documentStage} ·{" "}
            {artifact.documentType}
          </p>
          <p>
            Inspect the artifact in its source editor before creating a review.
            After preparing it, select the new handoff entry under New arrivals
            to include it in step B.
          </p>
          <label>
            Assigned medical advisor (optional)
            <select
              aria-label="Assigned medical advisor"
              value={advisor}
              disabled={busy}
              onChange={(e) => setAdvisor(e.target.value)}
            >
              <option value="">Assign later in the source editor</option>
              {context.advisors.map((a: any) => (
                <option key={a._id} value={a._id}>
                  {[a.firstName, a.lastName].filter(Boolean).join(" ") ||
                    a.email}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || session.status !== "active"}
            onClick={() => void prepare("create")}
          >
            Create or reuse MRR
          </button>
          <label>
            Attach to an existing pending MRR
            <select
              aria-label="Existing pending MRR"
              disabled={busy}
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
            >
              <option value="">Choose review for this client/context</option>
              {context.candidates.map((r: any) => (
                <option key={r._id} value={r._id}>
                  MRR #{r.display_id || r._id} · {r.requestType} ·{" "}
                  {r.documentStage || "unspecified stage"}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !requestId || session.status !== "active"}
            onClick={() => void prepare("attach")}
          >
            Attach artifact to selected MRR
          </button>
        </>
      )}
      {request && (
        <>
          <p>
            <strong>
              {[request.clientId?.firstName, request.clientId?.lastName]
                .filter(Boolean)
                .join(" ") || "Client"}{" "}
              · MRR #{request.display_id || request._id}
            </strong>{" "}
            · {request.requestType}
          </p>
          <p>
            Advisor:{" "}
            {[
              request.assignedToUserId?.firstName,
              request.assignedToUserId?.lastName,
            ]
              .filter(Boolean)
              .join(" ") ||
              request.assignedTo ||
              "Not assigned"}
          </p>
          {source.step === "B" && (
            <>
              <div className="wm-actions">
                <button disabled={busy} onClick={() => void download()}>
                  Download review documents
                </button>
                {request.medicalReviewGroupId && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void download(
                        request.medicalReviewGroupId._id ||
                          request.medicalReviewGroupId,
                      )
                    }
                  >
                    Download pending packet
                  </button>
                )}
              </div>
              <p>
                {downloaded
                  ? "Download requested. Check your downloaded file. This review is still unsent until you explicitly record a manual handoff."
                  : "Download documents, send them manually in WhatsApp, then record the actual advisor and date."}
              </p>
              <button
                className="wm-primary"
                disabled={busy || session.status !== "active"}
                onClick={() => setModal("sent")}
              >
                Record sent via WhatsApp
              </button>
            </>
          )}
          {source.step === "C" &&
            (request.whatsappStatus !== "responded" &&
            request.whatsappSentAt ? (
              <>
                <p>
                  Waiting on advisor. Use this entry only after receiving an
                  actual reply.
                </p>
                <button
                  className="wm-primary"
                  disabled={busy || session.status !== "active"}
                  onClick={() => setModal("reply")}
                >
                  Record advisor reply
                </button>
              </>
            ) : (
              <p>
                Recorded result:{" "}
                {request.whatsappDecision ||
                  request.reviewDecision ||
                  "Follow-up needed"}
                . Continue the follow-up in the source editor; do not enter a
                second answer for the same reply.
              </p>
            ))}
          <Link
            to={`/admin/medical-review-requests/${request._id}?returnTo=${encodeURIComponent(`/admin/work-modes/sessions/${session._id}`)}`}
          >
            Open review and follow-up details
          </Link>
          {modal && (
            <MedicalReviewWhatsAppForm
              request={request}
              advisors={context.advisors}
              onClose={() => setModal(null)}
              onSaved={() => setModal(null)}
              workMode={{ action: modal, save: (input) => save(modal, input) }}
            />
          )}
        </>
      )}
    </div>
  );
}
