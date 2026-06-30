import React, { useState } from 'react';
import { FiAlertTriangle, FiDownload, FiUpload } from 'react-icons/fi';
import { backupsApi } from '../services/api';

const RESTORE_CONFIRMATION = 'RESTORE_PROVIDER_PLUS';
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => (
  <IconComponent className={className} />
);

const DataBackupPage: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [redactExportEmails, setRedactExportEmails] = useState(false);
  const [overrideEmails, setOverrideEmails] = useState(false);
  const [overrideEmail, setOverrideEmail] = useState('thegoodbyte@gmail.com');
  const [collections, setCollections] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const downloadExport = async () => {
    setExporting(true);
    setError('');
    setResult(null);
    try {
      const response = await backupsApi.exportBackup({
        redactEmails: redactExportEmails,
        emailReplacement: redactExportEmails ? overrideEmail : undefined,
        collections: collections.trim() || undefined,
      });
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `provider-plus-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError: any) {
      setError(downloadError?.response?.data?.message || downloadError?.message || 'Unable to export backup.');
    } finally {
      setExporting(false);
    }
  };

  const runImport = async (dryRun: boolean) => {
    if (!selectedFile) {
      setError('Choose a backup JSON file first.');
      return;
    }
    if (!dryRun && restoreConfirm !== RESTORE_CONFIRMATION) {
      setError(`Type ${RESTORE_CONFIRMATION} before restoring.`);
      return;
    }

    setImporting(true);
    setError('');
    setResult(null);
    try {
      const response = await backupsApi.importBackup(selectedFile, {
        dryRun,
        confirm: dryRun ? undefined : restoreConfirm,
        emailMode: overrideEmails ? 'override' : 'preserve',
        overrideEmail: overrideEmails ? overrideEmail : undefined,
        collections: collections.trim() || undefined,
      });
      setResult(response.data);
    } catch (importError: any) {
      setError(importError?.response?.data?.message || importError?.message || 'Unable to import backup.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Data Backup</h1>
        <p className="text-sm text-gray-600">Export and restore Provider Plus Mongo data using local JSON backup files.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Export</h2>
          <p className="mt-1 text-sm text-gray-600">Download a full Extended JSON backup. ObjectIds and dates are preserved.</p>

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={redactExportEmails}
              onChange={(event) => setRedactExportEmails(event.target.checked)}
            />
            Replace email fields in the exported file
          </label>

          <button
            type="button"
            onClick={downloadExport}
            disabled={exporting}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Icon icon={FiDownload} />
            {exporting ? 'Exporting...' : 'Download JSON Backup'}
          </button>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Import / Restore</h2>
          <p className="mt-1 text-sm text-gray-600">Dry run first. Restore replaces selected collections with the file contents.</p>

          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            className="mt-4 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={overrideEmails}
              onChange={(event) => setOverrideEmails(event.target.checked)}
            />
            Override email fields during import
          </label>

          <label className="mt-3 block text-sm font-medium text-gray-700">
            Override email
            <input
              type="email"
              value={overrideEmail}
              onChange={(event) => setOverrideEmail(event.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-medium">
              <Icon icon={FiAlertTriangle} />
              Destructive restore requires confirmation
            </div>
            <p className="mt-1">Type {RESTORE_CONFIRMATION} to enable restore.</p>
          </div>

          <input
            type="text"
            value={restoreConfirm}
            onChange={(event) => setRestoreConfirm(event.target.value)}
            placeholder={RESTORE_CONFIRMATION}
            className="mt-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runImport(true)}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <Icon icon={FiUpload} />
              Dry Run
            </button>
            <button
              type="button"
              onClick={() => runImport(false)}
              disabled={importing || restoreConfirm !== RESTORE_CONFIRMATION}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              Restore
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Advanced</h2>
        <label className="mt-3 block text-sm font-medium text-gray-700">
          Collections
          <input
            type="text"
            value={collections}
            onChange={(event) => setCollections(event.target.value)}
            placeholder="Optional comma-separated list, for example clients,retreatclients"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      {result && (
        <section className="rounded-lg border border-gray-200 bg-gray-950 p-5 text-sm text-gray-100 shadow-sm">
          <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </div>
  );
};

export default DataBackupPage;
