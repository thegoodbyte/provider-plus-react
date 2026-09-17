import EmailSafetySettings from './EmailSafetySettings';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { announcementsApi, communicationsApi } from "../services/api";
import { EmailTemplate } from "../types";
import "./AnnouncementsPage.css";

type Rule = {
  _id?: string;
  scheduledFor?: string;
  schedulingError?: string;
  title: string;
  days: number;
  timing: "before_start" | "after_end";
  sendTime: string;
  emailTemplateId: any;
  useRecipientLanguage: boolean;
  active: boolean;
};
type Delivery = {
  _id: string;
  ruleId: string;
  bookingId: string;
  title: string;
  scheduledFor: string;
  status: string;
  clientId?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    language?: string;
  };
  recipient?: string;
  language?: string;
  lastError?: string;
  attemptCount?: number;
  executedAt?: string;
  sentEmailId?: string;
  subject?: string;
  attachments?: { fileName: string }[];
  history: { at: string; status: string; message?: string; actor?: string }[];
};
type Data = {
  testRecipients?: { bookingId: string; name: string; language: string }[];
  testEmails?: { _id: string; subject: string; to: string[]; status: string; sentAt?: string; createdAt?: string; errorMessage?: string }[];
  rules: Rule[];
  deliveries: Delivery[];
  settings: { enabled: boolean };
  worker?: {
    enabled?: boolean;
    lastFinishedAt?: string;
    lastStartedAt?: string;
    lastError?: string;
  };
};
const newRule = (): Rule => ({
  title: "",
  days: 3,
  timing: "before_start",
  sendTime: "09:00",
  emailTemplateId: "",
  useRecipientLanguage: true,
  active: true,
});
const templateId = (rule: Rule) =>
  typeof rule.emailTemplateId === "string"
    ? rule.emailTemplateId
    : rule.emailTemplateId?._id || "";
export const announcementTiming = (rule: Pick<Rule, "days" | "timing">) =>
  rule.timing === "before_start"
    ? rule.days === 0
      ? "Arrival day"
      : `${rule.days} ${rule.days === 1 ? "day" : "days"} before arrival`
    : rule.days === 0
      ? "Departure day"
      : `${rule.days} ${rule.days === 1 ? "day" : "days"} after the retreat ends`;
const dateLabel = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Prague",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
const statusLabel = (status: string) =>
  ({
    scheduled: "Scheduled",
    test_sent: "Test sent — client not emailed",
    processing: "Sending",
    sent: "Sent",
    failed: "Failed",
    uncertain: "Check delivery",
    skipped: "Skipped",
    cancelled: "Cancelled",
  })[status] || status;

