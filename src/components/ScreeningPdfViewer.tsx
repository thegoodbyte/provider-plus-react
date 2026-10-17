import { createPortal } from 'react-dom';
import React, { useEffect, useRef, useState } from 'react';
import { clientsApi } from '../services/api';

export default function ScreeningPdfViewer({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const activeUrl = useRef('');
  const locked = useRef(false);
  const failedRegeneration = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  const load = async (regenerate = false) => {
    if (locked.current) return;
    locked.current = true;
    const seq = ++sequence.current;
    setBusy(true); setError(''); failedRegeneration.current = regenerate;
    try {
      const response = regenerate ? await clientsApi.regenerateScreeningPdf(clientId) : await clientsApi.viewScreeningPdf(clientId);
      if (!(response.data instanceof Blob) || !response.data.size || !/^application\/pdf(?:;|$)/i.test(response.data.type)) throw new Error('The server did not return a PDF.');
      if (seq !== sequence.current) return;
      const next = URL.createObjectURL(response.data);
      const previous = activeUrl.current; activeUrl.current = next; setUrl(next);
      if (previous) URL.revokeObjectURL(previous);
    } catch {
      if (seq === sequence.current) setError(regenerate ? `Could not regenerate the screening PDF. ${activeUrl.current ? 'The previous copy is still available.' : 'Please retry.'}` : 'Could not open the screening PDF. Please retry.');
    } finally {
      if (seq === sequence.current) { locked.current = false; setBusy(false); }
    }
  };

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    void load();
    return () => { ++sequence.current; locked.current = false; if (activeUrl.current) URL.revokeObjectURL(activeUrl.current); activeUrl.current = ''; previousFocus?.focus(); };
  }, [clientId]); // Viewer is mounted only while open.

  return createPortal(<div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-2 sm:p-6" onKeyDown={e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], iframe'));
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
    <section role="dialog" aria-modal="true" aria-labelledby="screening-pdf-title" className="flex h-full w-full max-w-6xl flex-col rounded-xl bg-white p-4 shadow-xl">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 id="screening-pdf-title" className="text-lg font-semibold">Screening PDF</h2><div className="flex flex-wrap gap-3">
        <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={() => void load(true)}>Regenerate</button>
        {url && <a className="rounded border px-3 py-2" href={url} download="screening.pdf">Download PDF</a>}
        <button ref={closeButton} type="button" className="rounded border px-3 py-2" onClick={onClose}>Close PDF viewer</button>
      </div></header>
      <p className="mb-3 text-sm text-slate-600">Generated from saved screening data. Save your changes before regenerating. A missing PDF is generated automatically.</p>
      {busy && <p role="status">Loading or generating screening PDF…</p>}
      {error && <div role="alert" className="mb-3 rounded bg-red-50 p-3 text-red-900">{error} <button type="button" disabled={busy} onClick={() => void load(failedRegeneration.current)}>Retry</button></div>}
      {url && <><iframe title="Screening PDF document" src={url} className="min-h-0 flex-1 border" /><a className="mt-2 text-sm text-blue-700 underline" href={url} target="_blank" rel="noreferrer">Open PDF in a new tab</a></>}
    </section>
  </div>, document.body);
}
