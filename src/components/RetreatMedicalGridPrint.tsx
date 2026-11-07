import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RetreatMedicalGridData } from "./RetreatMedicalGrid.helpers";
import "./RetreatMedicalGridPrint.css";

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
  data: RetreatMedicalGridData;
  preparationItems: any[];
  generatedAt: string;
  onClose: () => void;
}

export default function RetreatMedicalGridPrint({
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
  const groups = Array.from(
    { length: Math.ceil(data.clients.length / 3) },
    (_, i) => i * 3,
  );
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
          <p>Landscape A4 · up to 3 guests per group · full notes</p>
        </div>
        <button type="button" onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <button ref={close} type="button" onClick={onClose}>
          Close preview
        </button>
      </div>
      <div className="retreat-medical-print-pages">
        {groups.map((start) => (
          <section className="retreat-medical-print-sheet" key={start}>
            <table>
              <colgroup>
                <col style={{ width: "16%" }} />
                {data.clients.slice(start, start + 3).map((client) => (
                  <col key={client.bookingId} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <td
                    className="retreat-medical-print-heading"
                    colSpan={Math.min(3, data.clients.length - start) + 1}
                  >
                    <h1>Medical Grid · {data.retreatCode}</h1>
                    <p className="retreat-medical-print-meta">
                      {data.retreatName} · Generated{" "}
                      {new Date(generatedAt).toLocaleString()} · Guests{" "}
                      {start + 1}-{Math.min(start + 3, data.clients.length)} of{" "}
                      {data.clients.length}
                    </p>
                  </td>
                </tr>
                <tr>
                  <th scope="col">Medical stage</th>
                  {data.clients.slice(start, start + 3).map((client) => (
                    <th scope="col" key={client.bookingId}>
                      <strong>{client.clientName}</strong>
                      <div>
                        {client.clientDisplayId
                          ? `Client #${client.clientDisplayId}`
                          : "Client number unavailable"}
                      </div>
                      <div>Booking #{client.bookingNumber}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.key}
                    className={
                      row.cells
                        .slice(start, start + 3)
                        .some((cell) => (cell.notes?.length || 0) > 900)
                        ? "medical-print-long-row"
                        : "medical-print-short-row"
                    }
                  >
                    <th scope="row">{row.label}</th>
                    {row.cells.slice(start, start + 3).map((cell, index) => (
                      <td key={data.clients[start + index].bookingId}>
                        <strong>
                          {cell.status === "missing"
                            ? "Missing"
                            : cell.status === "artifact_only"
                              ? "Artifact only"
                              : cell.decisionLabel ||
                                (cell.status === "pending"
                                  ? "Pending"
                                  : "Reviewed")}
                        </strong>
                        <div>{cell.reviewLabel || "No MRR yet"}</div>
                        {cell.artifact && (
                          <div>
                            Artifact #
                            {cell.artifact.display_id ||
                              cell.artifact._id?.slice(-6) ||
                              "unavailable"}
                          </div>
                        )}
                        <div>Submitted {cell.submittedAt || "-"}</div>
                        <p className="retreat-medical-print-notes">
                          {cell.notes?.trim() || "No notes yet."}
                        </p>
                        {cell.documentRequestedAt && (
                          <div>Requested {cell.documentRequestedAt}</div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Medical preparation</th>
                  {data.clients.slice(start, start + 3).map((client) => {
                    const items = currentPreparationItems(
                      preparationItems,
                      client.bookingId,
                    );
                    return (
                      <td key={client.bookingId}>
                        {items.length ? (
                          <>
                            <strong>
                              {items[0].metadata?.planLifecycle || "published"}{" "}
                              · version {items[0].metadata?.planVersion || 0}
                            </strong>
                            {items.map((item) => (
                              <p key={item._id}>
                                {item.dueDate?.slice(0, 10) || "Unscheduled"} ·{" "}
                                {item.title}
                              </p>
                            ))}
                          </>
                        ) : (
                          "No preparation decision"
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
}
