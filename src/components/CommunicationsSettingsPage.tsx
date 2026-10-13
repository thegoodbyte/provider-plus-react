import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { communicationsApi } from "../services/api";

export default function CommunicationsSettingsPage() {
  const location = useLocation();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, retry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setSaved(null);
    communicationsApi
      .getSettings()
      .then(({ data }) => {
        if (!current) return;
        const value = data.clientMedicalReviewEmailsEnabled !== false;
        setSaved(value);
        setEnabled(value);
      })
      .catch(() => {
        if (current)
          setError(
            "Unable to load the email master switch. Retry to confirm its current state.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [revision]);
  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } =
        await communicationsApi.saveMedicalEmailMasterSwitch(enabled);
      const value = data.clientMedicalReviewEmailsEnabled !== false;
      setSaved(value);
      setEnabled(value);
      setNotice("Email master switch saved.");
    } catch {
      setError(
        "The email master switch could not be saved. The last confirmed setting is shown below; retry your change.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section
      className="mx-auto max-w-3xl space-y-5 p-6"
      aria-label="Communications settings"
    >
      <h1 className="text-2xl font-semibold">Communications settings</h1>
      <div className="space-y-4 rounded-lg border bg-white p-5">
        <h2 className="text-lg font-semibold">Email master switch</h2>
        <p className="text-sm text-slate-600">
          Controls client medical-review notification emails: submitted,
          approved, needs more information and declined. Each notification must
          also be enabled in Medical notifications.
        </p>
        <p className="text-sm text-slate-600">
          Manual emails, booking reminders and internal staff notifications have
          their own settings.
        </p>
        <p role="status">
          {loading
            ? "Loading current setting…"
            : saved === null
              ? "Current setting unverified"
              : `Last confirmed setting: ${saved ? "Enabled" : "Disabled"}`}
        </p>
        <label className="flex items-center gap-3 font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
              setNotice("");
            }}
            disabled={loading || saving || saved === null}
          />
          Enable client medical-review emails
        </label>
        {saved !== null && enabled !== saved && (
          <p className="text-sm text-amber-800">
            Unsaved change. Select Save master switch to apply it.
          </p>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading || saving || saved === null || enabled === saved}
          className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save master switch"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {error && !saving && (
          <button
            type="button"
            className="text-blue-700 underline"
            onClick={() => retry((n) => n + 1)}
          >
            Reload current setting
          </button>
        )}
        {notice && (
          <p role="status" className="text-sm text-green-800">
            {notice}
          </p>
        )}
      </div>
      <Link
        to={
          location.pathname.replace(
            /\/communications-settings$/,
            "/communications",
          ) + "?tab=settings"
        }
        className="text-blue-700 underline"
      >
        Other communications settings
      </Link>
    </section>
  );
}
