import PreparationIdentity from "./PreparationIdentity";
import React, { useEffect, useState, useRef } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Modal } from "antd";
import { Plus, CalendarDays, List, Archive, Save } from "lucide-react";
import { api, clientsApi, bookingsApi } from "../services/api";
import MedicalPreparationCalendar from "./MedicalPreparationCalendar";
import SearchableClientSelect from "./SearchableClientSelect";
import "./MedicalPreparationWorkspace.css";
const name = (c: any) => [c?.firstName, c?.lastName].filter(Boolean).join(" ");
const oid = (c: any) => (typeof c === "object" ? c?._id : c);
const empty = () => ({
  key: crypto.randomUUID(),
  name: "",
  instruction: "",
  category: "medication",
  action: "last_dose",
  timing: "days",
  value: "14",
  internalNote: "",
  taperPlan: "",
  isBlocking: true,
});
const errorText = (e: any) =>
  e.response?.data?.message || e.message || "Unable to save. Please retry.";
export default function MedicalPreparationWorkspace() {
  const [params, setParams] = useSearchParams(),
    location = useLocation(),
    navigate = useNavigate();
  const prefix = location.pathname.startsWith("/medical/")
    ? "/medical"
    : "/admin";
  const dirtyRef = useRef(false);
  const [contextClient, setContextClient] = useState("");
  useEffect(() => {
    let active = true;
    const id = params.get("bookingId");
    setContextClient("");
    if (id)
      bookingsApi
        .getOneFresh(id)
        .then((r) => {
          if (active) setContextClient(oid(r.data.clientId) || "");
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [params.get("bookingId")]);
  const [rows, setRows] = useState<any[]>([]),
    [clients, setClients] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(params.get("q") || ""),
    [month, setMonth] = useState(
      params.get("month") || new Date().toISOString().slice(0, 7),
    ),
    [refresh, setRefresh] = useState(0),
    [historyItem, setHistoryItem] = useState<any>(null);
  const view = params.get("view") || "items",
    draftId = params.get("draftId"),
    creating = params.get("new") === "1";
  const change = (key: string, value: string) => {
    const q = new URLSearchParams(params);
    if (value) q.set(key, value);
    else q.delete(key);
    setParams(q);
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const q = new URLSearchParams(params);
    ["view", "draftId", "new", "q", "month"].forEach((k) => q.delete(k));
    Promise.all([
      api.get("/medical-preparation?" + q),
      clientsApi.getBookingOptions(),
    ])
      .then(([r, c]) => {
        if (active) {
          setRows(r.data);
          setClients(c.data || []);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.toString(), refresh]);
  const visible = rows.filter(
    (r) =>
      (!params.get("bookingNumber") ||
        String(r.booking?.bookingNumber || "").includes(
          params.get("bookingNumber")!,
        )) &&
      (!params.get("retreat") ||
        String(r.retreat?.code || r.retreat?.name || "")
          .toLowerCase()
          .includes(params.get("retreat")!.toLowerCase())) &&
      `${r.name} ${name(r.client)} ${r.client?.display_id || ""} ${r.booking?.bookingNumber || ""} ${r.retreat?.code || r.retreat?.name || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const open = (r: any) => {
    if (r.status === "archived" && !r.draftId) setHistoryItem(r);
    else if (r.draftId) change("draftId", r.draftId);
    else navigate(`${prefix}/bookings/${r.booking._id}/medication-stop-plan`);
  };
  const close = (force = false) => {
    const finish = () => {
      dirtyRef.current = false;
      const q = new URLSearchParams(params);
      q.delete("new");
      q.delete("draftId");
      setParams(q);
      setRefresh((v) => v + 1);
    };
    if (dirtyRef.current && !force) {
      Modal.confirm({
        title: "Discard unsaved preparation changes?",
        content: "Your saved plan is kept. Unsaved edits will be lost.",
        okText: "Discard edits",
        onOk: finish,
      });
    } else finish();
  };
  return (
    <section className="preparation-workspace">
      <header>
        <div>
          <p className="preparation-eyebrow">Medical</p>
          <h1>Medical Preparation</h1>
          <p>
            Advisor-authored medication, supplement and preparation
            instructions.
          </p>
        </div>
        <button
          className="preparation-primary"
          disabled={loading||Boolean(params.get('bookingId')&&!contextClient)}
          onClick={() => change("new", "1")}
        >
          <Plus size={18} /> New preparation plan
        </button>
      </header>
      <div className="preparation-filters">
        <label>
          Search client, item or booking
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            onBlur={() => change("q", search)}
          />
        </label>
        <label>
          Client
          <SearchableClientSelect
            clients={clients}
            value={params.get("clientId") || ""}
            onChange={(id) => change("clientId", id)}
            ariaLabel="Filter preparation client"
          />
        </label>
        <label>
          Booking number
          <input
            value={params.get("bookingNumber") || ""}
            onChange={(e) => change("bookingNumber", e.target.value)}
          />
        </label>
        <label>
          Retreat code or name
          <input
            value={params.get("retreat") || ""}
            onChange={(e) => change("retreat", e.target.value)}
          />
        </label>
        <label>
          Status
          <select
            aria-label="Status"
            value={params.get("status") || "all"}
            onChange={(e) =>
              change("status", e.target.value === "all" ? "" : e.target.value)
            }
          >
            {["all", "draft", "approved", "published", "archived"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={params.get("from") || ""}
            onChange={(e) => change("from", e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={params.get("to") || ""}
            onChange={(e) => change("to", e.target.value)}
          />
        </label>
        <label className="preparation-check">
          <input
            type="checkbox"
            checked={params.get("undated") === "1"}
            onChange={(e) => change("undated", e.target.checked ? "1" : "")}
          />{" "}
          Awaiting dates
        </label>
      </div>
      {(params.get("bookingId") || params.get("retreatId")) && (
        <p className="preparation-scope">
          Filtered to {params.get("bookingId") ? "booking" : "retreat"} context.{" "}
          <button
            onClick={() => {
              const q = new URLSearchParams(params);
              q.delete("bookingId");
              q.delete("retreatId");
              setParams(q);
            }}
          >
            Show all preparation items
          </button>
        </p>
      )}
      <div
        role="tablist"
        aria-label="Preparation views"
        className="preparation-tabs"
      >
        <button
          role="tab"
          aria-selected={view === "items"}
          onClick={() => change("view", "items")}
        >
          <List size={18} /> Items ({visible.length})
        </button>
        <button
          role="tab"
          aria-selected={view === "calendar"}
          onClick={() => change("view", "calendar")}
        >
          <CalendarDays size={18} /> Calendar
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : loading ? (
        <p role="status">Loading preparation items…</p>
      ) : (
        <>
          {view === "calendar" ? (
            <>
              <div className="preparation-calendar-controls">
                <p>
                  {visible.filter((r) => !r.date).length} items awaiting a
                  booking/date remain in Items.
                </p>
              </div>
              <MedicalPreparationCalendar
                month={month}
                onMonthChange={(m) => {
                  setMonth(m);
                  change("month", m);
                }}
                items={visible
                  .filter((r) => r.date)
                  .map((r) => ({
                    name: `${r.action === "last_dose" ? "Last dose: " : r.action==='stop'?'Do not take from: ':""}${r.name} · Client #${r.client?.display_id} ${name(r.client)}${r.booking ? " · Booking #" + r.booking.bookingNumber : ""} · ${r.status}`,
                    instruction: r.instruction,
                    date: r.date,
                    onOpen: () => open(r),
                  }))}
              />
            </>
          ) : (
            <div className="preparation-items">
              {visible.map((r) => (
                <article key={r._id}>
                  <div>
                    <strong>
                      {r.action === "last_dose"
                        ? "Last dose: "
                        : r.action === "stop"
                          ? "Do not take from: "
                          : ""}
                      {r.name}
                    </strong>
                    <span className="preparation-status">
                      {r.status}
                      {r.version ? ` · version ${r.version}` : ""}
                      {r.completed ? " · completed" : ""}
                    </span>
                    <p>{r.instruction}</p>
                    <PreparationIdentity
                      client={r.client}
                      booking={r.booking}
                      retreat={r.retreat}
                      prefix={prefix}
                    />
                  </div>
                  <div>
                    <strong>
                      {r.date ||
                        (r.booking ? "Date not set" : "Awaiting booking")}
                    </strong>
                    <p>{r.timing}</p>
                    <button onClick={() => open(r)}>
                      {r.draftId
                        ? "Open draft"
                        : r.status === "archived"
                          ? "View archived item"
                          : "Open booking plan"}
                    </button>
                  </div>
                </article>
              ))}
              {!visible.length && (
                <p>No preparation items match these filters.</p>
              )}
            </div>
          )}
        </>
      )}
      <Modal
        open={creating || Boolean(draftId)}
        title={draftId ? "Preparation draft" : "New client preparation plan"}
        onCancel={() => close()}
        footer={null}
        width={900}
        destroyOnHidden
        maskClosable={false}
      >
        {(creating || draftId) && (
          <PreparationDraftEditor
            key={draftId || "new"}
            id={draftId || undefined}
            clients={clients}
            initialClient={params.get("clientId") || contextClient}
            initialBooking={params.get("bookingId") || ""}
            initialRetreat={params.get("retreatId") || ""}
            source={{
              medicalReviewRequestId:
                params.get("medicalReviewRequestId") || undefined,
              artifactId: params.get("artifactId") || undefined,
            }}
            onDirty={(v: boolean) => {
              dirtyRef.current = v;
            }}
            onSaved={(d: any) => {
              dirtyRef.current = false;
              const q = new URLSearchParams(params);
              q.delete("new");
              q.set("draftId", d._id);
              setParams(q);
              setRefresh((v) => v + 1);
            }}
            onClose={() => close(true)}
            prefix={prefix}
          />
        )}
      </Modal>
      <Modal
        open={Boolean(historyItem)}
        onCancel={() => setHistoryItem(null)}
        footer={null}
        title="Archived preparation item"
        destroyOnHidden
      >
        {historyItem && (
          <>
            <PreparationIdentity
              client={historyItem.client}
              booking={historyItem.booking}
              retreat={historyItem.retreat}
              prefix={prefix}
            />
            <h2>{historyItem.name}</h2>
            <p>
              {historyItem.date} · version {historyItem.version}
            </p>
            <p className="whitespace-pre-wrap">{historyItem.instruction}</p>
            <p>
              Archived clinical history. No active reminder is scheduled from
              this item.
            </p>
          </>
        )}
      </Modal>
    </section>
  );
}
function PreparationDraftEditor({
  id,
  clients,
  initialClient,
  onSaved,
  onClose,
  prefix,
  onDirty,
  source,
  initialBooking,
  initialRetreat,
}: any) {
  const navigate = useNavigate(),
    allowExit = useRef(false);
  const [doc, setDoc] = useState<any>(null),
    [clientId, setClientId] = useState(initialClient),
    [entries, setEntries] = useState<any[]>([empty()]),
    [bookings, setBookings] = useState<any[]>([]),
    [bookingId, setBookingId] = useState(initialBooking || ""),
    [preview, setPreview] = useState<any>(null),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(!id),
    [requestKey] = useState(() => crypto.randomUUID()),
    [reason, setReason] = useState("");
  const load = (d: any) => {
    setDoc(d);
    setClientId(oid(d.clientId));
    setBookingId(oid(d.bookingId) || initialBooking || "");
    setEntries(
      d.entries.map((e: any) => ({
        ...e,
        timing:
          e.daysBeforeRetreat != null
            ? "days"
            : e.monthsBeforeRetreat != null
              ? "months"
              : "date",
        value: String(
          e.daysBeforeRetreat ?? e.monthsBeforeRetreat ?? e.dueDate ?? "",
        ),
      })),
    );
    setDirty(false);
    setPreview(null);
    setLoaded(true);
  };
  useEffect(() => {
    if (id)
      api
        .get("/medical-preparation/drafts/" + id)
        .then((r) => load(r.data))
        .catch((e) => setError(errorText(e)));
  }, [id]);
  useEffect(() => {
    if (!clientId) {
      setBookings([]);
      return;
    }
    bookingsApi
      .getByClient(clientId)
      .then((r) =>
        setBookings(
          (r.data || []).filter(
            (b: any) =>
              b.status !== "cancelled" &&
              (!initialRetreat || oid(b.retreatId) === initialRetreat),
          ),
        ),
      )
      .catch((e) => setError(errorText(e)));
  }, [clientId]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const url = window.location.href,
      state = window.history.state;
    const onPop = (event: PopStateEvent) => {
      if (allowExit.current) return;
      event.stopImmediatePropagation();
      window.history.pushState(state, "", url);
      Modal.confirm({
        title: "Discard unsaved preparation changes?",
        okText: "Discard edits",
        onOk: () => {
          allowExit.current = true;
          onDirty(false);
          setDirty(false);
          navigate(-1);
        },
      });
    };
    window.addEventListener("popstate", onPop, true);
    return () => window.removeEventListener("popstate", onPop, true);
  }, [dirty, navigate]);
  const update = (i: number, changes: any) => {
    setEntries((v) => v.map((e, n) => (n === i ? { ...e, ...changes } : e)));
    setDirty(true);
    setPreview(null);
  };
  const run = async (work: () => Promise<any>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(errorText(e));
      if (id) {
        try {
          const r = await api.get("/medical-preparation/drafts/" + id);
          setDoc(r.data);
        } catch {}
      }
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      const payload = {
        clientId,
        source,
        revision: doc?.revision,
        requestKey,
        entries: entries.map(
          ({
            timing,
            value,
            dueDate,
            daysBeforeRetreat,
            monthsBeforeRetreat,
            ...e
          }) => ({
            ...e,
            ...(timing === "days"
              ? { daysBeforeRetreat: value }
              : timing === "months"
                ? { monthsBeforeRetreat: value }
                : { dueDate: value }),
          }),
        ),
      };
      const r = id
        ? await api.put("/medical-preparation/drafts/" + id, payload)
        : await api.post("/medical-preparation", payload);
      load(r.data);
      onSaved(r.data);
    });
  const selected =
    clients.find((c: any) => c._id === clientId) || doc?.clientId;
  if (!loaded) return <p role="status">{error || "Loading draft…"}</p>;
  return (
    <div
      className="preparation-editor"
      onClickCapture={(event) => {
        const link = (event.target as HTMLElement).closest("a");
        if (dirty && link && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          Modal.confirm({
            title: "Discard unsaved preparation changes?",
            okText: "Discard edits",
            onOk: () => {
              allowExit.current = true;
              onDirty(false);
              setDirty(false);
              const url = new URL(link.href);
              navigate(url.pathname + url.search);
            },
          });
        }
      }}
    >
      <p className="preparation-notice">
        Private draft. Saving or applying does not publish advice or send
        reminders. Medical approval and explicit publication remain on the
        booking plan.
      </p>
      {selected && <PreparationIdentity client={selected} prefix={prefix} />}
      {doc && (
        <p>
          Status: {doc.status} · Revision {doc.revision}
        </p>
      )}
      {doc?.status === "applied" ? (
        <>
          <p>
            This draft was applied. Continue editing the authoritative booking
            plan.
          </p>
          <Link
            to={`${prefix}/bookings/${oid(doc.bookingId)}/medication-stop-plan`}
          >
            Open applied booking plan
          </Link>
        </>
      ) : (
        <>
          <fieldset
            disabled={
              busy || doc?.status === "archived" || doc?.status === "applying"
            }
          >
            {!id && (
              <label>
                Client
                <SearchableClientSelect
                  clients={clients}
                  value={clientId}
                  onChange={(v) => {
                    setClientId(v);
                    setDirty(true);
                  }}
                  ariaLabel="Preparation client"
                />
              </label>
            )}
            {entries.map((e, i) => (
              <section className="preparation-entry" key={e.key}>
                <div className="preparation-entry-heading">
                  <h3>Item {i + 1}</h3>
                  <button
                    aria-label={`Remove item ${i + 1}`}
                    onClick={() => {
                      setEntries((v) => v.filter((_, n) => n !== i));
                      setDirty(true);
                      setPreview(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
                <div className="preparation-entry-grid">
                  <label>
                    Medication or substance
                    <input
                      value={e.name}
                      onChange={(v) => update(i, { name: v.target.value })}
                    />
                  </label>
                  <label>
                    Category
                    <select
                      aria-label="Category"
                      value={e.category}
                      onChange={(v) => update(i, { category: v.target.value })}
                    >
                      {[
                        "medication",
                        "supplement",
                        "drug",
                        "alcohol",
                        "other",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Action
                    <select
                      aria-label="Action"
                      value={e.action}
                      onChange={(v) => update(i, { action: v.target.value })}
                    >
                      <option value="last_dose">Last dose on</option>
                      <option value="stop">Do not take from</option>
                      {["reduce", "continue", "discuss", "avoid"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Timing
                    <select
                      aria-label="Timing"
                      value={e.timing}
                      onChange={(v) =>
                        update(i, { timing: v.target.value, value: "" })
                      }
                    >
                      <option value="days">Days before retreat</option>
                      <option value="months">
                        Calendar months before retreat
                      </option>
                      <option value="date">Specific date</option>
                    </select>
                  </label>
                  <label>
                    {e.timing === "date" ? "Date" : "Offset"}
                    <input
                      type={e.timing === "date" ? "date" : "number"}
                      min="0"
                      step="1"
                      value={e.value}
                      onChange={(v) => update(i, { value: v.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Advisor instruction
                  <textarea
                    value={e.instruction}
                    onChange={(v) => update(i, { instruction: v.target.value })}
                  />
                </label>
                <label>
                  Advisor-authored taper detail (optional)
                  <textarea
                    value={e.taperPlan}
                    onChange={(v) => update(i, { taperPlan: v.target.value })}
                  />
                </label>
                <label>
                  Internal note — never shown to client
                  <textarea
                    value={e.internalNote}
                    onChange={(v) =>
                      update(i, { internalNote: v.target.value })
                    }
                  />
                </label>
                <label className="preparation-check">
                  <input
                    type="checkbox"
                    checked={e.isBlocking}
                    onChange={(v) =>
                      update(i, { isBlocking: v.target.checked })
                    }
                  />
                  Required for medical clearance
                </label>
              </section>
            ))}
            <div className="preparation-editor-actions">
              <button
                onClick={() => {
                  setEntries((v) => [...v, empty()]);
                  setDirty(true);
                  setPreview(null);
                }}
              >
                <Plus size={16} /> Add item
              </button>
              <button
                className="preparation-primary"
                disabled={!clientId || !entries.length}
                onClick={save}
              >
                <Save size={16} />
                Save draft
              </button>
            </div>
          </fieldset>
          {id && ["draft", "applying"].includes(doc?.status) && (
            <section className="preparation-apply">
              <h3>Apply to booking</h3>
              <p>
                Dates use the linked retreat start date. Existing items are
                retained in a new or current private draft.
              </p>
              <label>
                Client booking
                <select
                  aria-label="Client booking"
                  value={bookingId}
                  onChange={(e) => {
                    setBookingId(e.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="">Choose booking</option>
                  {bookings.map((b) => (
                    <option key={b._id} value={b._id}>
                      Booking #{b.bookingNumber} ·{" "}
                      {b.retreatId?.code || b.retreatId?.name || ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy || dirty || !bookingId}
                onClick={() =>
                  run(async () => {
                    const r = await api.post(
                      "/medical-preparation/drafts/" + id + "/preview",
                      { bookingId },
                    );
                    setPreview(r.data);
                  })
                }
              >
                Preview booking dates
              </button>
              {dirty && <p>Save changes before previewing dates.</p>}
              {preview && (
                <div className="preparation-preview">
                  <PreparationIdentity
                    client={doc.clientId}
                    booking={preview.booking}
                    retreat={preview.booking.retreatId}
                    prefix={prefix}
                  />
                  <p>
                    Anchor: {preview.anchor} · {preview.existingCount} existing
                    items retained
                  </p>
                  {preview.entries.map((e: any) => (
                    <p key={e.key}>
                      <strong>{e.resolvedDate}</strong> ·{" "}
                      {e.action === "last_dose"
                        ? "Last dose: "
                        : e.action === "stop"
                          ? "Do not take from: "
                          : ""}
                      {e.name}
                    </p>
                  ))}
                  <button
                    className="preparation-primary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const r = await api.post(
                          "/medical-preparation/drafts/" + id + "/apply",
                          {
                            bookingId,
                            revision: doc.revision,
                            previewToken: preview.previewToken,
                            requestKey: doc.applicationKey || requestKey,
                          },
                        );
                        load(r.data);
                        onSaved(r.data);
                      })
                    }
                  >
                    Apply as private booking draft
                  </button>
                </div>
              )}
              {doc.status === "draft" && (
                <details>
                  <summary>Archive this potential plan</summary>
                  <label>
                    Archive reason
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      run(async () => {
                        await api.post(
                          "/medical-preparation/drafts/" + id + "/archive",
                          { revision: doc.revision, reason },
                        );
                        onClose();
                      })
                    }
                  >
                    <Archive size={16} />
                    Archive draft
                  </button>
                </details>
              )}
            </section>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Saving…</p>}
    </div>
  );
}
