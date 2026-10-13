import React, { useEffect, useState, useRef } from "react";
import { api } from "../services/api";
import IntegrationProviderSettings from "./IntegrationProviderSettings";
const label = (key: string) =>
  key
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export default function ExternalResourcesPage() {
  const loadId = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [catalog, setCatalog] = useState<any>(null),
    [selected, setSelected] = useState("storage"),
    [draft, setDraft] = useState<any>(null),
    [secrets, setSecrets] = useState<Record<string, string>>({}),
    [clear, setClear] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () => {
    const requestId = ++loadId.current;
    const r = await api.get("/external-resources/catalog");
    if (requestId !== loadId.current) return;
    setDirty(false);
    setCatalog(r.data);
    const row = r.data.resources.find((v: any) => v.key === selected);
    setDraft(row ? { ...row.draft, options: { ...row.draft.options } } : null);
    setSecrets({});
    setClear([]);
  };
  useEffect(() => {
    void load().catch((e) =>
      setError(e.response?.data?.message || "Could not load resource settings"),
    );
  }, [selected]);
  const row = catalog?.resources.find((v: any) => v.key === selected);
  const run = async (action: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body =
        action === "save"
          ? {
              expectedRevision: row.revision,
              enabled: draft.enabled,
              mode: draft.mode,
              options: draft.options,
              secrets,
              clearSecrets: clear,
            }
          : { expectedRevision: row.revision };
      await api.post(
        `/external-resources/configuration/${selected}${action === "save" ? "" : "/" + action}`,
        body,
      );
      await load();
      setNotice(
        {
          save: "Draft saved. Active configuration is unchanged.",
          test: "Check completed. Review the result before activation.",
          activate: "Configuration activated.",
          disable: "Resource disabled.",
          recover: "Previous configuration restored.",
        }[action] || "Saved",
      );
    } catch (e: any) {
      setSecrets({});
      setError(e.response?.data?.message || "Resource operation failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="mx-auto max-w-6xl p-4"
      aria-label="External resource configuration"
    >
      <h1 className="text-2xl font-bold">
        External resources and integrations
      </h1>
      <p className="my-3">
        Environment: <strong>{catalog?.environment || "loading"}</strong>. Save
        a draft, check it, then activate. Saved credentials are never shown.
        Development cannot activate live resources.
      </p>
      {error && (
        <p role="alert" className="my-3 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-3 text-green-800">
          {notice}
        </p>
      )}
      {catalog && (
        <div className="mb-4 rounded-lg border p-3 text-sm">
          Database:{" "}
          {catalog.bootstrap.databaseConfigured
            ? "configured"
            : "deployment fallback"}
          . Resource encryption:{" "}
          {catalog.bootstrap.resourceEncryptionKeyConfigured
            ? "configured"
            : "key required before saving credentials"}
          . Database, secret-store access and encryption keys remain deployment
          settings.
        </div>
      )}
      <label className="block mb-4">
        Resource{" "}
        <select
          aria-label="Resource"
          className="ml-2 max-w-full rounded border p-2"
          disabled={busy}
          value={selected}
          onChange={(e) => {
            loadId.current++;
            setSelected(e.target.value);
            setDraft(null);
            setError("");
            setNotice("");
          }}
        >
          {catalog?.resources.map((r: any) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
          <option value="providers">Calendly and Zoom</option>
        </select>
      </label>
      {selected === "providers" ? (
        <IntegrationProviderSettings />
      ) : row && draft ? (
        <>
          <h2 className="text-xl font-bold">{row.label}</h2>
          <p className="my-2 text-slate-600">{row.description}</p>
          <p className="my-2">
            Active: {row.active.enabled ? "enabled" : "disabled"} ·{" "}
            {row.active.mode} · {row.source}.{" "}
            {row.runtimeReadable
              ? ""
              : "Stored credentials cannot be opened; recover or replace them."}
          </p>
          {row.link && (
            <a href={row.link} className="block my-3 text-blue-700 underline">
              Open connected feature settings
            </a>
          )}
          <div className="flex flex-wrap gap-4 my-4">
            <label>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => {
                  setDirty(true);
                  setDraft({ ...draft, enabled: e.target.checked });
                }}
              />{" "}
              Enable on activation
            </label>
            <label>
              Mode{" "}
              <select
                value={draft.mode}
                onChange={(e) => {
                  setDirty(true);
                  setDraft({ ...draft, mode: e.target.value });
                }}
                className="rounded border p-2"
              >
                <option value="sandbox">Sandbox / test</option>
                <option value="capture">Capture / simulation</option>
                {catalog.environment === "production" && (
                  <option value="live">Live</option>
                )}
              </select>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {row.fields.map((field: any) => (
              <label key={field.key} className="block min-w-0">
                {label(field.key)}
                {field.kind === "secret" ? (
                  <>
                    <input
                      autoComplete="new-password"
                      type="password"
                      aria-label={label(field.key)}
                      value={secrets[field.key] || ""}
                      placeholder={
                        draft.configuredSecrets[field.key]
                          ? "Saved — leave empty to keep"
                          : "Not configured"
                      }
                      onChange={(e) => {
                        setDirty(true);
                        setSecrets({ ...secrets, [field.key]: e.target.value });
                      }}
                      className="block w-full rounded border p-2"
                    />
                    <span className="text-xs">
                      {draft.configuredSecrets[field.key]
                        ? "Credential configured"
                        : "No saved credential"}
                    </span>
                    {draft.configuredSecrets[field.key] && (
                      <span className="ml-3 text-xs">
                        <input
                          type="checkbox"
                          checked={clear.includes(field.key)}
                          onChange={(e) => {
                            setDirty(true);
                            setClear(
                              e.target.checked
                                ? [...clear, field.key]
                                : clear.filter((k) => k !== field.key),
                            );
                          }}
                        />{" "}
                        Remove saved credential
                      </span>
                    )}
                  </>
                ) : field.kind === "boolean" ? (
                  <select
                    aria-label={label(field.key)}
                    value={draft.options[field.key] || ""}
                    onChange={(e) => {
                      setDirty(true);
                      setDraft({
                        ...draft,
                        options: {
                          ...draft.options,
                          [field.key]: e.target.value,
                        },
                      });
                    }}
                    className="block w-full rounded border p-2"
                  >
                    <option value="">Default / unset</option>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                ) : (
                  <input
                    type={field.kind === "number" ? "number" : "text"}
                    aria-label={label(field.key)}
                    value={draft.options[field.key] || ""}
                    onChange={(e) => {
                      setDirty(true);
                      setDraft({
                        ...draft,
                        options: {
                          ...draft.options,
                          [field.key]: e.target.value,
                        },
                      });
                    }}
                    className="block w-full rounded border p-2"
                  />
                )}
              </label>
            ))}
          </div>
          <div className="my-5 flex flex-wrap gap-2">
            {[
              ["save", "Save draft"],
              [
                "test",
                row.testKind === "configuration"
                  ? "Validate configuration"
                  : "Test connection",
              ],
              ["activate", "Activate checked draft"],
              ["disable", "Disable resource"],
              ["recover", "Restore previous configuration"],
            ].map(([action, text]) => (
              <button
                key={action}
                disabled={
                  busy ||
                  (["test", "activate"].includes(action) && dirty) ||
                  (action === "recover" && !row.recoveryAvailable)
                }
                onClick={() => void run(action)}
                className="rounded border px-4 py-2 disabled:opacity-40"
              >
                {text}
              </button>
            ))}
          </div>
          {row.health && (
            <p role="status" className="my-3">
              {row.health.verified ? "Check passed" : "Check failed"} ·{" "}
              {row.health.kind === "configuration"
                ? "configuration validation; no external transport probe"
                : "provider connection"}{" "}
              · {row.health.checkedAt}
              {row.health.error ? " · " + row.health.error : ""}
            </p>
          )}
          <details className="my-4">
            <summary>Configuration change history</summary>
            {row.history.map((h: any, i: number) => (
              <p className="text-sm my-2" key={i}>
                {h.at} · {h.actor} · {h.action} ·{" "}
                {h.fields.map(label).join(", ")}
              </p>
            ))}
          </details>
        </>
      ) : (
        <p>Loading resource…</p>
      )}
    </section>
  );
}
