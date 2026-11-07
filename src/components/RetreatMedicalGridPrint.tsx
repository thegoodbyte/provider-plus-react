import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RetreatMedicalGridData } from "./RetreatMedicalGrid.helpers";
import "./RetreatMedicalGridPrint.css";
import { ceremoniesApi } from "../services/api";
import { CeremonyParticipant } from "../types";
import { AlertTriangle, CheckCircle2, CircleHelp, HeartPulse, Leaf, Pill, XCircle } from "lucide-react";

const objectId = (value: any): string => String(value?._id || value || "");
type CeremonyNotes = { ceremonyNumber: number; participants: CeremonyParticipant[] };
const checksFor = (participant: CeremonyParticipant) => participant.preCeremonyChecks?.length
  ? participant.preCeremonyChecks
  : (participant.preCeremonyEkg || participant.preCeremonyBloodPressure || participant.medicalClearanceNotes)
    ? [{ preCeremonyEkg: participant.preCeremonyEkg, preCeremonyBloodPressure: participant.preCeremonyBloodPressure, medicalClearance: participant.medicalClearance, medicalClearanceNotes: participant.medicalClearanceNotes }]
    : [];
const Status = ({ tone, children }: { tone?: string; children: React.ReactNode }) => {
  const Icon = tone === "green" ? CheckCircle2 : tone === "yellow" ? AlertTriangle : tone === "red" ? XCircle : CircleHelp;
  return <strong className={`medical-print-status medical-print-${tone || "neutral"}`}><Icon size={14} aria-hidden="true" />{children}</strong>;
};

// Use the same current plan selection in the interactive grid and printed snapshot.
export const currentPreparationItems = (items: any[], bookingId: string) => {
  const matching = items.filter(
    (item) =>
      String(item.bookingId?._id || item.bookingId) === bookingId &&
      item.metadata?.medicationStopPlan &&
      item.status !== "cancelled",
  );
  const editable = matching.filter((item) =>
    ["draft", "approved"].includes(item.metadata?.planLifecycle),
  );
  const candidates = editable.length
    ? editable
    : matching.filter(
        (item) =>
          !item.metadata?.planLifecycle ||
          item.metadata.planLifecycle === "published",
      );
  const version = Math.max(
    0,
    ...candidates.map((item) => Number(item.metadata?.planVersion || 0)),
  );
  return candidates.filter(
    (item) => Number(item.metadata?.planVersion || 0) === version,
  );
};

interface Props {
  retreatId: string;
  data: RetreatMedicalGridData;
  preparationItems: any[];
  generatedAt: string;
  onClose: () => void;
}

