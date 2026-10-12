import React, { useState } from "react";
import { api } from "../services/api";
export default function IntegrationLegacyGrant({
  clientId,
  disabled,
  onGranted,
}: {
  clientId: string;
  disabled: boolean;
  onGranted: () => Promise<void>;
}) {
  const [cancellationPolicy, setCancellation] = useState("restore"),
    [noShowPolicy, setNoShow] = useState("restore"),
    [preview, setPreview] = useState<any>(),
    [reviewed, setReviewed] = useState(false),
    [evidence, setEvidence] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = { cancellationPolicy, noShowPolicy };
  const run = async (grant: boolean) => {
    if (
      busy ||
      disabled ||
      (grant && (!preview || !reviewed || !evidence.trim()))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await api.post(
        "/integration/reconnect/" +
          clientId +
          (grant ? "/legacy-grant" : "/legacy-grant-preview"),
        grant
          ? {
              ...request,
              reviewed: true,
              evidence,
              previewHash: preview.previewHash,
            }
          : request,
      );
      if (grant) {
        setPreview(undefined);
        setReviewed(false);
        await onGranted();
      } else {
        setPreview(r.data);
        setReviewed(false);
      }
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Separate legacy session grant">
      <h4>Fulfil accepted legacy session offer</h4>
      <p>
        Grant only the explicit accepted offer. Original retreat credits and
        homecoming dates are preserved. No historical emails or group calls are
        generated.
      </p>
      <label>
        Cancellation policy
        <select
          disabled={busy || disabled}
          value={cancellationPolicy}
          onChange={(e) => {
            setCancellation(e.target.value);
            setPreview(undefined);
            setReviewed(false);
          }}
        >
          <option value="restore">Restore the credit</option>
          <option value="consume">Use the credit</option>
        </select>
      </label>
      <label>
        Missed-session policy
        <select
          disabled={busy || disabled}
          value={noShowPolicy}
          onChange={(e) => {
            setNoShow(e.target.value);
            setPreview(undefined);
            setReviewed(false);
          }}
        >
          <option value="restore">Restore the credit</option>
          <option value="consume">Use the credit</option>
        </select>
      </label>
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => run(false)}
      >
        Preview separate legacy grant
      </button>
      {preview && (
        <>
          <p>
            {preview.snapshot.personal.count} sessions ×{" "}
            {preview.snapshot.personal.durationMinutes} minutes. Access{" "}
            {preview.accessStartsOn} through {preview.expiresOn}. Original
            homecoming: {preview.homecomingDate}.
          </p>
          <p>
            Cancellation: {preview.snapshot.personal.cancellationPolicy}; missed
            session: {preview.snapshot.personal.noShowPolicy}; extensions:{" "}
            {preview.snapshot.personal.extensionPolicy}, maximum{" "}
            {preview.snapshot.personal.maximumExtensionDays} days.
          </p>
          <label>
            Grant review evidence
            <textarea
              disabled={busy || disabled}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              disabled={busy || disabled}
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />{" "}
            I reviewed the accepted offer, capacity, dates and credit policies.
          </label>
          <button
            type="button"
            disabled={busy || disabled || !reviewed || !evidence.trim()}
            onClick={() => run(true)}
          >
            Grant agreed legacy sessions
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
