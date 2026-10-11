import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  Progress,
  Space,
  Spin,
  Tag,
  message,
} from "antd";
import { retreatCloseoutApi, RetreatCloseoutStep } from "../services/api";
import { authService } from "../services/authService";
import { useNavigate } from "react-router-dom";

function StepCard({
  step,
  retreatId,
  onSaved,
  openTool,
}: {
  step: RetreatCloseoutStep;
  retreatId: string;
  onSaved: (step: RetreatCloseoutStep) => void;
  openTool: (tool: string) => void;
}) {
  const [draft, setDraft] = useState(step);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dirty = ["notes", "owner", "dueDate", "completed"].some(
    (key) => (draft as any)[key] !== (step as any)[key],
  );
  useEffect(() => {
    setDraft(step);
  }, [step]);
  const change = (patch: Partial<RetreatCloseoutStep>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setSaved(false);
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await retreatCloseoutApi.save(retreatId, draft);
      onSaved({ ...step, ...result.data });
      setSaved(true);
    } catch (e: any) {
      setError(
        e.response?.data?.message ||
          "Unable to save. Your changes are still here; try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  const reload = async () => {
    setSaving(true);
    try {
      const result = await retreatCloseoutApi.get(retreatId);
      const latest = result.data.find((item) => item.key === step.key);
      if (latest) {
        onSaved(latest);
        setError("");
        setSaved(false);
      }
    } catch {
      setError("Unable to reload. Your changes are still here.");
    } finally {
      setSaving(false);
    }
  };
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const overdue = !step.completed && step.dueDate && step.dueDate < localDate;
  return (
    <Card
      data-dirty={dirty ? "true" : "false"}
      title={step.title}
      style={{ marginBottom: 12 }}
      extra={
        step.completed ? (
          <Tag color="green">Done</Tag>
        ) : overdue ? (
          <Tag color="orange">Overdue</Tag>
        ) : undefined
      }
    >
      <p>{step.prompt}</p>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Checkbox
          checked={draft.completed}
          disabled={saving}
          onChange={(e) => change({ completed: e.target.checked })}
        >
          Completed
        </Checkbox>
        <label style={{ display: "block" }}>
          Owner
          <Input
            value={draft.owner}
            maxLength={200}
            disabled={saving}
            placeholder="Who will do this?"
            onChange={(e) => change({ owner: e.target.value })}
          />
        </label>
        <label style={{ display: "block" }}>
          Due date
          <Input
            type="date"
            value={draft.dueDate}
            disabled={saving}
            onChange={(e) => change({ dueDate: e.target.value })}
          />
        </label>
        {step.suggestedDate && (
          <span>
            Suggested target: {step.suggestedDate}{" "}
            <Button
              size="small"
              disabled={saving}
              onClick={() => change({ dueDate: step.suggestedDate! })}
            >
              Use target
            </Button>
          </span>
        )}
        <label style={{ display: "block" }}>
          Notes and completion evidence
          <Input.TextArea
            value={draft.notes}
            maxLength={10000}
            autoSize={{ minRows: 2, maxRows: 12 }}
            disabled={saving}
            placeholder="One small next action, details or evidence…"
            onChange={(e) => change({ notes: e.target.value })}
          />
        </label>
        {error && (
          <Alert
            type="error"
            message={error}
            action={
              <Button onClick={reload} loading={saving}>
                Discard draft and reload
              </Button>
            }
          />
        )}
        <Space wrap>
          <Button
            type="primary"
            disabled={!dirty}
            loading={saving}
            onClick={save}
          >
            Save step
          </Button>
          {dirty && <span role="status">Unsaved changes</span>}
          {saved && !dirty && <span role="status">Saved</span>}
          {step.tool &&
            (step.tool !== "referrals" ||
              authService.getUser()?.role === "admin") && (
              <Button
                disabled={dirty || saving}
                onClick={() => openTool(step.tool!)}
              >
                Open {step.tool === "foodMatrix" ? "food matrix" : step.tool}
              </Button>
            )}
        </Space>
        {step.completedAt && step.completed && (
          <small>Completed {new Date(step.completedAt).toLocaleString()}</small>
        )}
      </Space>
    </Card>
  );
}
export default function RetreatCloseout({
  retreatId,
  onOpenTab,
}: {
  retreatId: string;
  onOpenTab: (tab: string) => void;
}) {
  const [steps, setSteps] = useState<RetreatCloseoutStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    retreatCloseoutApi
      .get(retreatId)
      .then((result) => {
        if (active) setSteps(result.data);
      })
      .catch(() => {
        if (active)
          setError(
            "Unable to load the closeout checklist. Reopen this tab to try again.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retreatId]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (document.querySelector('[data-closeout] [data-dirty="true"]')) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  if (loading) return <Spin tip="Loading retreat closeout…" />;
  if (error) return <Alert type="error" message={error} />;
  const done = steps.filter((step) => step.completed).length;
  const visible = focus
    ? steps.filter((step) => !step.completed).slice(0, 1)
    : steps;
  const openTool = (tool: string) => {
    if (document.querySelector('[data-closeout] [data-dirty="true"]')) {
      message.warning("Save your changed steps before opening another tool.");
      return;
    }
    if (tool === "communications")
      navigate(`/admin/communications?tab=compose&retreatId=${retreatId}`);
    else if (tool === "referrals") navigate("/admin/referrals");
    else onOpenTab(tool);
  };
  return (
    <div
      data-closeout
      style={{ maxWidth: 900, margin: "24px auto", padding: "0 12px" }}
    >
      <h2>Post-retreat closeout</h2>
      <p>
        One step at a time. Save each step before leaving. Mark done when the
        real action is complete.
      </p>
      <Alert
        type="info"
        message="This checklist records your work. Emails, appointments and payments are performed in their existing tools."
        style={{ marginBottom: 16 }}
      />
      <Progress
        percent={steps.length ? Math.round((done / steps.length) * 100) : 0}
      />
      <Space style={{ marginBottom: 20 }}>
        <span>
          {done} of {steps.length} steps complete
        </span>
        <Checkbox
          checked={focus}
          onChange={(e) => {
            if (document.querySelector('[data-closeout] [data-dirty="true"]')) {
              message.warning(
                "Save your changed steps before changing the view.",
              );
              return;
            }
            setFocus(e.target.checked);
          }}
        >
          Show only the next step
        </Checkbox>
      </Space>
      {!visible.length && (
        <Alert type="success" message="All closeout steps are complete." />
      )}
      {Array.from(new Set(visible.map((step) => step.section))).map(
        (section) => (
          <section key={section} aria-label={section}>
            <h3>{section}</h3>
            {visible
              .filter((step) => step.section === section)
              .map((step) => (
                <StepCard
                  key={`${retreatId}-${step.key}`}
                  step={step}
                  retreatId={retreatId}
                  openTool={openTool}
                  onSaved={(saved) =>
                    setSteps((previous) =>
                      previous.map((item) =>
                        item.key === saved.key ? saved : item,
                      ),
                    )
                  }
                />
              ))}
          </section>
        ),
      )}
    </div>
  );
}