export default function RetreatMedicalGridPrint({
  retreatId,
  data,
  preparationItems,
  generatedAt,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("retreat-medical-printing");
    // Print media can blur the focused toolbar control. Escape must still close
    // the preview, without also closing the underlying fullscreen grid.
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", escape, true);
    close.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.body.classList.remove("retreat-medical-printing");
      document.removeEventListener("keydown", escape, true);
      opener?.focus();
    };
  }, []);
  const [ceremonies, setCeremonies] = useState<CeremonyNotes[]>([]);
  const [checksState, setChecksState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setChecksState("loading");
    setCeremonies([]);
    (async () => {
      try {
        const response = await ceremoniesApi.getByRetreat(retreatId);
        const relevant = response.data.filter(c => [1, 2].includes(c.ceremonyNumber) && c.status !== "cancelled" && (!c.retreatId || objectId(c.retreatId) === retreatId));
        const loaded = await Promise.all(relevant.map(async c => {
          if (!c._id) throw new Error("Missing ceremony identity");
          const result = await ceremoniesApi.getParticipants(c._id);
          return { ceremonyNumber: c.ceremonyNumber, participants: result.data.filter(p => objectId(p.ceremonyId) === c._id && (!p.retreatId || objectId(p.retreatId) === retreatId)) };
        }));
        if (active) { setCeremonies(loaded); setChecksState("ready"); }
      } catch { if (active) setChecksState("error"); }
    })();
    return () => { active = false; };
  }, [retreatId, attempt]);
  return createPortal(
    <div
      ref={dialog}
      className="retreat-medical-print"
      role="dialog"
      aria-modal="true"
      aria-label="Medical grid print preview"
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          const buttons = dialog.current?.querySelectorAll("button");
          if (!buttons?.length) return;
          const first = buttons[0],
            last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div className="retreat-medical-print-toolbar">
        <div>
          <strong>Medical grid print preview</strong>
          <p>Portrait A4 · clients in rows · full notes</p>
        </div>
        <button type="button" disabled={checksState !== "ready"} onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <button ref={close} type="button" onClick={onClose}>
          Close preview
        </button>
      </div>
      {checksState === "loading" && <p role="status" className="medical-print-message">Loading preceremony checks…</p>}
      {checksState === "error" && <div role="alert" className="medical-print-message">Unable to load preceremony checks. Printing is unavailable until the checks load. <button onClick={() => setAttempt(n => n + 1)}>Retry checks</button></div>}
      <div className="retreat-medical-print-pages">
        {data.clients.map((client, index) => {
          const items = currentPreparationItems(preparationItems, client.bookingId);
          const cells = data.rows.map(row => row.cells[index]);
          const long = cells.some(c => (c.notes?.length || 0) > 500);
          return <section className="retreat-medical-print-sheet" key={client.bookingId}>
            <table aria-label={`Medical checks for ${client.clientName}`}>
              <colgroup><col style={{width: "19%"}} /><col /><col /><col /></colgroup>
              <thead>
                <tr><td className="retreat-medical-print-heading" colSpan={4}>
                  <h1>Medical Grid · {data.retreatCode}</h1>
                  <p className="retreat-medical-print-meta">{data.retreatName} · Generated {new Date(generatedAt).toLocaleString()} · Client {index + 1} of {data.clients.length}</p>
                </td></tr>
                <tr>
                  <th scope="col"><strong>{client.clientName}</strong><div>{client.clientDisplayId ? `Client #${client.clientDisplayId}` : "Client number unavailable"}</div><div>Booking #{client.bookingNumber}</div></th>
                  <th scope="col"><span className="medical-print-column medical-print-ekg"><HeartPulse aria-hidden="true" size={18} /> EKG</span></th>
                  <th scope="col"><span className="medical-print-column medical-print-liver"><Leaf aria-hidden="true" size={18} /> Liver</span></th>
                  <th scope="col"><span className="medical-print-column medical-print-meds"><Pill aria-hidden="true" size={18} /> Medications</span></th>
                </tr>
              </thead>
              <tbody>
                <tr className={long ? "medical-print-long-row" : "medical-print-short-row"}>
                  <th scope="row">Medical results</th>
                  {cells.map((cell, i) => <td key={data.rows[i].key}>
                    <Status tone={cell.decisionTone}>{cell.status === "missing" ? "Missing" : cell.status === "artifact_only" ? "Artifact only" : cell.decisionLabel || (cell.status === "pending" ? "Pending" : "Reviewed")}</Status>
                    <div>{cell.reviewLabel || "No MRR yet"}</div>
                    {cell.artifact && <div>Artifact #{cell.artifact.display_id || cell.artifact._id?.slice(-6) || "unavailable"}</div>}
                    <div>Submitted {cell.submittedAt || "-"}</div>
                    <p className="retreat-medical-print-notes">{cell.notes?.trim() || "No notes yet."}</p>
                    {cell.documentRequestedAt && <div>Requested {cell.documentRequestedAt}</div>}
                  </td>)}
                </tr>
                {[1, 2].map(number => {
                  const checks = ceremonies.filter(c => c.ceremonyNumber === number).flatMap(c => c.participants.filter(p => objectId(p.clientId) === client.clientId).flatMap(checksFor));
                  return <tr key={number}><th scope="row">Preceremony {number}</th><td colSpan={3}>
                    {checksState !== "ready" ? "Checks unavailable — load before printing" : checks.length ? checks.map((check, i) => <div className="medical-print-check" key={i}>
                      <Status tone={check.medicalClearance === "approved" ? "green" : check.medicalClearance === "conditional" ? "yellow" : check.medicalClearance === "not_approved" ? "red" : "neutral"}>Check {i + 1} · {check.medicalClearance || "pending"}</Status>
                      <p>EKG: {check.preCeremonyEkg?.notes?.trim() || "No notes recorded."}</p>
                      <p>Blood pressure: {check.preCeremonyBloodPressure?.notes?.trim() || "No notes recorded."}</p>
                      <p>Clearance: {check.medicalClearanceNotes?.trim() || "No notes recorded."}</p>
                    </div>) : "No checks recorded."}
                  </td></tr>;
                })}
                <tr><th scope="row">Medical preparation</th><td colSpan={3}>
                  {items.length ? <><strong>{items[0].metadata?.planLifecycle || "published"} · version {items[0].metadata?.planVersion || 0}</strong>{items.map(item => <p key={item._id}>{item.dueDate?.slice(0,10) || "Unscheduled"} · {item.title}</p>)}</> : "No preparation decision"}
                </td></tr>
              </tbody>
            </table>
          </section>;
        })}
      </div>
    </div>,
    document.body,
  );
}
