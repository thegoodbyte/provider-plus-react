import { useCallback, useEffect, useRef, useState } from "react";
import { invoiceDraftsApi } from "../services/api";
export const draftFingerprint = (value: any): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
const removeBackup = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {}
};
const uuid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
function account() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    if (u._id || u.id || u.userId || u.email)
      return String(u._id || u.id || u.userId || u.email);
    const t = localStorage.getItem("token");
    return t
      ? JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
          .sub
      : "";
  } catch {
    return "";
  }
}
export function useInvoiceDraft({
  enabled,
  payload,
  apply,
  empty,
  initialClient,
  onIssued,
}: {
  enabled: boolean;
  payload: any;
  apply: (p: any) => void;
  empty: () => any;
  initialClient: string | null;
  onIssued: (id: string) => void;
}) {
  const owner = account(),
    prefix = "ppvc.invoice-draft.v1:" + owner + ":";
  const [issuing, setIssuing] = useState(false);
  const issuingRef = useRef(false);
  const [ready, setReady] = useState(false),
    [draftId, setDraftId] = useState(""),
    [status, setStatus] = useState("Loading draft…"),
    [error, setError] = useState(""),
    [drafts, setDrafts] = useState<any[]>([]),
    [restored, setRestored] = useState(false);
  const copySource = useRef<string | null>(null);
  const revision = useRef(0),
    baseline = useRef(""),
    latest = useRef(payload),
    active = useRef(""),
    flight = useRef<Promise<any> | null>(null),
    issued = useRef(false);
  latest.current = payload;
  const store = useCallback(() => {
    if (
      !owner ||
      !active.current ||
      issued.current ||
      draftFingerprint(latest.current) === baseline.current
    )
      return;
    try {
      localStorage.setItem(
        prefix + active.current,
        JSON.stringify({
          draftId: active.current,
          revision: revision.current,
          payload: latest.current,
          updatedAt: Date.now(),
        }),
      );
      return true;
    } catch {
      setError(
        "Browser recovery storage is unavailable. Keep this page open until the draft is saved.",
      );
      return false;
    }
  }, [owner, prefix]);
  const activate = useCallback(
    (row: any, recovered = false) => {
      issuingRef.current = row.status === "issuing";
      setIssuing(issuingRef.current);
      active.current = row.draftId;
      setDraftId(row.draftId);
      revision.current = row.revision || 0;
      baseline.current = draftFingerprint(row.payload);
      latest.current = row.payload;
      apply(row.payload);
      setRestored(recovered);
      setError("");
      setReady(true);
      setStatus(
        row.status === "issuing"
          ? "Issuance awaiting confirmation. Retry to find the original request."
          : row.revision
            ? "Draft saved"
            : "Draft not yet saved",
      );
    },
    [apply],
  );
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    issued.current = false;
    setReady(false);
    setDrafts([]);
    active.current = "";
    baseline.current = "";
    if (!owner) {
      setError("Sign in to save private drafts.");
      return;
    }
    const backups = () => {
      try {
        return Object.keys(localStorage)
          .filter((k) => k.startsWith(prefix))
          .map((k) => {
            try {
              return JSON.parse(localStorage.getItem(k)!);
            } catch {
              return null;
            }
          })
          .filter(
            (b) =>
              b?.payload &&
              Array.isArray(b.payload.items) &&
              (!initialClient || b.payload.clientId === initialClient),
          )
          .sort((a, b) => b.updatedAt - a.updatedAt);
      } catch {
        return [];
      }
    };
    (async () => {
      let list: any[] = [];
      let loadFailed = false;
      try {
        list = (await invoiceDraftsApi.list()).data;
      } catch {
        loadFailed = true;
      }
      if (!live) return;
      setDrafts(list);
      const backup = backups()[0];
      let row = list.find(
        (r) => !initialClient || r.payload.clientId === initialClient,
      );
      if (backup) {
        let saved = list.find((r) => r.draftId === backup.draftId);
        if (!saved && !loadFailed) {
          try {
            saved = (await invoiceDraftsApi.get(backup.draftId)).data;
          } catch {
            /* New unsynced draft */
          }
        }
        if (!live) return;
        if (saved?.status === "issued") {
          removeBackup(prefix + backup.draftId);
          onIssued(saved.paymentRequestId);
          return;
        }
        if (saved?.status === "issuing") {
          activate(saved, true);
          return;
        }
        {
          const newer =
            saved &&
            (saved.status === "discarded" ||
              saved.revision !== backup.revision);
          if (newer) copySource.current = prefix + backup.draftId;
          row = {
            draftId: newer ? uuid() : backup.draftId,
            revision: newer ? 0 : saved?.revision || backup.revision,
            payload: backup.payload,
          };
          activate(row, true);
          baseline.current = "";
          setStatus(
            newer
              ? "Recovered unsaved copy; newer saved draft kept separately"
              : "Recovered unsaved draft",
          );
          if (loadFailed)
            setError(
              "Draft server unavailable. Your browser recovery copy is restored.",
            );
          return;
        }
      }
      activate(
        row || { draftId: uuid(), revision: 0, payload: empty() },
        Boolean(row),
      );
      if (loadFailed)
        setError(
          "Draft server unavailable. Changes will be kept in this browser until saving succeeds.",
        );
    })();
    return () => {
      live = false;
      store();
    };
    // Initial load only; selecting/new drafts is handled explicitly and never overwrites an editing form.
  }, [enabled, owner, initialClient]);
  const serialized = draftFingerprint(payload);
  const flush = useCallback(async (): Promise<any> => {
    if (flight.current) {
      await flight.current;
      return flush();
    }
    if (!active.current || issued.current || issuingRef.current) return;
    const p = latest.current,
      fingerprint = draftFingerprint(p);
    if (fingerprint === baseline.current) return;
    store();
    setStatus("Saving draft…");
    setError("");
    const id = active.current;
    const work = invoiceDraftsApi
      .save(id, { revision: revision.current, payload: p })
      .then(({ data }) => {
        revision.current = data.revision;
        baseline.current = fingerprint;
        if (draftFingerprint(latest.current) === fingerprint) {
          let same = true;
          try {
            const backup = localStorage.getItem(prefix + id);
            same =
              !backup ||
              draftFingerprint(JSON.parse(backup).payload) === fingerprint;
          } catch {}
          if (same) removeBackup(prefix + id);
          if (copySource.current) {
            removeBackup(copySource.current);
            copySource.current = null;
          }
        } else store();
        setDrafts((rows) => [data, ...rows.filter((r) => r.draftId !== id)]);
        setStatus(
          "Draft saved at " +
            new Date(data.updatedAt || Date.now()).toLocaleTimeString(),
        );
        return data;
      })
      .catch((e: any) => {
        const backupSaved = store();
        setStatus("Draft not saved to server");
        setError(
          e.response?.status === 409
            ? "This draft changed in another tab. Your edits are kept here. Save as a copy to keep both versions."
            : backupSaved
              ? "Draft save failed. Your entries remain here and in browser recovery. Retry saving."
              : "Draft save failed and browser recovery is unavailable. Keep this page open and retry saving.",
        );
        throw e;
      })
      .finally(() => {
        flight.current = null;
      });
    flight.current = work;
    const result = await work;
    if (draftFingerprint(latest.current) !== baseline.current) return flush();
    return result;
  }, [prefix, store]);
  useEffect(() => {
    if (!enabled || !ready || issued.current || issuingRef.current) return;
    store();
    if (serialized === baseline.current) return;
    const timer = setTimeout(() => {
      void flush().catch(() => {});
    }, 650);
    return () => clearTimeout(timer);
  }, [enabled, ready, draftId, serialized, store, flush]);
  useEffect(() => {
    if (!enabled) return;
    const unload = () => store();
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [enabled, store]);
  const startNew = async () => {
    await flush();
    activate({ draftId: uuid(), revision: 0, payload: empty() });
  };
  const select = async (id: string) => {
    await flush();
    const row = (await invoiceDraftsApi.get(id)).data;
    activate(row, true);
  };
  const copy = () => {
    store();
    copySource.current = prefix + active.current;
    activate({ draftId: uuid(), revision: 0, payload: latest.current }, true);
    baseline.current = "";
  };
  const discard = async () => {
    await flush();
    await invoiceDraftsApi.discard(active.current, {
      revision: revision.current,
    });
    removeBackup(prefix + active.current);
    setDrafts((rows) => rows.filter((r) => r.draftId !== active.current));
    activate({ draftId: uuid(), revision: 0, payload: empty() });
  };
  const issue = async () => {
    await flush();
    try {
      localStorage.setItem(
        prefix + active.current,
        JSON.stringify({
          draftId: active.current,
          revision: revision.current,
          payload: latest.current,
          updatedAt: Date.now(),
          issuing: true,
        }),
      );
    } catch {
      setError(
        "Browser recovery is unavailable; the draft is saved on the server.",
      );
    }
    let response;
    try {
      response = await invoiceDraftsApi.issue(active.current, {
        revision: revision.current,
      });
    } catch (e) {
      try {
        const saved = (await invoiceDraftsApi.get(active.current)).data;
        if (saved.status === "issuing" || saved.status === "issued") {
          issuingRef.current = true;
          setIssuing(true);
          setStatus(
            "Issuance awaiting confirmation. Retry to find the original request.",
          );
        }
      } catch {}
      throw e;
    }
    issued.current = true;
    removeBackup(prefix + active.current);
    return response;
  };
  return {
    ready,
    issuing,
    draftId,
    status,
    error,
    drafts,
    restored,
    flush,
    startNew,
    select,
    copy,
    discard,
    issue,
  };
}
