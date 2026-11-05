import "../components/Tasks/TaskForm.css";
import { useDialogFocus } from "../hooks/useDialogFocus";
import React, { useState, useRef } from "react";
import { api } from "../services/api";
import { financeCapabilities } from "./financeScope";
const labels: Record<string, string> = {
  "finance.read": "View financial records",
  "finance.capture": "Record and edit payments/receipts",
  "finance.reconcile": "Match and allocate receipts",
  "finance.requests": "Manage payment requests and reminders",
  "finance.invoices": "Create and issue invoices",
  "finance.refund": "Refund payments",
  "finance.delete": "Delete financial records",
  "finance.bookings": "Create bookings and manage agreed price",
};
export default function StaffAccessEditor({
  user,
  onClose,
  onSaved,
}: {
  user: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(
      user.staffProfiles?.includes("payments")
        ? user.staffCapabilities || []
        : [],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [requestKey] = useState(() => crypto.randomUUID());
  const root = useRef<HTMLElement>(null);
  useDialogFocus(true, root, () => {
    if (!busy) onClose();
  });
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api.put(`/staff-access/users/${user._id}`, {
        profiles: selected.length ? ["payments"] : [],
        capabilities: selected,
        revision: user.staffAccessRevision || 0,
        requestKey,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(
        e.response?.data?.message ||
          "Access could not be saved. Reload if someone else changed this account.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="task-form-overlay">
      <section
        ref={root}
        className="task-form-modal p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Assign work access"
      >
        <h2 className="text-xl font-bold">Work access · {user.email}</h2>
        <p className="my-3">
          Payments includes financial client, booking and retreat views. Medical
          information and unrelated administration remain blocked.
        </p>
        <fieldset disabled={busy}>
          <legend>Payments permissions</legend>
          {financeCapabilities.map((cap) => (
            <label key={cap} className="flex items-center gap-3 py-2">
              <input
                className="h-5 w-5 accent-teal-700"
                type="checkbox"
                checked={selected.includes(cap)}
                onChange={(e) =>
                  setSelected((current) =>
                    cap === "finance.read" && !e.target.checked
                      ? []
                      : e.target.checked
                        ? Array.from(new Set([...current, "finance.read", cap]))
                        : current.filter((c) => c !== cap),
                  )
                }
              />
              {labels[cap]}
            </label>
          ))}
        </fieldset>
        <p className="text-sm text-slate-600 my-3">
          Uncheck all to revoke Payments access. The next protected request
          rechecks the current grant.
        </p>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            className="min-h-11 rounded-lg border px-4 py-2"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="min-h-11 rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save work access"}
          </button>
        </div>
      </section>
    </div>
  );
}
