import React, { useEffect, useRef, useState } from "react";
import { Modal } from "antd";
import { medicalArtifactsApi } from "../services/api";
import { MedicalArtifact } from "../types";
import "./MedicalArtifactDocumentViewer.css";
type ArtifactFile = NonNullable<MedicalArtifact["files"]>[number];
export const artifactFilePath = (file: ArtifactFile) =>
  file.s3Key || file.filePath || "";
export const artifactFileName = (file: ArtifactFile) =>
  file.fileName ||
  artifactFilePath(file).split("/").pop() ||
  "Medical document";
export const artifactFileLabel = (file: ArtifactFile) =>
  `${file.variant === "english_translation" ? "English" : "Original"} · ${artifactFileName(file)}`;
const safeImages = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/tiff",
]);
/** Force binary fallback files into a safe renderer; never frame an HTML response as a medical PDF. */
export function medicalPreviewBlob(
  blob: Blob,
  file: ArtifactFile,
  header?: string,
) {
  if (!(blob instanceof Blob) || !blob.size)
    throw Error("The document is empty or unavailable.");
  let type = String(blob.type || header || "")
    .split(";")[0]
    .toLowerCase();
  if (!type || type === "application/octet-stream") {
    type = file.mimeType?.split(";")[0].toLowerCase() || "";
    if (!type && /\.pdf$/i.test(artifactFileName(file)))
      type = "application/pdf";
  }
  if (type !== "application/pdf" && !safeImages.has(type))
    throw Error("This file type cannot be displayed safely in the viewer.");
  return { blob: blob.type === type ? blob : new Blob([blob], { type }), type };
}
export default function MedicalArtifactDocumentViewer({
  artifactId,
  files,
  initialPath,
  identity,
  onClose,
}: {
  artifactId: string;
  files: ArtifactFile[];
  initialPath: string;
  identity: string;
  onClose: () => void;
}) {
  const [selectedPath, setSelectedPath] = useState(initialPath),
    [retry, setRetry] = useState(0);
  const [resource, setResource] = useState<{
    key: string;
    url: string;
    type: string;
  } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null,
  );
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(
    () => () => {
      if (opener.current?.isConnected) opener.current.focus();
    },
    [],
  );
  const file = files.find((f) => artifactFilePath(f) === selectedPath);
  const key = JSON.stringify([
    artifactId,
    selectedPath,
    file?.uploadedAt,
    file?.fileName,
    file?.mimeType,
    file?.variant,
    retry,
  ]);
  const current = file && resource?.key === key ? resource : null;
  const currentError = error?.key === key ? error.message : "";
  useEffect(() => {
    let active = true,
      url = "";
    setResource(null);
    setError(null);
    if (!file) {
      setError({
        key,
        message:
          "The selected document is no longer available. Select another version or close the viewer.",
      });
      return;
    }
    void medicalArtifactsApi
      .getFileBlob(artifactId, selectedPath)
      .then((response) => {
        if (!active) return;
        const safe = medicalPreviewBlob(
          response.data,
          file,
          String(response.headers?.["content-type"] || ""),
        );
        url = URL.createObjectURL(safe.blob);
        setResource({ key, url, type: safe.type });
      })
      .catch((e: any) => {
        if (active)
          setError({
            key,
            message:
              e?.response?.status === 403 || e?.response?.status === 401
                ? "You do not have permission to read this document."
                : e.message ===
                    "This file type cannot be displayed safely in the viewer."
                  ? e.message
                  : "Could not load this document. Retry or close the viewer.",
          });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [artifactId, selectedPath, key, file]);
  return (
    <Modal
      open
      onCancel={onClose}
      footer={null}
      closable={false}
      keyboard
      maskClosable={false}
      focusTriggerAfterClose
      destroyOnHidden
      width="100%"
      zIndex={100000}
      className="medical-document-viewer"
      title={
        <h2
          id="medical-document-viewer-title"
          className="m-0 text-lg font-semibold"
        >
          Full-screen document viewer
        </h2>
      }
      afterOpenChange={(open) => {
        if (open) closeButton.current?.focus();
      }}
    >
      <div className="medical-document-viewer-shell">
        <header className="medical-document-viewer-toolbar">
          <div className="medical-document-viewer-identity">
            <p>{identity}</p>
          </div>
          <button ref={closeButton} type="button" onClick={onClose}>
            Close viewer
          </button>
          <label className="medical-document-viewer-version">
            Document version
            <select
              aria-label="Document version"
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
            >
              {!file && (
                <option value={selectedPath} disabled>
                  Selected document unavailable
                </option>
              )}
              {files.map((f) => (
                <option key={artifactFilePath(f)} value={artifactFilePath(f)}>
                  {artifactFileLabel(f)}
                </option>
              ))}
            </select>
          </label>
          {current && (
            <div className="medical-document-viewer-links">
              <a href={current.url} download={file && artifactFileName(file)}>
                Download document
              </a>
              <a href={current.url} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
            </div>
          )}
        </header>
        <main
          className="medical-document-viewer-content"
          aria-label="Full-screen document content"
        >
          {currentError ? (
            <div role="alert" className="medical-document-viewer-message">
              {currentError}{" "}
              <button type="button" onClick={() => setRetry((n) => n + 1)}>
                Retry document
              </button>
            </div>
          ) : !current ? (
            <p role="status" className="medical-document-viewer-message">
              Loading document…
            </p>
          ) : current.type === "application/pdf" ? (
            <iframe
              key={current.key}
              title={`Full-screen ${file ? artifactFileLabel(file) : "document"}`}
              src={`${current.url}#view=FitH&navpanes=0`}
            />
          ) : (
            <div className="medical-document-viewer-image">
              <img
                key={current.key}
                src={current.url}
                alt={file ? artifactFileLabel(file) : "Medical document"}
              />
              <p>
                If this image format does not display, use Download document or
                Open in new tab.
              </p>
            </div>
          )}
        </main>
      </div>
    </Modal>
  );
}
