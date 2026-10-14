import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import React, { useEffect, useState } from "react";
import {
  BookingOption,
  Enrollment,
  EnrollmentInput,
  integrationProgramsApi as service,
  Program,
  ProgramConfig,
  ProgramPreview,
} from "../services/integrationProgramsApi";
import "./IntegrationPrograms.css";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const clientName = (e: Enrollment) =>
  [
    e.clientId?.firstName || e.clientId?.fname,
    e.clientId?.lastName || e.clientId?.lname,
  ]
    .filter(Boolean)
    .join(" ") || "Client";
const message = (e: any) => apiErrorMessage(e, 'Could not save the integration program.');

export function ProgramFields({
  value: c,
  onChange,
  enrollment = false,
}: {
  value: ProgramConfig;
  onChange: (c: ProgramConfig) => void;
  enrollment?: boolean;
}) {
  const field = (key: keyof ProgramConfig, value: any) =>
    onChange({
      ...c,
      [key]: value,
      ...(["owner", "backup", "groupCalls", "personal", "emails"].includes(key)
        ? { review: { ...c.review, capacityReviewed: false } }
        : {}),
    });
  return (
    <div className="program-fields">
      <div className="program-grid">
        {(["timezone", "owner", "backup", "bookingUrl"] as const).map((key) => (
          <label key={key}>
            {
              {
                timezone: "Timezone",
                owner: "Care owner",
                backup: "Backup person",
                bookingUrl: "Calendly availability link",
              }[key]
            }
            <input
              value={c[key]}
              onChange={(e) => field(key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <h4>Group calls · days after homecoming</h4>
      <p>
        Targets and flexible windows are proposals. Confirmed appointments have
        their own dates.
      </p>
      <div className="program-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Target day</th>
              <th>Earliest day</th>
              <th>Latest day</th>
              <th>Minutes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {c.groupCalls.map((call, index) => (
              <tr key={call.key}>
                {(
                  [
                    "title",
                    "targetDay",
                    "earliestDay",
                    "latestDay",
                    "durationMinutes",
                  ] as const
                ).map((key) => (
                  <td key={key}>
                    <input
                      aria-label={`${call.title} ${key}`}
                      type={key === "title" ? "text" : "number"}
                      min="0"
                      value={call[key]}
                      onChange={(e) =>
                        field(
                          "groupCalls",
                          c.groupCalls.map((row, i) =>
                            i === index
                              ? {
                                  ...row,
                                  [key]:
                                    key === "title"
                                      ? e.target.value
                                      : Number(e.target.value),
                                }
                              : row,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    aria-label={`Remove ${call.title}`}
                    onClick={() =>
                      field(
                        "groupCalls",
                        c.groupCalls.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={c.groupCalls.length >= 20}
        onClick={() =>
          field("groupCalls", [
            ...c.groupCalls,
            {
              key: `group-${Date.now()}`,
              title: `Group call ${c.groupCalls.length + 1}`,
              targetDay: 84,
              earliestDay: 77,
              latestDay: 91,
              durationMinutes: 75,
            },
          ])
        }
      >
        Add group call
      </button>
      <h4>Personal sessions</h4>
      <div className="program-grid">
        {(["count", "durationMinutes", "accessDays"] as const).map((key) => (
          <label key={key}>
            {
              {
                count: "Number of sessions",
                durationMinutes: "Session minutes",
                accessDays: "Booking access days",
              }[key]
            }
            <input
              type="number"
              min={key === "count" ? 0 : 1}
              value={c.personal[key]}
              onChange={(e) =>
                field("personal", {
                  ...c.personal,
                  [key]: Number(e.target.value),
                })
              }
            />
          </label>
        ))}
        {(["cancellationPolicy", "noShowPolicy"] as const).map((key) => (
          <label key={key}>
            {key === "cancellationPolicy"
              ? "Cancellation credit"
              : "No-show credit"}
            <select
              value={c.personal[key]}
              onChange={(e) =>
                field("personal", { ...c.personal, [key]: e.target.value })
              }
            >
              <option value="restore">Return credit</option>
              <option value="consume">Use credit</option>
            </select>
          </label>
        ))}
      </div>
      <div className="program-grid">
        <label>
          Access extension policy
          <select
            value={c.personal.extensionPolicy}
            onChange={(e) =>
              field("personal", {
                ...c.personal,
                extensionPolicy: e.target.value,
              })
            }
          >
            <option value="staff_approval">Staff approval required</option>
            <option value="disabled">No extensions</option>
          </select>
        </label>
        <label>
          Maximum additional days
          <input
            type="number"
            min="0"
            value={c.personal.maximumExtensionDays}
            onChange={(e) =>
              field("personal", {
                ...c.personal,
                maximumExtensionDays: Number(e.target.value),
              })
            }
          />
        </label>
      </div>
      <h4>Support email cadence</h4>
      <p>
        These are planned touchpoints; message writing and delivery are separate
        features.
      </p>
      {c.emails.map((email, i) => (
        <div className="program-email" key={email.key}>
          <label>
            Email title
            <input
              value={email.title}
              onChange={(e) =>
                field(
                  "emails",
                  c.emails.map((row, index) =>
                    index === i ? { ...row, title: e.target.value } : row,
                  ),
                )
              }
            />
          </label>
          <label>
            Day after homecoming
            <input
              type="number"
              min="0"
              value={email.day}
              onChange={(e) =>
                field(
                  "emails",
                  c.emails.map((row, index) =>
                    index === i ? { ...row, day: Number(e.target.value) } : row,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            onClick={() =>
              field(
                "emails",
                c.emails.filter((_, index) => index !== i),
              )
            }
          >
            Remove email
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={c.emails.length >= 100}
        onClick={() =>
          field("emails", [
            ...c.emails,
            { key: `email-${Date.now()}`, title: "Support check-in", day: 7 },
          ])
        }
      >
        Add support email
      </button>
      <h4>Contact preferences</h4>
      <div className="program-grid">
        <label>
          Maximum contacts per day
          <input
            type="number"
            min="1"
            max="10"
            value={c.dailyContactCap}
            onChange={(e) => field("dailyContactCap", Number(e.target.value))}
          />
        </label>
        <label>
          Quiet hours start
          <input
            type="time"
            value={c.quietStart}
            onChange={(e) => field("quietStart", e.target.value)}
          />
        </label>
        <label>
          Quiet hours end
          <input
            type="time"
            value={c.quietEnd}
            onChange={(e) => field("quietEnd", e.target.value)}
          />
        </label>
      </div>
      <div className="program-actions">
        {["email", "app", "whatsapp"].map((channel) => (
          <label key={channel}>
            <input
              type="checkbox"
              checked={c.channels.includes(channel)}
              onChange={(e) =>
                field(
                  "channels",
                  e.target.checked
                    ? [...c.channels, channel]
                    : c.channels.filter((v) => v !== channel),
                )
              }
            />{" "}
            {channel === "app"
              ? "Client app"
              : channel === "email"
                ? "Email"
                : "WhatsApp"}
          </label>
        ))}
      </div>
      <h4>Publication review</h4>
      <label>
        Reviewed curriculum reference
        <input
          readOnly={enrollment}
          value={c.review.contentReference}
          placeholder="Document or approved curriculum version"
          onChange={(e) =>
            field("review", {
              ...c.review,
              contentReference: e.target.value,
              contentReviewed: false,
            })
          }
        />
      </label>
      <label className="program-check">
        <input
          type="checkbox"
          disabled={enrollment}
          checked={c.review.contentReviewed}
          onChange={(e) =>
            field("review", { ...c.review, contentReviewed: e.target.checked })
          }
        />{" "}
        Curriculum reviewed and approved
      </label>
      <label className="program-check">
        <input
          type="checkbox"
          checked={c.review.capacityReviewed}
          onChange={(e) =>
            field("review", { ...c.review, capacityReviewed: e.target.checked })
          }
        />{" "}
        Owner and backup can deliver this plan
      </label>
    </div>
  );
}

export default function IntegrationPrograms() {
  const { toast, showError, dismiss } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [defaults, setDefaults] = useState<
    { _id: string; programId: string }[]
  >([]);
  const [starter, setStarter] = useState<ProgramConfig>();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [tab, setTab] = useState("programs");
  const [selected, setSelected] = useState<Program>();
  const [name, setName] = useState("");
  const [config, setConfig] = useState<ProgramConfig>();
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<Enrollment>();
  const [input, setInput] = useState<EnrollmentInput>();
  const [preview, setPreview] = useState<ProgramPreview>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const refresh = async () => {
    const [p, e] = await Promise.all([service.list(), service.enrollments()]);
    setPrograms(p.data.programs);
    setDefaults(p.data.defaults);
    setStarter(p.data.starter);
    setEnrollments(e.data.enrollments);
    setBookings(e.data.bookings);
  };
  useEffect(() => {
    refresh().catch((e) => setError(message(e)));
  }, []);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (e) {
      showError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const select = (p?: Program) => {
    setSelected(p);
    setName(p?.name || "Post-retreat integration");
    setConfig(clone(p?.draft || starter!));
    setDirty(!p);
    setNotice("");
  };
  const updateInput = (next: EnrollmentInput) => {
    setInput(next);
    setPreview(undefined);
  };
  const changeProgram = (id: string, version?: number) => {
    const p = programs.find((p) => p._id === id);
    const v =
      p?.versions.find((v) => v.number === version) || p?.versions.at(-1);
    if (input && v)
      updateInput({
        ...input,
        programId: id,
        programVersion: v.number,
        config: clone(v.config),
      });
  };
  const eligible = programs.filter((p) => !p.archived && p.versions.length);
  const affected = selected
    ? enrollments.filter((e) => e.programId === selected._id)
    : [];
  const newEnrollment = () => {
    setEditing(undefined);
    setPreview(undefined);
    const p = eligible[0];
    const v = p?.versions.at(-1);
    setInput(
      v
        ? {
            bookingId: "",
            programId: p._id,
            programVersion: v.number,
            homecomingDate: "",
            status: "active",
            config: clone(v.config),
          }
        : undefined,
    );
    if (!v) setError("Publish a reviewed program before enrolling a client.");
  };
  return (
    <section className="integration-programs" aria-label="Integration programs">
      <Toast toast={toast} onDismiss={dismiss} />
      <h3>Programs & enrollments</h3>
      <p>
        Build a reviewed plan, publish a version, then enroll clients with a
        preview.
      </p>
      <div className="program-actions">
        <button
          type="button"
          aria-pressed={tab === "programs"}
          onClick={() => setTab("programs")}
        >
          Program templates
        </button>
        <button
          type="button"
          aria-pressed={tab === "enrollments"}
          onClick={() => setTab("enrollments")}
        >
          Client enrollments
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await refresh();
              setSelected(undefined);
              setConfig(undefined);
              setInput(undefined);
              setPreview(undefined);
              setNotice("Reloaded current records.");
            })
          }
        >
          Reload records
        </button>
      </div>
      {error && (
        <p role="alert" className="program-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <fieldset disabled={busy}>
        {tab === "programs" ? (
          <>
            <div className="program-actions">
              <select
                aria-label="Choose program"
                value={selected?._id || ""}
                onChange={(e) =>
                  e.target.value
                    ? select(programs.find((p) => p._id === e.target.value))
                    : (setSelected(undefined), setConfig(undefined))
                }
              >
                <option value="">Choose a program</option>
                {programs.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                    {p.archived ? " · archived" : ""} · {p.versions.length}{" "}
                    published versions
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!starter}
                onClick={() => select()}
              >
                Create program
              </button>
            </div>
            <div className="program-grid">
              {["regular", "booster"].map((type) => (
                <label key={type}>
                  Default for {type} retreats
                  <select
                    value={
                      defaults.find((d) => d._id === type)?.programId || ""
                    }
                    onChange={(e) => {
                      const id = e.target.value;
                      run(async () => {
                        await service.setDefault(type, id);
                        await refresh();
                        setNotice(
                          "Default updated. Existing enrollments keep their versions.",
                        );
                      });
                    }}
                  >
                    <option value="">No default</option>
                    {programs
                      .filter((p) => p.versions.length)
                      .map((p) => (
                        <option key={p._id} value={p._id} disabled={p.archived}>
                          {p.name}
                          {p.archived ? " · archived (inactive)" : ""}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            {config && (
              <>
                <fieldset disabled={selected?.archived}>
                  <label>
                    Program name
                    <input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                  <ProgramFields
                    value={config}
                    onChange={(c) => {
                      setConfig(c);
                      setDirty(true);
                    }}
                  />
                  <div className="program-actions">
                    <button
                      type="button"
                      onClick={() =>
                        run(async () => {
                          const p = (
                            await service.save(selected?._id, {
                              name,
                              config,
                              expectedRevision: selected?.revision,
                            })
                          ).data;
                          await refresh();
                          select(p);
                          setNotice(
                            "Draft saved. Enrolled clients retain their published plans.",
                          );
                        })
                      }
                    >
                      Save draft
                    </button>
                    <button
                      type="button"
                      disabled={!selected || dirty}
                      onClick={() =>
                        run(async () => {
                          const p = (await service.publish(selected!)).data;
                          await refresh();
                          select(p);
                          setNotice(
                            `Version ${p.versions.at(-1)?.number} published. Existing clients require an explicit enrollment change.`,
                          );
                        })
                      }
                    >
                      Publish saved draft
                    </button>
                  </div>
                </fieldset>
                {selected && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        run(async () => {
                          const p = (await service.archive(selected)).data;
                          await refresh();
                          select(p);
                          setNotice(
                            p.archived
                              ? "Archived. Existing client plans are preserved."
                              : "Program restored.",
                          );
                        })
                      }
                    >
                      {selected.archived
                        ? "Restore program"
                        : "Archive program"}
                    </button>
                    <h4>Published versions</h4>
                    {selected.versions.map((v) => (
                      <details key={v.number}>
                        <summary>
                          Version {v.number} · {v.name} ·{" "}
                          {new Date(v.publishedAt).toLocaleDateString()}
                        </summary>
                        <p>
                          {v.config.groupCalls.length} group calls;{" "}
                          {v.config.personal.count} ×{" "}
                          {v.config.personal.durationMinutes} minute personal
                          sessions over {v.config.personal.accessDays} days.
                          Owner: {v.config.owner}. Curriculum:{" "}
                          {v.config.review.contentReference}.
                        </p>
                        <ul>
                          {v.config.groupCalls.map((c) => (
                            <li key={c.key}>
                              {c.title}: day {c.targetDay}, window{" "}
                              {c.earliestDay}–{c.latestDay}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ))}
                    <h4>Enrollment impact · {affected.length} clients</h4>
                    <p>
                      Publishing or archiving changes none of these plans
                      automatically. Open Client enrollments to preview an
                      individual version change.
                    </p>
                    <ul>
                      {affected.map((e) => (
                        <li key={e._id}>
                          {clientName(e)} · version {e.programVersion} ·{" "}
                          {e.status} · homecoming {e.homecomingDate}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={newEnrollment}>
              Enroll client
            </button>
            <div className="program-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Program version</th>
                    <th>Homecoming</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e._id}>
                      <td>{clientName(e)}</td>
                      <td>
                        {programs.find((p) => p._id === e.programId)?.name ||
                          "Program"}{" "}
                        · v{e.programVersion}
                      </td>
                      <td>{e.homecomingDate}</td>
                      <td>{e.snapshot.owner}</td>
                      <td>{e.status}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(e);
                            setPreview(undefined);
                            setInput({
                              bookingId: e.bookingId,
                              expectedRevision: e.revision,
                              programId: e.programId,
                              programVersion: e.programVersion,
                              homecomingDate: e.homecomingDate,
                              status: e.status,
                              config: clone(e.snapshot),
                            });
                          }}
                        >
                          Edit enrollment
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {input && (
              <div className="program-enrollment">
                <h4>
                  {editing
                    ? `Edit ${clientName(editing)}`
                    : "New client enrollment"}
                </h4>
                <div className="program-grid">
                  <label>
                    Client and retreat
                    <select
                      disabled={!!editing}
                      value={input.bookingId || ""}
                      onChange={(e) => {
                        const b = bookings.find((b) => b.id === e.target.value);
                        const p = programs.find(
                          (p) => p._id === b?.defaultProgramId && !p.archived,
                        );
                        const v = p?.versions.at(-1);
                        updateInput({
                          ...input,
                          bookingId: e.target.value,
                          homecomingDate: b?.suggestedHomecomingDate || "",
                          ...(v && p
                            ? {
                                programId: p._id,
                                programVersion: v.number,
                                config: clone(v.config),
                              }
                            : {}),
                        });
                      }}
                    >
                      <option value="">Choose client</option>
                      {bookings
                        .filter(
                          (b) =>
                            !!editing ||
                            !enrollments.some((e) => e.bookingId === b.id),
                        )
                        .map((b) => (
                          <option value={b.id} key={b.id}>
                            {b.name} · {b.retreatName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Published program
                    <select
                      value={input.programId}
                      onChange={(e) => changeProgram(e.target.value)}
                    >
                      {programs
                        .filter(
                          (p) =>
                            p.versions.length &&
                            (!p.archived || p._id === editing?.programId),
                        )
                        .map((p) => (
                          <option
                            value={p._id}
                            key={p._id}
                            disabled={p.archived && p._id !== input.programId}
                          >
                            {p.name}
                            {p.archived ? " · archived" : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Version
                    <select
                      value={input.programVersion}
                      onChange={(e) =>
                        changeProgram(input.programId, Number(e.target.value))
                      }
                    >
                      {programs
                        .find((p) => p._id === input.programId)
                        ?.versions.map((v) => (
                          <option key={v.number} value={v.number}>
                            Version {v.number}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Homecoming date
                    <input
                      type="date"
                      value={input.homecomingDate}
                      onChange={(e) =>
                        updateInput({
                          ...input,
                          homecomingDate: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Enrollment status
                    <select
                      value={input.status}
                      onChange={(e) =>
                        updateInput({ ...input, status: e.target.value })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                </div>
                <details>
                  <summary>Customize this client's plan</summary>
                  <ProgramFields
                    enrollment
                    value={input.config}
                    onChange={(config) => updateInput({ ...input, config })}
                  />
                </details>
                <div className="program-actions">
                  <button
                    type="button"
                    onClick={() =>
                      run(async () => {
                        setPreview(undefined);
                        setPreview(
                          (await service.preview(editing?._id, input)).data,
                        );
                      })
                    }
                  >
                    Preview plan
                  </button>
                  <button
                    type="button"
                    disabled={!preview}
                    onClick={() =>
                      run(async () => {
                        await service.enroll(editing?._id, {
                          ...input,
                          previewHash: preview?.previewHash,
                        });
                        await refresh();
                        setInput(undefined);
                        setPreview(undefined);
                        setEditing(undefined);
                        setNotice(
                          "Enrollment saved. No messages or invitations were sent.",
                        );
                      })
                    }
                  >
                    Apply previewed plan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInput(undefined);
                      setPreview(undefined);
                    }}
                  >
                    Cancel edit
                  </button>
                </div>
                {preview && (
                  <div role="region" aria-label="Enrollment preview">
                    <h4>Review the proposed dates</h4>
                    {preview.warnings.map((w) => (
                      <p key={w}>{w}</p>
                    ))}
                    <div className="program-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Call</th>
                            <th>Previous target</th>
                            <th>New target</th>
                            <th>Flexible window</th>
                            <th>Planning</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.schedule.groupCalls.map((c) => (
                            <tr key={c.key}>
                              <td>{c.title}</td>
                              <td>
                                {preview.beforeSchedule?.groupCalls.find(
                                  (old) => old.key === c.key,
                                )?.targetDate || "—"}
                              </td>
                              <td>{c.targetDate}</td>
                              <td>
                                {c.earliestDate} – {c.latestDate}
                              </td>
                              <td>
                                {c.pastWindow
                                  ? "Past window · review manually"
                                  : c.planningState}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      Personal session access ends{" "}
                      {preview.schedule.personalExpiresOn}.
                    </p>
                    <ul>
                      {preview.schedule.emails.map((e) => (
                        <li key={e.key}>
                          {e.title} · {e.date} ·{" "}
                          {e.state === "skip_past"
                            ? "Skipped (past date)"
                            : e.state}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </fieldset>
    </section>
  );
}
