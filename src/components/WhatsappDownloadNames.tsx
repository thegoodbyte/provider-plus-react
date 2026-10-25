import React, { useState } from 'react';

export type WhatsappDownloadNameData = { archiveName: string; fileNames: string[] };

export default function WhatsappDownloadNames({ names }: { names?: WhatsappDownloadNameData }) {
  const [message, setMessage] = useState('');
  const copy = async (value: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setMessage('Filename copied. Paste it into WhatsApp search.');
    } catch {
      setMessage('Could not copy automatically. Select the filename below and copy it manually.');
    }
  };
  const files = names?.fileNames || [];
  return <section aria-label="WhatsApp download filenames" className="my-3 min-w-0 rounded-lg border border-purple-200 bg-white p-3">
    <h3 className="font-bold text-gray-950">WhatsApp download filenames</h3>
    <p className="mt-1 text-sm text-gray-600">Copy a filename and paste it into WhatsApp search. These are the current names for this MRR’s original documents.</p>
    {!names ? <p role="status" className="mt-2 text-sm text-gray-600">Download filenames are unavailable. Reload the review to try again.</p> : !files.length ? <p className="mt-2 text-sm text-gray-600">No downloadable original documents are attached.</p> : <>
      <button type="button" onClick={() => void copy([names.archiveName, ...files].filter(Boolean).join('\n'))} className="my-3 rounded border border-purple-300 px-3 py-2 text-sm font-semibold text-purple-900">Copy all filenames</button>
      <ul className="space-y-3">{[{ fileName: names.archiveName, label: 'MRR archive' }, ...files.map(fileName => ({ fileName, label: 'Document' }))].filter(item => item.fileName).map((item, index) => <li key={`${item.fileName}-${index}`} className="min-w-0 rounded border border-gray-200 p-3">
        <div className="mb-1 text-xs font-semibold uppercase text-gray-500">{item.label}</div>
        <code className="block select-all break-all text-sm font-semibold text-gray-900">{item.fileName}</code>
        <button type="button" aria-label={`Copy ${item.fileName}`} onClick={() => void copy(item.fileName)} className="mt-2 rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-purple-900">Copy filename</button>
      </li>)}</ul>
    </>}
    {message && <p role="status" className="mt-3 text-sm font-medium text-purple-900">{message}</p>}
  </section>;
}
