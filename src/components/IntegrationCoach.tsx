import React, { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./IntegrationPrograms.css";
export default function IntegrationCoach() {
  const { user } = useAuth(),
    owner = useRef(user?.id);
  owner.current = user?.id;
  const [data, setData] = useState<any>(),
    [settings, setSettings] = useState<any>(),
    [entries, setEntries] = useState<any[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const admin = user?.role === "admin" && !user?.readOnly;
  const load = async () => {
    const actor = owner.current;
    const results = await Promise.all([
      api.get("/integration/coach/shared-journals"),
      ...(admin ? [api.get("/integration/coach/settings")] : []),
    ]);
    if (actor !== owner.current) return;
    setEntries(results[0].data.entries);
    if (results[1]) {
      setData(results[1].data);
      setSettings(results[1].data.settings);
    }
  };
  useEffect(() => {
    let live = true;
    setEntries([]);
    setData(undefined);
    setSettings(undefined);
    load().catch((e) => {
      if (live) setError(e.response?.data?.message || e.message);
    });
    return () => {
      live = false;
    };
  }, [user?.id, admin]);
  const run = async (fn: () => Promise<void>) => {
    const actor = owner.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (actor === owner.current) await load();
    } catch (e: any) {
      if (actor === owner.current)
        setError(e.response?.data?.message || e.message);
    } finally {
      if (actor === owner.current) setBusy(false);
    }
  };
  const edit = (key: string, value: any) =>
    setSettings({ ...settings, [key]: value });
  const toggle = (key: string, id: string, value: boolean) =>
    edit(
      key,
      value
        ? [...settings[key], id]
        : settings[key].filter((v: string) => v !== id),
    );
  return (
    <section className="integration-programs">
      <h3>BeyondCeremony coach & shared journal</h3>
      <p>
        Journals remain private. This page contains only the entry versions
        clients explicitly shared with your named account. Editing an entry does
        not automatically share its new text.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button disabled={busy} onClick={() => run(load)}>
        Refresh my shared entries
      </button>
      <h4>Entries shared with me</h4>
      {!entries.length && <p>No entries shared with your account.</p>}
      {entries.map((e) => (
        <article key={e.id}>
          <h4>
            {e.clientName} · {e.title || "Untitled"}
          </h4>
          <p style={{ whiteSpace: "pre-wrap" }}>{e.text}</p>
          <small>
            Shared version {e.version} · {new Date(e.sharedAt).toLocaleString()}
          </small>
        </article>
      ))}
      {admin && data && settings && (
        <details open>
          <summary>Coach configuration</summary>
          <p>
            Use Questions & activities to author, review and publish content
            first. Activation requires published private prompts,
            qualified-reviewed optional activities including a two-minute
            choice, named staff and reviewed privacy notices.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api.post("/integration/coach/settings", {
                  ...settings,
                  expectedRevision: settings.revision,
                });
                setNotice("Coach configuration saved.");
              });
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => edit("enabled", e.target.checked)}
              />
              Enable reviewed coach content
            </label>
            <label>
              Private journal prompt library
              <select
                value={settings.promptLibraryId}
                onChange={(e) => edit("promptLibraryId", e.target.value)}
              >
                <option value="">Choose published private prompts</option>
                {data.libraries
                  .filter((l: any) => l.draft.kind === "questions")
                  .map((l: any) => (
                    <option key={l._id} value={l._id}>
                      {l.draft.name} · published {l.publishedVersion || "none"}
                    </option>
                  ))}
              </select>
            </label>
            <fieldset>
              <legend>Activity choices</legend>
              {data.libraries
                .filter((l: any) => l.draft.kind === "activity")
                .map((l: any) => (
                  <label key={l._id}>
                    <input
                      type="checkbox"
                      checked={settings.activityIds.includes(l._id)}
                      onChange={(e) =>
                        toggle("activityIds", l._id, e.target.checked)
                      }
                    />
                    {l.draft.name} · {l.draft.durationMinutes} min · published{" "}
                    {l.publishedVersion || "none"}
                  </label>
                ))}
            </fieldset>
            <fieldset>
              <legend>Named support team for client sharing</legend>
              {data.staff.map((s: any) => (
                <label key={s._id}>
                  <input
                    type="checkbox"
                    checked={settings.staffIds.includes(s._id)}
                    onChange={(e) =>
                      toggle("staffIds", s._id, e.target.checked)
                    }
                  />
                  {[s.firstName, s.lastName].filter(Boolean).join(" ") ||
                    "Support " + s.role}{" "}
                  · {s.role}
                </label>
              ))}
            </fieldset>
            <label>
              Journal retention days
              <input
                type="number"
                min={30}
                max={3650}
                value={settings.retentionDays}
                onChange={(e) => edit("retentionDays", Number(e.target.value))}
              />
            </label>
            {["en", "cz", "pl"].map((lang) => (
              <label key={lang}>
                Privacy, sharing, revocation and export notice · {lang}
                <textarea
                  required={settings.enabled}
                  maxLength={4000}
                  value={settings.privacyNotice[lang]}
                  onChange={(e) =>
                    edit("privacyNotice", {
                      ...settings.privacyNotice,
                      [lang]: e.target.value,
                    })
                  }
                />
              </label>
            ))}
            <label>
              Privacy/retention review evidence
              <textarea
                required={settings.enabled}
                maxLength={4000}
                value={settings.privacyEvidence}
                onChange={(e) => edit("privacyEvidence", e.target.value)}
              />
            </label>
            <button disabled={busy}>Save coach configuration</button>
          </form>
        </details>
      )}
    </section>
  );
}