const AnnouncementsPage: React.FC<{ retreatId?: string }> = ({ retreatId }) => {
  const [data, setData] = useState<Data | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [testBookingId, setTestBookingId] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [editor, setEditor] = useState<Rule | null>(null);
  const [step, setStep] = useState(0);
  const [view, setView] = useState("schedule");
  const [preview, setPreview] = useState<{
    subject: string;
    bodyText: string;
    language: string;
    attachmentAssetIds: string[];
    deliveryStatus?: string;
  } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLDialogElement>(null);
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const [schedule, emailTemplates] = await Promise.all([
        announcementsApi.get(retreatId),
        communicationsApi.getTemplates(),
      ]);
      if (version !== requestVersion.current) return;
      setData(schedule.data);
      setTemplates(
        (emailTemplates.data || []).filter(
          (item: EmailTemplate) => item.active !== false,
        ),
      );
    } catch (caught: any) {
      if (version === requestVersion.current)
        setError(
          caught?.response?.data?.message ||
            "Could not load announcements. Please try again.",
        );
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [retreatId]);
  useEffect(() => {
    setData(null);
    setTestBookingId('');
    setTestMessage('');
    setEditor(null);
    setPreview(null);
    void load();
    return () => {
      requestVersion.current++;
    };
  }, [load]);
  useEffect(() => {
    if (editor) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [editor]);
  useEffect(() => {
    if (preview) previewRef.current?.showModal();
    else previewRef.current?.close();
  }, [preview]);
  const mutate = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (caught: any) {
      setError(
        caught?.response?.data?.message || caught?.message ||
          "Could not save this change. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const selectedTemplate = templates.find(
    (item) => item._id === (editor ? templateId(editor) : ""),
  );
  const rules = useMemo(
    () =>
      [...(data?.rules || [])].sort((a, b) =>
        a.timing !== b.timing
          ? a.timing === "before_start"
            ? -1
            : 1
          : a.timing === "before_start"
            ? b.days - a.days
            : a.days - b.days,
      ),
    [data],
  );
  const attention = (data?.deliveries || []).filter((row) =>
    ["failed", "uncertain"].includes(row.status),
  );
  const rows = (data?.deliveries || []).filter((row) =>
    view === "upcoming"
      ? ["scheduled", "processing", "test_sent"].includes(row.status)
      : view === "attention"
        ? ["failed", "uncertain"].includes(row.status)
        : !["scheduled", "processing", "test_sent"].includes(row.status),
  );
  const edit = (rule = newRule()) => {
    setError("");
    setEditor({ ...rule, emailTemplateId: templateId(rule) });
    setStep(0);
  };
  const save = () =>
    mutate(async () => {
      if (!editor) return;
      await announcementsApi.save(retreatId, editor._id, editor);
      setEditor(null);
    });
  const previewDelivery = async (row: Delivery) => {
    setBusy(true);
    setError("");
    try {
      const response = await announcementsApi.preview(
        row.ruleId,
        row.bookingId,
      );
      setPreview(response.data);
    } catch (caught: any) {
      setError(
        caught?.response?.data?.message || "Could not preview this email.",
      );
    } finally {
      setBusy(false);
    }
  };
  const viewEmailLog = async (row: Delivery) => {
    setBusy(true);
    setError("");
    try {
      const response = row.sentEmailId
        ? await communicationsApi.getSentEmail(row.sentEmailId)
        : await communicationsApi.getSentEmails({
            relatedEntityType: "retreat_announcement",
            relatedEntityId: row._id,
          });
      const email: any = Array.isArray(response.data)
        ? response.data[0]
        : response.data;
      if (!email) {
        setError(
          "No email log was recorded. Check the sending mailbox before resolving an interrupted delivery.",
        );
        return;
      }
      setPreview({
        subject: email.subject,
        bodyText: email.bodyText,
        language: row.language || "",
        attachmentAssetIds: email.attachments || [],
        deliveryStatus:
          email.status + (email.errorMessage ? ` · ${email.errorMessage}` : ""),
      });
    } catch (caught: any) {
      setError(
        caught?.response?.data?.message || "Could not load the email log.",
      );
    } finally {
      setBusy(false);
    }
  };
  const sendTest = (rule: Rule) => mutate(async () => {
    setTestMessage('');
    const result = await announcementsApi.sendTest(rule._id!, testBookingId);
    if (result.data.status !== 'sent') throw new Error(result.data.error || 'The test email could not be sent. Check the email log.');
    setTestMessage(`Test email sent to ${result.data.recipient.join(', ')}. No client was emailed and the live schedule is unchanged.`);
  });
  const workerRecent =
    data?.worker?.lastFinishedAt &&
    Date.now() - new Date(data.worker.lastFinishedAt).getTime() < 20 * 60_000;
  return (
    <section className="announcements">
      <header className="announcement-header">
        <div>
          <span className="announcement-eyebrow">RETREAT COMMUNICATIONS</span>
          <h1>{retreatId ? "Announcements" : "Announcement schedule"}</h1>
          <p>
            {retreatId
              ? "What each participant receives, before arrival and after the retreat."
              : "Build a reusable email timeline, then apply it from a retreat’s Announcements tab."}
          </p>
        </div>
        <button
          className="announcement-primary"
          disabled={loading || busy || !data}
          onClick={() => edit()}
        >
          + Add announcement
        </button>
      </header>
      <EmailSafetySettings compact />
      {testMessage && <p role="status" className="announcement-help">{testMessage}</p>}
      {error && (
        <div role="alert" className="announcement-error">
          {error} {!editor && <button onClick={load}>Reload</button>}
        </div>
      )}
      {loading && <p role="status">Loading announcements…</p>}
      {retreatId && data && <div className="announcement-control-bar"><div><strong>Test an announcement</strong><p>Choose whose language and booking details to preview. Every test goes only to the configured safety inbox, even with safety mode off.</p><label>Sample participant<select aria-label="Sample participant" value={testBookingId} onChange={event => setTestBookingId(event.target.value)}><option value="">Choose a participant</option>{(data.testRecipients || []).map(person => <option key={person.bookingId} value={person.bookingId}>{person.name} ({person.language})</option>)}</select></label></div></div>}
      {data && (
        <>
          {retreatId && (
            <div className="announcement-control-bar">
              <div>
                <strong>
                  {data.settings.enabled
                    ? "Automatic sending enabled"
                    : "Automatic sending paused"}
                </strong>
                <p>
                  {data.worker?.lastError
                    ? `Worker needs attention: ${data.worker.lastError}`
                    : !data.worker?.enabled
                      ? "Cron not enabled yet"
                      : workerRecent
                        ? "Cron is running"
                        : "Cron check overdue"}{" "}
                  · Last completed check:{" "}
                  {dateLabel(data.worker?.lastFinishedAt)}
                </p>
              </div>
              <button
                disabled={
                  busy ||
                  loading ||
                  (!data.settings.enabled && !rules.some((rule) => rule.active))
                }
                onClick={() =>
                  mutate(() =>
                    announcementsApi.setEnabled(
                      retreatId,
                      !data.settings.enabled,
                    ),
                  )
                }
              >
                {data.settings.enabled
                  ? "Pause sending"
                  : "Enable automatic sending"}
              </button>
            </div>
          )}
          <div className="announcement-help">
            Times are in <strong>Europe/Prague</strong>. Recipients: confirmed,
            checked-in and checked-out bookings. Cancelled and pending bookings
            are excluded. Past announcements are not sent when you first apply a
            schedule.
          </div>
          {retreatId && (
            <nav className="announcement-views" aria-label="Announcement views">
              {[
                ["schedule", "Schedule setup"],
                ["upcoming", "Upcoming"],
                ["history", "History"],
                ["attention", `Needs attention (${attention.length})`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
          {(view === "schedule" || !retreatId) && (
            <>
              {retreatId && (
                <div className="announcement-toolbar">
                  <button
                    disabled={busy || loading}
                    onClick={() =>
                      mutate(() => announcementsApi.applyDefaults(retreatId))
                    }
                  >
                    Use default schedule
                  </button>
                  <button
                    disabled={busy || loading}
                    onClick={() =>
                      mutate(() => announcementsApi.generate(retreatId))
                    }
                  >
                    Refresh recipient schedule
                  </button>
                  <Link to="/admin/announcements">
                    Edit default schedule ↗
                  </Link>
                  <p>
                    Copies missing announcements only. Edits here affect this
                    retreat.
                  </p>
                </div>
              )}
              {!rules.length && (
                <div className="announcement-empty">
                  <h2>Your timeline starts here</h2>
                  <p>
                    Add arrival instructions before the retreat, then a
                    thank-you email or group-call invitation afterwards.
                  </p>
                  <button disabled={busy} onClick={() => edit()}>
                    Create first announcement
                  </button>
                </div>
              )}
              <ol className="announcement-timeline">
                {rules.map((rule) => {
                  const template = templates.find(
                    (item) => item._id === templateId(rule),
                  );
                  const deliveries = (data.deliveries || []).filter(
                    (row) => row.ruleId === rule._id,
                  );
                  const next = deliveries.find(
                    (row) => row.status === "scheduled",
                  );
                  return (
                    <li
                      key={rule._id}
                      className={rule.active ? "" : "announcement-paused"}
                    >
                      <div className="announcement-day">
                        <span>
                          {rule.timing === "before_start"
                            ? "BEFORE / ARRIVAL"
                            : "AFTER / DEPARTURE"}
                        </span>
                        <strong>{announcementTiming(rule)}</strong>
                        <small>{rule.sendTime} · Prague time</small>
                      </div>
                      <article>
                        <div className="announcement-card-heading">
                          <h2>{rule.title}</h2>
                          <span className="announcement-badge">
                            {rule.active ? "Active" : "Paused"}
                          </span>
                        </div>
                        {rule.schedulingError && (
                          <p className="announcement-error">
                            {rule.schedulingError}
                          </p>
                        )}
                        <p>
                          Send email:{" "}
                          <strong>
                            {template?.name ||
                              rule.emailTemplateId?.name ||
                              "Template unavailable"}
                          </strong>
                        </p>
                        <p>
                          {rule.useRecipientLanguage
                            ? "Each recipient’s preferred language"
                            : `Selected template language: ${(template?.language || "").toUpperCase()}`}{" "}
                          · {template?.attachmentAssetIds?.length || 0}{" "}
                          attachments
                        </p>
                        {retreatId && (
                          <p>
                            {`Send date: ${dateLabel(rule.scheduledFor || next?.scheduledFor)}`}{" "}
                            ·{" "}
                            {next
                              ? "Recipients scheduled"
                              : "No pending recipients"}{" "}
                            ·{" "}
                            {
                              deliveries.filter((row) => row.status === "sent")
                                .length
                            }{" "}
                            sent ·{" "}
                            {
                              deliveries.filter((row) =>
                                ["failed", "uncertain"].includes(row.status),
                              ).length
                            }{" "}
                            need attention
                          </p>
                        )}
                        <div className="announcement-actions">{retreatId && <button disabled={busy || !testBookingId} onClick={() => sendTest(rule)}>Send test to safety inbox</button>}
                          <button
                            disabled={busy || loading}
                            onClick={() => edit(rule)}
                          >
                            Edit announcement
                          </button>
                          <button
                            disabled={busy || loading}
                            onClick={() =>
                              mutate(() =>
                                announcementsApi.setRuleActive(
                                  retreatId,
                                  rule._id!,
                                  !rule.active,
                                ),
                              )
                            }
                          >
                            {rule.active
                              ? "Pause announcement"
                              : "Resume announcement"}
                          </button>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          {retreatId && view === 'history' && !!data?.testEmails?.length && <section><h2>Test email history</h2>{data.testEmails.map(email => <article className="announcement-delivery" key={email._id}><strong>{email.subject}</strong><p>Test only · {email.to.join(', ')} · {email.status} · {dateLabel(email.sentAt || email.createdAt)}</p>{email.errorMessage && <p className="announcement-error">{email.errorMessage}</p>}</article>)}</section>}
      {retreatId && view !== "schedule" && (
            <div className="announcement-deliveries">
              {!rows.length && (
                <p className="announcement-empty">
                  {view === "attention"
                    ? "No delivery issues recorded."
                    : "No announcements in this view."}
                </p>
              )}
              {rows.map((row) => {
                const rule = rules.find((item) => item._id === row.ruleId);
                return (
                  <article key={row._id} className="announcement-delivery">
                    <div className="announcement-card-heading">
                      <div>
                        <h2>{row.title}</h2>
                        <p>
                          {dateLabel(row.scheduledFor)}
                          {rule && ` · ${announcementTiming(rule)}`}
                        </p>
                      </div>
                      <span className={`announcement-badge ${row.status}`}>
                        {row.status === "scheduled" &&
                        (!data.settings.enabled || !rule?.active)
                          ? "Paused"
                          : statusLabel(row.status)}
                      </span>
                    </div>
                    <p>
                      <strong>
                        {[row.clientId?.firstName, row.clientId?.lastName]
                          .filter(Boolean)
                          .join(" ") || "Client"}
                      </strong>{" "}
                      ·{" "}
                      {row.recipient ||
                        row.clientId?.email ||
                        "No email address"}{" "}
                      ·{" "}
                      {(
                        row.language ||
                        (rule?.useRecipientLanguage
                          ? row.clientId?.language
                          : rule?.emailTemplateId?.language) ||
                        "Template language"
                      ).toUpperCase()}
                    </p>
                    {row.lastError && (
                      <p className="announcement-error">{row.lastError}</p>
                    )}
                    <div className="announcement-actions">
                      {row.status === "scheduled" && (
                        <button
                          disabled={busy}
                          onClick={() => previewDelivery(row)}
                        >
                          Preview for recipient
                        </button>
                      )}
                      {row.status === "failed" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            mutate(() =>
                              announcementsApi.updateDelivery(row._id, "retry"),
                            )
                          }
                        >
                          Retry delivery
                        </button>
                      )}
                      {["scheduled", "failed", "uncertain", "test_sent"].includes(
                        row.status,
                      ) && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            mutate(() =>
                              announcementsApi.updateDelivery(
                                row._id,
                                "cancel",
                              ),
                            )
                          }
                        >
                          Cancel delivery
                        </button>
                      )}
                      {row.status === "uncertain" && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Have you checked the email log and confirmed this email was sent?",
                              )
                            )
                              void mutate(() =>
                                announcementsApi.updateDelivery(
                                  row._id,
                                  "confirm_sent",
                                ),
                              );
                          }}
                        >
                          Confirm already sent
                        </button>
                      )}
                    </div>
                    {["sent", "uncertain"].includes(row.status) && (
                      <button disabled={busy} onClick={() => viewEmailLog(row)}>
                        View email log
                      </button>
                    )}
                    <details>
                      <summary>
                        Delivery log · {row.attemptCount || 0} attempts
                      </summary>
                      {row.sentEmailId && (
                        <p>Email log ID: {row.sentEmailId}</p>
                      )}
                      {row.subject && <p>Subject: {row.subject}</p>}
                      {!!row.attachments?.length && (
                        <p>
                          Attachments:{" "}
                          {row.attachments
                            .map((item) => item.fileName)
                            .join(", ")}
                        </p>
                      )}
                      {(row.history || []).map((entry, index) => (
                        <p key={index}>
                          {dateLabel(entry.at)} · {statusLabel(entry.status)}
                          {entry.message && ` · ${entry.message}`}
                          {entry.actor && ` · ${entry.actor}`}
                        </p>
                      ))}
                    </details>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      <dialog
        ref={dialogRef}
        className="announcement-dialog"
        onCancel={() => setEditor(null)}
        aria-labelledby="announcement-wizard-title"
      >
        {editor && (
          <>
            <div className="announcement-card-heading">
              <h2 id="announcement-wizard-title">
                {editor._id ? "Edit announcement" : "Add announcement"}
              </h2>
              <button
                aria-label="Close wizard"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                ×
              </button>
            </div>
            <ol className="announcement-wizard-steps">
              {["When", "Email", "Review"].map((label, index) => (
                <li
                  key={label}
                  aria-current={index === step ? "step" : undefined}
                >
                  {index + 1}. {label}
                </li>
              ))}
            </ol>
            {error && (
              <p role="alert" className="announcement-error">
                {error}
              </p>
            )}
            <div className="announcement-sentence">
              {announcementTiming(editor)} at {editor.sendTime}, send{" "}
              <strong>{selectedTemplate?.name || "your chosen email"}</strong>.
            </div>
            {step === 0 && (
              <div className="announcement-fields">
                <label>
                  Number of days
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    max="365"
                    step="1"
                    list="announcement-days"
                    value={editor.days}
                    onChange={(event) =>
                      setEditor({ ...editor, days: Number(event.target.value) })
                    }
                  />
                </label>
                <datalist id="announcement-days">
                  {[0, 1, 3, 5, 7, 10, 14, 30, 35, 45].map((day) => (
                    <option key={day} value={day} />
                  ))}
                </datalist>
                <label>
                  Before or after
                  <select
                    value={editor.timing}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        timing: event.target.value as Rule["timing"],
                      })
                    }
                  >
                    <option value="before_start">
                      Before the retreat starts
                    </option>
                    <option value="after_end">After the retreat ends</option>
                  </select>
                </label>
                <label>
                  Send at (Prague time)
                  <input
                    type="time"
                    value={editor.sendTime}
                    onChange={(event) =>
                      setEditor({ ...editor, sendTime: event.target.value })
                    }
                  />
                </label>
                <p>
                  0 days before = arrival day. 0 days after = departure day. Use
                  any number from 0 to 365.
                </p>
              </div>
            )}
            {step === 1 && (
              <div className="announcement-fields">
                <label>
                  Action
                  <select value="email" onChange={() => {}}>
                    <option value="email">Send an email</option>
                  </select>
                </label>
                <label>
                  Email template
                  <select
                    value={templateId(editor)}
                    onChange={(event) => {
                      const selected = templates.find(
                        (item) => item._id === event.target.value,
                      );
                      setEditor({
                        ...editor,
                        emailTemplateId: event.target.value,
                        title: editor.title || selected?.name || "",
                      });
                    }}
                  >
                    <option value="">Choose an email template</option>
                    {templates.map((template) => (
                      <option value={template._id} key={template._id}>
                        {template.name} ({template.language?.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  <Link
                    to="/admin/communications"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Manage email templates and PDF attachments ↗
                  </Link>
                </p>
                <label>
                  Announcement name
                  <input
                    value={editor.title}
                    maxLength={160}
                    onChange={(event) =>
                      setEditor({ ...editor, title: event.target.value })
                    }
                  />
                </label>
                <label className="announcement-checkbox">
                  <input
                    type="checkbox"
                    checked={editor.useRecipientLanguage}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        useRecipientLanguage: event.target.checked,
                      })
                    }
                  />
                  Use each recipient’s preferred language
                </label>
                <p>
                  Uses matching translations of the selected template. Missing
                  translations appear in Needs attention; we never silently
                  switch languages.
                </p>
                {selectedTemplate && (
                  <details open>
                    <summary>
                      Template preview ·{" "}
                      {selectedTemplate.attachmentAssetIds?.length || 0}{" "}
                      attachments
                    </summary>
                    <strong>{selectedTemplate.subject}</strong>
                    <pre>{selectedTemplate.bodyText}</pre>
                    <small>
                      Placeholders are filled for each participant. Manage PDFs
                      and other attachments in the email template.
                    </small>
                  </details>
                )}
              </div>
            )}
            {step === 2 && (
              <div className="announcement-review">
                <h3>{editor.title}</h3>
                <p>
                  {editor.useRecipientLanguage
                    ? "Each recipient receives the matching language version."
                    : `Everyone receives the selected ${selectedTemplate?.language?.toUpperCase()} template.`}
                </p>
                <p>
                  {selectedTemplate?.attachmentAssetIds?.length || 0}{" "}
                  attachments on the selected template. Translations use their
                  own attachments.
                </p>
                <p>
                  {retreatId
                    ? "Applies only to this retreat. Already sent emails remain in history."
                    : "Saved to the default schedule. Apply it separately from each retreat’s Announcements tab."}
                </p>
                <p>
                  Saving does not send an email now. Automatic sending must be
                  enabled for the retreat and the cron worker.
                </p>
              </div>
            )}
            <footer>
              <button
                disabled={busy}
                onClick={() => (step ? setStep(step - 1) : setEditor(null))}
              >
                {step ? "Back" : "Cancel"}
              </button>
              {step < 2 ? (
                <button
                  className="announcement-primary"
                  disabled={
                    step === 0
                      ? !Number.isInteger(editor.days) ||
                        editor.days < 0 ||
                        editor.days > 365 ||
                        !editor.sendTime
                      : !selectedTemplate || !editor.title.trim()
                  }
                  onClick={() => setStep(step + 1)}
                >
                  Continue
                </button>
              ) : (
                <button
                  className="announcement-primary"
                  disabled={busy}
                  onClick={save}
                >
                  {busy ? "Saving…" : "Save announcement"}
                </button>
              )}
            </footer>
          </>
        )}
      </dialog>
      <dialog
        ref={previewRef}
        className="announcement-dialog"
        onCancel={() => setPreview(null)}
        aria-label="Recipient email preview"
      >
        {preview && (
          <>
            <div className="announcement-card-heading">
              <h2>Recipient preview · {preview.language.toUpperCase()}</h2>
              <button onClick={() => setPreview(null)}>Close preview</button>
            </div>
            <h3>{preview.subject}</h3>
            {preview.deliveryStatus && (
              <p>Email provider status: {preview.deliveryStatus}</p>
            )}
            <pre>{preview.bodyText}</pre>
            <p>{preview.attachmentAssetIds.length} attachments</p>
          </>
        )}
      </dialog>
    </section>
  );
};
export default AnnouncementsPage;
