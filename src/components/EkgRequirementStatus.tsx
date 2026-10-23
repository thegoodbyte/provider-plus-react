import React, { useEffect, useRef, useState } from "react";
import { ekgRequirementApi } from "../services/ekgRequirementApi";
import type { EkgRequirementProjection } from "../types/ekgRequirement";
export function useEkgRequirement(bookingId: string, refreshKey = 0) {
  const [projection, setProjection] = useState<EkgRequirementProjection | null>(
      null,
    ),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    setProjection(null);
    Promise.resolve()
      .then(() => ekgRequirementApi.get(bookingId))
      .then((r) => {
        if (current === generation.current) setProjection(r.data);
      })
      .catch(() => {})
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [bookingId, refreshKey, revision]);
  return { projection, loading, reload: () => setRevision((n) => n + 1) };
}
export default function EkgRequirementStatus({
  bookingId,
  bookingLabel,
  refreshKey = 0,
}: {
  bookingId: string;
  bookingLabel?: string;
  refreshKey?: number;
}) {
  const {
    projection: p,
    loading,
    reload,
  } = useEkgRequirement(bookingId, refreshKey);
  return (
    <section
      aria-label="Entry EKG status"
      className="my-3 rounded border border-gray-200 p-3"
    >
      <strong>Entry EKG{bookingLabel ? ` · ${bookingLabel}` : ""}</strong>
      <p
        role="status"
        data-ekg-state={loading ? "loading" : p?.state || "unavailable"}
      >
        {loading ? "Loading EKG status…" : p?.label || "Status unavailable"}
      </p>
      {p?.latestReview && p.state === "validity_unknown" && <p>Medical review: {p.latestReview.result === "caution" ? "Accepted — caution" : p.latestReview.result === "accepted" ? "Accepted" : p.latestReview.result}. Confirm the test date before treating this requirement as satisfied.</p>}
      {p?.dueDate && <p>Due: {new Date(p.dueDate).toLocaleDateString()}</p>}
      {p?.latestEvidence && (
        <p>
          Evidence version {p.latestEvidence.version}
        </p>
      )}
      <button
        type="button"
        disabled={loading}
        onClick={reload}
        className="underline"
      >
        Refresh EKG status
      </button>
    </section>
  );
}
