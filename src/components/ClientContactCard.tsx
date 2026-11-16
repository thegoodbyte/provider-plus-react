import React, { useEffect, useState } from "react";
import { Modal } from "antd";
import { clientsApi } from "../services/api";
const formats = [
  ["compact", "Compact"],
  ["complete", "Complete"],
  ["name-first", "Name first"],
  ["brackets", "With brackets"],
];
export default function ClientContactCard({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false),
    [format, setFormat] = useState("compact"),
    [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [url, setUrl] = useState("");
  const card =
    loaded?.clientId === clientId && loaded?.format === format
      ? loaded.card
      : null;
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoaded(null);
    setBusy(true);
    setError("");
    clientsApi
      .contactCard(clientId, format)
      .then(({ data }) => {
        if (
          !data ||
          typeof data.vcard !== "string" ||
          !data.vcard.startsWith("BEGIN:VCARD\r\n") ||
          !data.vcard.endsWith("END:VCARD\r\n") ||
          !data.displayName ||
          !/^ISCZ-\d+\.vcf$/.test(data.filename)
        )
          throw Error("Invalid contact card");
        if (active) setLoaded({ clientId, format, card: data });
      })
      .catch(() => {
        if (active)
          setError("Could not prepare the contact card. Please retry.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [open, clientId, format, revision]);
  useEffect(() => {
    setUrl("");
    if (!open || !card) return;
    const next = URL.createObjectURL(
      new Blob([card.vcard], { type: "text/vcard;charset=utf-8" }),
    );
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [open, card]);
  return (
    <>
      <button
        type="button"
        className="my-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
        onClick={() => {
          setFormat("compact");
          setLoaded(null);
          setOpen(true);
        }}
      >
        Contact card (.vcf)
      </button>
      <Modal
        open={open}
        title="Client contact card"
        onCancel={() => setOpen(false)}
        footer={null}
        width={640}
        styles={{ body: { maxHeight: "75dvh", overflowY: "auto" } }}
      >
        <p className="mb-4 text-sm text-slate-600">
          Open the downloaded VCF on the phone and add it to Contacts. The ISCZ
          label is saved as the contact name; the original name and
          first-contact date stay in Notes.
        </p>
        <label className="block text-sm font-semibold">
          Contact name format
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            {formats.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {busy && (
          <p role="status" className="my-4">
            Preparing contact card…
          </p>
        )}
        {error && (
          <div role="alert" className="my-4 text-red-800">
            {error}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => setRevision((v) => v + 1)}
            >
              Retry contact card
            </button>
          </div>
        )}
        {card && (
          <section aria-label="Contact card preview" className="my-4 space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold text-emerald-900">
                CONTACT NAME ON PHONE
              </p>
              <p className="mt-2 break-words font-semibold text-slate-900">
                {card.displayName}
              </p>
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="break-words">
                <dt className="inline font-semibold">Phone: </dt>
                <dd className="inline">{card.phone || "Not provided"}</dd>
              </div>
              <div className="break-words">
                <dt className="inline font-semibold">Email: </dt>
                <dd className="inline">{card.email || "Not provided"}</dd>
              </div>
            </dl>
            {(card.warnings || []).map((warning: string) => (
              <p className="text-sm text-amber-900" key={warning}>
                {warning}
              </p>
            ))}
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                Contact notes
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-sans text-sm">
                {card.notes}
              </pre>
            </details>
          </section>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border px-3 py-2"
            onClick={() => setOpen(false)}
          >
            Close contact card
          </button>
          {card && url && !busy && !error && (
            <a
              className="rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white"
              href={url}
              download={card.filename}
            >
              Download vCard
            </a>
          )}
        </div>
      </Modal>
    </>
  );
}
