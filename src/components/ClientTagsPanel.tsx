import React, { useRef, useState } from "react";
import { clientsApi } from "../services/api";
import { normalizeClientTag } from "../utils/clientTags";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import AppleButton from "./AppleButton";

export default function ClientTagsPanel({
  client,
  onSaved,
}: {
  client: any;
  onSaved: (client: any) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const tags: string[] = Array.from(
    new Set(
      (Array.isArray(client.tags) ? client.tags : [])
        .map(normalizeClientTag)
        .filter(Boolean),
    ),
  );
  const save = async (next: string[]) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const { data } = await clientsApi.update(
        client._id,
        { tags: next },
        { suppressGlobalError: true },
      );
      onSaved(data);
      setValue("");
    } catch (cause) {
      setError(apiErrorMessage(cause, "Could not save client tags."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const add = () => {
    const tag = normalizeClientTag(value);
    if (tag && !tags.includes(tag)) void save([...tags, tag]);
  };
  return (
    <section aria-label="Client tags" className="mb-4 rounded-lg border p-4">
      <h2 className="mb-3 text-lg font-semibold">Client Tags</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-800"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              disabled={busy}
              onClick={() => void save(tags.filter((item) => item !== tag))}
              className="ml-2"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          aria-label="New client tag"
          placeholder="Add tag, e.g. medically-approved"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-w-0 flex-1 rounded border px-3 py-2"
        />
        <AppleButton
          type="submit"
          disabled={
            busy ||
            !normalizeClientTag(value) ||
            tags.includes(normalizeClientTag(value))
          }
        >
          Add tag
        </AppleButton>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
