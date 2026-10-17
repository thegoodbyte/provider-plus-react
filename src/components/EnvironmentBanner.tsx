import React, { useEffect, useState } from "react";
import { Alert, Button, List, Modal, Space, Spin, Tag } from "antd";
import { environmentApi } from "../services/api";
import { authService } from "../services/authService";
export function captureLinks(text: string): string[] {
  return Array.from(new Set(text.match(/https?:\/\/[^\s<>"']+/gi) || []))
    .map((url) => url.replace(/&amp;/g, "&"))
    .filter((value) => {
      try {
        const url = new URL(value);
        return (
          !url.username &&
          !url.password &&
          ([
            "localhost",
            "127.0.0.1",
            "[::1]",
            "sandbox-checkout.revolut.com",
            "www.sandbox.paypal.com",
          ].includes(url.hostname) ||
            /(^|[.\-])(dev|development|test|stage|staging|sandbox|mock)([.\-]|$)/.test(
              url.hostname,
            ))
        );
      } catch {
        return false;
      }
    });
}
export default function EnvironmentBanner() {
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  useEffect(() => {
    let active = true;
    environmentApi
      .status()
      .then((response) => {
        const data = response.data;
        // A malformed response (missing `production`/`environment`) must not
        // crash the banner -- it sits in the persistent app shell, outside
        // any route boundary.
        const wellFormed = data && typeof data === "object" && !Array.isArray(data)
          && (data.production === true || typeof data.environment === "string");
        if (active) setStatus(wellFormed ? data : null);
      })
      .catch(() => {
        if (active) setError("Environment status unavailable.");
      });
    return () => {
      active = false;
    };
  }, []);
  const load = async () => {
    setOpen(true);
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      setItems((await environmentApi.capture()).data);
    } catch {
      setError("Unable to load the capture inbox.");
    } finally {
      setLoading(false);
    }
  };
  const select = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      setSelected((await environmentApi.capturedMessage(id)).data);
    } catch {
      setError("Unable to load this captured message.");
    } finally {
      setLoading(false);
    }
  };
  if (!status) return error ? <Alert type="warning" message={error} /> : null;
  if (status.production)
    return (
      <div style={{ padding: "4px 24px" }}>
        <Tag>Production</Tag>
      </div>
    );
  return (
    <>
      <Alert
        type="warning"
        style={{ margin: "12px 24px" }}
        message={
          <Space wrap>
            <strong>
              {status.environment.toUpperCase()} · Test environment
            </strong>
            <span>
              Emails captured · Payments sandbox only · Jobs:{" "}
              {status.enabledJobs.join(", ") || "disabled"}
            </span>
            {authService.getUser()?.role === "admin" && (
              <Button size="small" onClick={load}>
                Capture inbox
              </Button>
            )}
          </Space>
        }
      />
      <Modal
        title="Development capture inbox"
        open={open}
        onCancel={() => setOpen(false)}
        footer={<Button onClick={load}>Refresh inbox</Button>}
        width={850}
      >
        {error && <Alert type="error" message={error} />}
        <Spin spinning={loading}>
          {selected ? (
            <div>
              <Button onClick={() => setSelected(null)}>Back to inbox</Button>
              <h3>{selected.subject}</h3>
              <p>Captured: {new Date(selected.capturedAt).toLocaleString()}</p>
              <p>
                Intended recipients (no delivery):{" "}
                {[
                  ...selected.intendedRecipients.to,
                  ...selected.intendedRecipients.cc,
                  ...selected.intendedRecipients.bcc,
                ].join(", ")}
              </p>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {selected.bodyText}
              </pre>
              <p>Test links:</p>
              <ul>
                {captureLinks(selected.bodyText + "\n" + selected.bodyHtml).map(
                  (link) => (
                    <li key={link}>
                      <a href={link} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    </li>
                  ),
                )}
              </ul>
              {selected.attachments?.map((attachment: any, index: number) => (
                <p key={index}>
                  <Button
                    onClick={() => {
                      const decoded = atob(attachment.contentBase64);
                      const bytes = Uint8Array.from(decoded, (character) =>
                        character.charCodeAt(0),
                      );
                      const url = URL.createObjectURL(
                        new Blob([bytes], {
                          type:
                            attachment.mimeType || "application/octet-stream",
                        }),
                      );
                      const anchor = document.createElement("a");
                      anchor.href = url;
                      anchor.download = attachment.fileName || "attachment";
                      anchor.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download {attachment.fileName}
                  </Button>
                </p>
              ))}
            </div>
          ) : (
            <List
              locale={{
                emptyText:
                  "No captured messages yet. Send an email through the normal development workflow.",
              }}
              dataSource={items}
              renderItem={(item: any) => (
                <List.Item>
                  <Button type="link" onClick={() => select(item.id)}>
                    {item.subject}
                  </Button>
                  <span>
                    {new Date(item.capturedAt).toLocaleString()} ·{" "}
                    {item.attachmentCount} attachments
                  </span>
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Modal>
    </>
  );
}
