import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  clientSupportApi as api,
  clientsApi,
  bookingsApi,
} from "../../services/api";
import "./ClientSupportInbox.css";
const stage = (r: any) =>
  r.status === "completed"
    ? "resolved"
    : r.status === "cancelled"
      ? "cancelled"
      : r.status === "pending"
        ? "new"
        : r.support.waitingOn || "working";
const labels: any = {
  new: "New",
  working: "In progress",
  client: "Waiting for client",
  team: "Waiting for team",
  resolved: "Resolved",
  cancelled: "Cancelled",
};
export default function ClientSupportInbox() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams(),
    reference = params.get("support") || "all";
  const [rows, setRows] = useState<any[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [view, setView] = useState("all"),
    [q, setQ] = useState(""),
    [topicFilter, setTopicFilter] = useState(""),
    [settings, setSettings] = useState<any>(null),
    [current, setCurrent] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState(""),
    [due, setDue] = useState(""),
    [nextStage, setNextStage] = useState("new"),
    [mode, setMode] = useState<"reply" | "internal">("reply"),
    [drafts, setDrafts] = useState({ reply: "", internal: "" }),
    [notify, setNotify] = useState(true),
    [resolve, setResolve] = useState(false),
    [preview, setPreview] = useState(false),
    [messageKey, setMessageKey] = useState(() => crypto.randomUUID());
  const [linkTopic, setLinkTopic] = useState(""),
    [linkIssue, setLinkIssue] = useState(""),
    [linkBooking, setLinkBooking] = useState(params.get("booking") || ""),
    [copied, setCopied] = useState("");
  const [showSettings, setShowSettings] = useState(false),
    [recipients, setRecipients] = useState(""),
    [responseHours, setResponseHours] = useState("");
  const [showCapture, setShowCapture] = useState(false),
    [clients, setClients] = useState<any[]>([]),
    [bookings, setBookings] = useState<any[]>([]),
    [capture, setCapture] = useState({
      clientId: "",
      bookingId: "",
      topic: "",
      issue: "",
      message: "",
      origin: "phone",
      requestKey: crypto.randomUUID(),
    });
  const topic = settings?.topics?.find((v: any) => v.id === linkTopic);
  const link = new URL(
    "/support",
    settings?.portalBase || "https://www.ibogaready.com",
  );
  if (linkTopic) link.searchParams.set("topic", linkTopic);
  if (linkIssue) link.searchParams.set("issue", linkIssue);
  if (linkBooking.trim()) link.searchParams.set("booking", linkBooking.trim());
  const load = async () => {
    const { data } = await api.list({
      view,
      q,
      topic: topicFilter,
      page,
      clientId: params.get("clientId") || "",
      bookingId: params.get("bookingId") || "",
    });
    setRows(data.items);
    setTotal(data.total);
  };
  const apply = (r: any) => {
    setCurrent(r);
    setOwner(r.assignedTo || "");
    setDue(String(r.dueDate || "").slice(0, 10));
    setNextStage(stage(r));
  };
  useEffect(() => {
    api
      .settings()
      .then((r) => {
        setSettings(r.data);
        setRecipients(r.data.recipients.join("\n"));
        setResponseHours(r.data.responseHours);
      })
      .catch(() => setError("Could not load support settings."));
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        api
          .list({
            view,
            q,
            topic: topicFilter,
            page,
            clientId: params.get("clientId") || "",
            bookingId: params.get("bookingId") || "",
          })
          .then((r) => {
            if (active) {
              setRows(r.data.items);
              setTotal(r.data.total);
            }
          })
          .catch(() => {
            if (active) setError("Could not load support requests.");
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    view,
    q,
    topicFilter,
    page,
    params.get("clientId"),
    params.get("bookingId"),
  ]);
  useEffect(() => {
    let active = true;
    setCurrent(null);
    setError("");
    setDrafts({ reply: "", internal: "" });
    setMessageKey(crypto.randomUUID());
    if (reference !== "all")
      api
        .detail(reference)
        .then((r) => {
          if (active) apply(r.data);
        })
        .catch(() => {
          if (active) setError("Could not load this support request.");
        });
    return () => {
      active = false;
    };
  }, [reference]);
  const mutate = async (fn: () => Promise<any>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      try {
        await load();
      } catch {
        setError(
          "Saved, but the inbox could not refresh. Reload the queue to see the latest items.",
        );
      }
    } catch (e: any) {
      setError(
        e.response?.data?.message ||
          "Could not save. Your message has been kept. Reload the request before retrying if it changed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const reload = () =>
    current && api.detail(current._id).then((r) => apply(r.data));
  const send = () =>
    void mutate(async () => {
      const { data } = await api.message(current._id, {
        revision: current.support.revision,
        message: drafts[mode],
        internal: mode === "internal",
        notify: mode === "reply" && notify,
        resolve: mode === "reply" && resolve,
        requestKey: messageKey,
      });
      apply(data);
      setDrafts((d) => ({ ...d, [mode]: "" }));
      setMessageKey(crypto.randomUUID());
      setPreview(false);
      setNotice(
        mode === "internal"
          ? "Private note saved. No client notification."
          : "Reply saved. Delivery status is shown below.",
      );
    });
  const openCapture = async () => {
    setShowCapture(true);
    try {
      const [c, b] = await Promise.all([
        clientsApi.getAll(),
        bookingsApi.getAll(),
      ]);
      setClients(c.data);
      setBookings(Array.isArray(b.data) ? b.data : (b.data as any).items || []);
    } catch {
      setError("Could not load clients and bookings.");
    }
  };
  const templates: any = {
    en: {
      ack: "Thank you for your request. We are reviewing it and will update this conversation.",
      details:
        "Please add the payment date, amount, currency, provider and transaction reference so we can check the original transaction.",
      dates:
        "Which dates would you prefer? We will check availability before confirming any change.",
    },
    pl: {
      ack: "Dziękujemy za zgłoszenie. Sprawdzamy je i odpowiemy w tej rozmowie.",
      details:
        "Podaj datę płatności, kwotę, walutę, operatora i tytuł przelewu, abyśmy mogli sprawdzić transakcję.",
      dates:
        "Jaki termin preferujesz? Sprawdzimy dostępność przed potwierdzeniem zmiany.",
    },
    cs: {
      ack: "Děkujeme za žádost. Prověřujeme ji a odpovíme v této konverzaci.",
      details:
        "Uveďte datum platby, částku, měnu, poskytovatele a variabilní symbol, abychom mohli ověřit transakci.",
      dates:
        "Který termín preferujete? Před potvrzením změny ověříme dostupnost.",
    },
  };
  const captureTopic = settings?.topics?.find(
    (t: any) => t.id === capture.topic,
  );
  return (
    <main className="support-inbox">
      <header>
        <div>
          <button onClick={() => navigate("/admin/tasks")}>
            ← Operational tasks
          </button>
          <h1>Client support</h1>
          <p>
            Requests from clients, with one conversation and next action per
            case.
          </p>
        </div>
        <div>
          <button onClick={() => void openCapture()}>
            Record phone / WhatsApp request
          </button>
          <button onClick={() => setShowSettings(!showSettings)}>
            Notification settings
          </button>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <details className="support-box">
        <summary>Copy a support link to send to a client</summary>
        <div className="support-link-builder">
          <label>
            Topic
            <select
              aria-label="Topic"
              value={linkTopic}
              onChange={(e) => {
                setLinkTopic(e.target.value);
                setLinkIssue("");
              }}
            >
              <option value="">Any topic</option>
              {settings?.topics?.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.label.en}
                </option>
              ))}
            </select>
          </label>
          <label>
            Issue
            <select
              aria-label="Issue"
              value={linkIssue}
              onChange={(e) => setLinkIssue(e.target.value)}
              disabled={!topic}
            >
              <option value="">Let client choose</option>
              {topic?.issues.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.label.en}
                </option>
              ))}
            </select>
          </label>
          <label>
            Booking number (optional)
            <input
              value={linkBooking}
              onChange={(e) => setLinkBooking(e.target.value)}
              placeholder="1320"
            />
          </label>
        </div>
        <input
          aria-label="Shareable support link"
          value={link.toString()}
          readOnly
        />
        <button
          onClick={() =>
            void navigator.clipboard
              .writeText(link.toString())
              .then(() => setCopied("Link copied."))
              .catch(() => setCopied("Select and copy the link above."))
          }
        >
          Copy support link
        </button>
        <span role="status">{copied}</span>
        <p>
          These links prefill the request after sign-in. They do not submit a
          request or grant access to another client’s booking.
        </p>
      </details>
      {showSettings && (
        <section className="support-box">
          <h2>Support notifications</h2>
          <label>
            Email recipients (one per line)
            <textarea
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
          </label>
          <label>
            Support hours / response expectation shown to clients
            <input
              value={responseHours}
              onChange={(e) => setResponseHours(e.target.value)}
              maxLength={300}
            />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              void mutate(async () => {
                const { data } = await api.saveSettings({
                  recipients: recipients.split(/[\s,;]+/).filter(Boolean),
                  responseHours,
                });
                setSettings(data);
                setNotice("Support settings saved.");
              })
            }
          >
            Save notification settings
          </button>
          <p>
            Administrator access required to change settings. No response-time
            promise is sent until configured.
          </p>
        </section>
      )}
      {showCapture && (
        <form
          className="support-box"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate(async () => {
              const { data } = await api.create(capture);
              setShowCapture(false);
              setCapture({
                ...capture,
                message: "",
                requestKey: crypto.randomUUID(),
              });
              setParams({ support: data.supportReference });
            });
          }}
        >
          <h2>Record a client request</h2>
          <label>
            Client
            <select
              aria-label="Client"
              required
              value={capture.clientId}
              onChange={(e) =>
                setCapture({
                  ...capture,
                  clientId: e.target.value,
                  bookingId: "",
                })
              }
            >
              <option value="">Choose client</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.firstName} {c.lastName} · {c.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            Booking
            <select
              aria-label="Booking"
              value={capture.bookingId}
              onChange={(e) =>
                setCapture({ ...capture, bookingId: e.target.value })
              }
            >
              <option value="">No booking</option>
              {bookings
                .filter(
                  (b) =>
                    String(b.clientId?._id || b.clientId) === capture.clientId,
                )
                .map((b) => (
                  <option key={b._id} value={b._id}>
                    #{b.bookingNumber}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Source
            <select
              aria-label="Source"
              value={capture.origin}
              onChange={(e) =>
                setCapture({ ...capture, origin: e.target.value })
              }
            >
              {["phone", "whatsapp", "email"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Topic
            <select
              aria-label="Topic"
              required
              value={capture.topic}
              onChange={(e) =>
                setCapture({ ...capture, topic: e.target.value, issue: "" })
              }
            >
              <option value="">Choose</option>
              {settings?.topics.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.label.en}
                </option>
              ))}
            </select>
          </label>
          <label>
            Issue
            <select
              aria-label="Issue"
              required
              value={capture.issue}
              onChange={(e) =>
                setCapture({ ...capture, issue: e.target.value })
              }
            >
              <option value="">Choose</option>
              {captureTopic?.issues.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.label.en}
                </option>
              ))}
            </select>
          </label>
          <label>
            Client request
            <textarea
              required
              maxLength={4000}
              value={capture.message}
              onChange={(e) =>
                setCapture({ ...capture, message: e.target.value })
              }
            />
          </label>
          <button disabled={busy}>Save request</button>
          <button type="button" onClick={() => setShowCapture(false)}>
            Cancel
          </button>
        </form>
      )}
      {current ? (
        <section className="support-box">
          <button onClick={() => setParams({ support: "all" })}>
            ← Back to support inbox
          </button>
          <div className="support-case-layout">
            <article>
              <h2>
                {current.supportReference} · {current.name}
              </h2>
              {current.support.messages.map((m: any) => (
                <div
                  key={m.id}
                  className={
                    "support-conversation " +
                    (m.kind === "internal"
                      ? "internal"
                      : m.kind === "reply"
                        ? "reply"
                        : "")
                  }
                >
                  <strong>
                    {m.kind === "internal"
                      ? "Internal note — staff only"
                      : m.kind === "reply"
                        ? "Staff reply"
                        : "Client request"}
                  </strong>
                  <p>{m.body}</p>
                  <small>
                    {new Date(m.at).toLocaleString()} ·{" "}
                    {m.kind === "client" ? "Client" : m.actor}
                  </small>
                </div>
              ))}
              <div role="group" aria-label="Message visibility">
                <button
                  className={mode === "reply" ? "selected" : ""}
                  onClick={() => {
                    setMode("reply");
                    setPreview(false);
                  }}
                >
                  Reply to client
                </button>
                <button
                  className={mode === "internal" ? "selected" : ""}
                  onClick={() => {
                    setMode("internal");
                    setPreview(false);
                  }}
                >
                  Internal note
                </button>
              </div>
              {mode === "reply" && (
                <label>
                  Insert response template
                  <select
                    aria-label="Insert response template"
                    value=""
                    onChange={(e) => {
                      const text = (templates[current.support.language] ||
                        templates.en)[e.target.value];
                      if (text) {
                        setDrafts((d) => ({
                          ...d,
                          reply: d.reply ? d.reply + "\n\n" + text : text,
                        }));
                        setPreview(false);
                      }
                    }}
                  >
                    <option value="">Choose a draft to edit</option>
                    <option value="ack">Acknowledge request</option>
                    <option value="details">Ask for payment details</option>
                    <option value="dates">Ask for preferred dates</option>
                  </select>
                </label>
              )}
              <label>
                {mode === "internal"
                  ? "Private staff note"
                  : "Client-visible reply"}
                <textarea
                  value={drafts[mode]}
                  onChange={(e) => {
                    setDrafts({ ...drafts, [mode]: e.target.value });
                    setPreview(false);
                  }}
                  maxLength={4000}
                  rows={5}
                />
              </label>
              {mode === "reply" && (
                <>
                  <label className="support-check">
                    <input
                      type="checkbox"
                      checked={notify}
                      onChange={(e) => setNotify(e.target.checked)}
                    />
                    Notify client by email with a secure link
                  </label>
                  <label className="support-check">
                    <input
                      type="checkbox"
                      checked={resolve}
                      onChange={(e) => setResolve(e.target.checked)}
                    />
                    Resolve request with this reply
                  </label>
                </>
              )}
              {preview ? (
                <div className="support-preview">
                  <strong>
                    {mode === "internal"
                      ? "Staff only — no client email"
                      : notify
                        ? "Visible to client; email notification enabled"
                        : "Visible in IR; no email notification"}
                  </strong>
                  <p>{drafts[mode]}</p>
                  <button disabled={busy} onClick={send}>
                    {busy
                      ? "Saving…"
                      : mode === "internal"
                        ? "Save internal note"
                        : notify
                          ? "Send reply & notify client"
                          : "Save reply without email"}
                  </button>
                  <button onClick={() => setPreview(false)}>
                    Continue editing
                  </button>
                </div>
              ) : (
                <button
                  disabled={busy || !drafts[mode].trim()}
                  onClick={() => setPreview(true)}
                >
                  Preview {mode === "internal" ? "internal note" : "reply"}
                </button>
              )}
              <h3>Notification delivery</h3>
              {current.support.deliveries.map((d: any) => (
                <p key={d.id}>
                  {d.to} · {d.state}
                  {d.error ? " · " + d.error : ""}
                </p>
              ))}
              <button
                disabled={busy}
                onClick={() =>
                  void mutate(async () =>
                    apply((await api.retry(current._id)).data),
                  )
                }
              >
                Retry / verify notifications
              </button>
            </article>
            <aside>
              <h3>Client & booking</h3>
              <p>
                <Link
                  to={
                    current.clientId?._id
                      ? "/admin/clients/" + current.clientId._id
                      : "/admin/tasks?support=" + current.supportReference
                  }
                >
                  {current.clientId?.firstName ||
                    current.support.reporterName ||
                    "Unmatched contact"}{" "}
                  {current.clientId?.lastName}
                </Link>
                <br />
                {current.clientId?.email || current.support.reporterEmail}
                <br />
                {current.clientId?.phone && (
                  <a href={"tel:" + current.clientId.phone}>
                    {current.clientId.phone}
                  </a>
                )}
              </p>
              {current.support.reportedBooking && (
                <p>
                  Reported booking number (unverified):{" "}
                  {current.support.reportedBooking}
                </p>
              )}
              {current.support.reportedPhone && (
                <p>
                  Reported reply phone (not verified):{" "}
                  {current.support.reportedPhone}
                </p>
              )}
              {current.bookingId ? (
                <Link to={"/admin/bookings/" + current.bookingId._id}>
                  Booking #{current.bookingId.bookingNumber}
                </Link>
              ) : (
                <p>
                  {current.support.bookingUnknown
                    ? "Client could not find booking number"
                    : "General question / no booking"}
                </p>
              )}
              <p>
                {current.retreatId?.name || current.retreatId?.code} ·{" "}
                {current.support.queue}
              </p>
              <label>
                Owner email
                <input
                  list="support-owners"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  type="email"
                />
                <datalist id="support-owners">
                  {settings?.owners?.map((o: any) => (
                    <option key={o.email} value={o.email}>
                      {o.firstName} {o.lastName}
                    </option>
                  ))}
                </datalist>
              </label>
              <label>
                Stage
                <select
                  aria-label="Stage"
                  value={nextStage}
                  onChange={(e) => setNextStage(e.target.value)}
                >
                  {Object.entries(labels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {String(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Next action due (UTC)
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void mutate(async () =>
                    apply(
                      (
                        await api.update(current._id, {
                          revision: current.support.revision,
                          assignedTo: owner,
                          dueDate: due,
                          stage: nextStage,
                          read: true,
                        })
                      ).data,
                    ),
                  )
                }
              >
                Save ownership & stage
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void reload()?.catch(() =>
                    setError("Could not reload request."),
                  )
                }
              >
                Reload request
              </button>
              <p>
                Booking, payment and refund changes must be performed in their
                own workspaces.
              </p>
            </aside>
          </div>
        </section>
      ) : (
        <>
          <nav aria-label="Support queue" className="support-views">
            {[
              ["all", "Open"],
              ["new", "New"],
              ["mine", "Mine"],
              ["unassigned", "Unassigned"],
              ["client", "Waiting for client"],
              ["team", "Waiting for team"],
              ["overdue", "Due / overdue"],
              ["resolved", "Resolved / cancelled"],
            ].map(([k, v]) => (
              <button
                key={k}
                className={view === k ? "selected" : ""}
                onClick={() => {
                  setView(k);
                  setPage(1);
                }}
              >
                {v}
              </button>
            ))}
          </nav>
          <div className="support-link-builder">
            <label>
              Search requests
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Reference, booking #, phone, name or email"
              />
            </label>
            <label>
              Filter topic
              <select
                aria-label="Filter topic"
                value={topicFilter}
                onChange={(e) => {
                  setTopicFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All topics</option>
                {settings?.topics?.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.label.en}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="support-table">
            <table>
              <thead>
                <tr>
                  {[
                    "Request",
                    "Client / booking",
                    "Owner",
                    "Stage",
                    "Next action",
                    "Last activity",
                  ].map((v) => (
                    <th key={v}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <button
                        className="support-row-link"
                        onClick={() =>
                          setParams({ support: r.supportReference })
                        }
                      >
                        {r.support.unread ? "● " : ""}
                        {r.supportReference}
                        <br />
                        {r.name}
                      </button>
                      <small>
                        {r.support.queue} · {r.support.origin}
                      </small>
                    </td>
                    <td>
                      {r.clientId?.firstName ||
                        r.support.reporterName ||
                        r.support.reporterEmail ||
                        "Unmatched contact"}{" "}
                      {r.clientId?.lastName}
                      <br />
                      {r.bookingId
                        ? "#" + r.bookingId.bookingNumber
                        : "No booking"}
                      <br />
                      {r.clientId?.phone}
                    </td>
                    <td>{r.assignedTo || "Unassigned"}</td>
                    <td>{labels[stage(r)]}</td>
                    <td>{String(r.dueDate || "").slice(0, 10) || "Not set"}</td>
                    <td>
                      {new Date(
                        r.support.lastClientAt || r.createdAt,
                      ).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {total} requests · Page {page}
          </p>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <button
            disabled={page * 50 >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </>
      )}
    </main>
  );
}
