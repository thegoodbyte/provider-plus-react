import React, { useEffect, useState } from 'react';
import { FiAlertTriangle, FiDownload, FiRefreshCw, FiUpload } from 'react-icons/fi';
import { backupsApi } from '../services/api';

const RESTORE_CONFIRMATION = 'RESTORE_PROVIDER_PLUS';
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => (
  <IconComponent className={className} />
);

type S3BackupFile = {
  key: string;
  size?: number;
  lastModified?: string;
};

type RestoreNotice = {
  title: string;
  message: string;
  details: string[];
};

const DataBackupPage: React.FC = () => {
  const [busy, setBusy] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [redactExportEmails, setRedactExportEmails] = useState(false);
  const [overrideEmails, setOverrideEmails] = useState(false);
  const [overrideEmail, setOverrideEmail] = useState('thegoodbyte@gmail.com');
  const [collections, setCollections] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [bucket, setBucket] = useState('');
  const [environment, setEnvironment] = useState('');
  const [prefix, setPrefix] = useState('');
  const [compressS3, setCompressS3] = useState(true);
  const [s3Files, setS3Files] = useState<S3BackupFile[]>([]);
  const [selectedS3Key, setSelectedS3Key] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [notice, setNotice] = useState<RestoreNotice | null>(null);
  const [error, setError] = useState('');

  const commonOptions = {
    collections: collections.trim() || undefined,
  };

  const loadS3Files = async () => {
    setBusy('s3-list');
    setError('');
    try {
      const response = await backupsApi.listS3Files({
        bucket: bucket.trim() || undefined,
        environment: environment.trim() || undefined,
        prefix: prefix.trim() || undefined,
        maxKeys: 100,
      });
      setS3Files(response.data.items || []);
      if (!selectedS3Key && response.data.items?.[0]?.key) setSelectedS3Key(response.data.items[0].key);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load S3 backup files.');
    } finally {
      setBusy('');
    }
  };

  const loadLogs = async () => {
    try {
      const response = await backupsApi.getLogs({ limit: 50 });
      setLogs(response.data || []);
    } catch (loadError) {
      console.error('Unable to load backup logs:', loadError);
    }
  };

  useEffect(() => {
    loadS3Files();
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadBlob = (data: BlobPart, filename: string, type = 'application/json') => {
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadLocalExport = async () => {
    setBusy('local-export');
    setError('');
    setResult(null);
    setNotice(null);
    try {
      const response = await backupsApi.exportBackup({
        redactEmails: redactExportEmails,
        emailReplacement: redactExportEmails ? overrideEmail : undefined,
        ...commonOptions,
      });
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="([^"]+)"/);
      downloadBlob(response.data, match?.[1] || `provider-plus-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      await loadLogs();
    } catch (downloadError: any) {
      setError(downloadError?.response?.data?.message || downloadError?.message || 'Unable to export backup.');
    } finally {
      setBusy('');
    }
  };

  const exportToS3 = async () => {
    setBusy('s3-export');
    setError('');
    setResult(null);
    setNotice(null);
    try {
      const response = await backupsApi.exportToS3({
        bucket: bucket.trim() || undefined,
        environment: environment.trim() || undefined,
        compress: compressS3,
        redactEmails: redactExportEmails,
        emailReplacement: redactExportEmails ? overrideEmail : undefined,
        ...commonOptions,
      });
      setResult(response.data);
      await loadS3Files();
      await loadLogs();
    } catch (exportError: any) {
      setError(exportError?.response?.data?.message || exportError?.message || 'Unable to upload backup to S3.');
    } finally {
      setBusy('');
    }
  };

  const runLocalImport = async (dryRun: boolean) => {
    if (!selectedFile) {
      setError('Choose a backup JSON file first.');
      return;
    }
    await runImport(dryRun, () => backupsApi.importBackup(selectedFile, {
      dryRun,
      confirm: dryRun ? undefined : restoreConfirm,
      emailMode: overrideEmails ? 'override' : 'preserve',
      overrideEmail: overrideEmails ? overrideEmail : undefined,
      ...commonOptions,
    }));
  };

  const runS3Import = async (dryRun: boolean) => {
    if (!selectedS3Key) {
      setError('Choose an S3 backup file first.');
      return;
    }
    await runImport(dryRun, () => backupsApi.importFromS3({
      bucket: bucket.trim() || undefined,
      key: selectedS3Key,
      dryRun,
      confirm: dryRun ? undefined : restoreConfirm,
      emailMode: overrideEmails ? 'override' : 'preserve',
      overrideEmail: overrideEmails ? overrideEmail : undefined,
      ...commonOptions,
    }));
  };

  const runImport = async (dryRun: boolean, action: () => Promise<any>) => {
    if (!dryRun && restoreConfirm !== RESTORE_CONFIRMATION) {
      setError(`Type ${RESTORE_CONFIRMATION} before restoring.`);
      return;
    }
    setBusy(dryRun ? 'dry-run' : 'restore');
    setError('');
    setResult(null);
    setNotice(null);
    try {
      const response = await action();
      setResult(response.data);
      setNotice(buildRestoreNotice(response.data, dryRun));
      await loadLogs();
    } catch (importError: any) {
      setError(importError?.response?.data?.message || importError?.message || 'Unable to import backup.');
    } finally {
      setBusy('');
    }
  };

  const downloadSelectedS3File = async () => {
    if (!selectedS3Key) return;
    setBusy('s3-download');
    setError('');
    setNotice(null);
    try {
      const response = await backupsApi.downloadS3File({
        bucket: bucket.trim() || undefined,
        key: selectedS3Key,
      });
      downloadBlob(
        response.data,
        selectedS3Key.split('/').pop() || 'provider-plus-backup.json',
        selectedS3Key.endsWith('.gz') ? 'application/gzip' : 'application/json',
      );
    } catch (downloadError: any) {
      setError(downloadError?.response?.data?.message || downloadError?.message || 'Unable to download S3 backup.');
    } finally {
      setBusy('');
    }
  };

  const buildRestoreNotice = (data: any, dryRun: boolean): RestoreNotice => {
    const source = data?.source?.storage === 's3'
      ? `S3: ${[data.source.bucket, data.source.key].filter(Boolean).join('/')}`
      : 'local file';
    const restored = Array.isArray(data?.restored) ? data.restored : [];
    const wouldReplace = Array.isArray(data?.wouldReplaceCollections) ? data.wouldReplaceCollections : [];
    const rows = dryRun ? wouldReplace : restored;
    const collectionCount = rows.length;
    const documentCount = rows.reduce((sum: number, row: any) => {
      return sum + Number(row.inserted ?? row.incomingCount ?? 0);
    }, 0);
    const deletedCount = restored.reduce((sum: number, row: any) => sum + Number(row.deleted || 0), 0);

    const details = [
      `Source: ${source}`,
      `Collections: ${collectionCount}`,
      dryRun ? `Documents that would be restored: ${documentCount}` : `Documents restored: ${documentCount}`,
    ];
    if (!dryRun) details.push(`Existing documents replaced: ${deletedCount}`);
    if (data?.message) details.push(data.message);

    return {
      title: dryRun ? 'Dry run completed' : 'Restore completed successfully',
      message: dryRun
        ? 'No data was changed. Review the summary below before running the real restore.'
        : 'The backup restore finished and the restore log was refreshed.',
      details,
    };
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Data Backup</h1>
        <p className="text-sm text-gray-600">Export, upload to S3, and restore Provider Plus Mongo backups.</p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <div className="font-semibold">{notice.title}</div>
          <p className="mt-1">{notice.message}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {notice.details.map((detail) => {
              const [label, ...rest] = detail.split(': ');
              return (
                <div key={detail} className="rounded border border-green-100 bg-white/70 px-3 py-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-green-700">{label}</dt>
                  <dd className="mt-1 text-green-950">{rest.join(': ') || '-'}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">S3 Settings</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="block text-sm font-medium text-gray-700">
            Bucket override
            <input value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="Leave blank for configured bucket" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Environment
            <input value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="production, stage, dev" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Prefix override
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="backups/provider-plus/production/" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={compressS3} onChange={(e) => setCompressS3(e.target.checked)} />Compress S3 backup</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={redactExportEmails} onChange={(e) => setRedactExportEmails(e.target.checked)} />Replace email fields on export</label>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Create Backup</h2>
          <p className="mt-1 text-sm text-gray-600">Local download or upload directly to S3. S3 uses server-side AES256 encryption.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={downloadLocalExport} disabled={!!busy} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              <Icon icon={FiDownload} /> Download JSON
            </button>
            <button onClick={exportToS3} disabled={!!busy} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              <Icon icon={FiUpload} /> Upload Backup to S3
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Restore Controls</h2>
          <p className="mt-1 text-sm text-gray-600">Dry run first. Restore replaces selected collections with backup contents.</p>
          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={overrideEmails} onChange={(e) => setOverrideEmails(e.target.checked)} />Override email fields during import</label>
          <input type="email" value={overrideEmail} onChange={(e) => setOverrideEmail(e.target.value)} className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-medium"><Icon icon={FiAlertTriangle} />Destructive restore requires confirmation</div>
            <p className="mt-1">Type {RESTORE_CONFIRMATION} to enable restore.</p>
          </div>
          <input value={restoreConfirm} onChange={(e) => setRestoreConfirm(e.target.value)} placeholder={RESTORE_CONFIRMATION} className="mt-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Available S3 Restore Files</h2>
            <p className="text-sm text-gray-600">Select a backup from the configured bucket, or point to another bucket/prefix.</p>
          </div>
          <button onClick={loadS3Files} disabled={busy === 's3-list'} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            <Icon icon={FiRefreshCw} /> Refresh
          </button>
        </div>
        <div className="mt-4 overflow-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">File</th><th className="px-3 py-2 text-left">Modified</th><th className="px-3 py-2 text-left">Size</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {s3Files.map((file) => (
                <tr key={file.key} onClick={() => setSelectedS3Key(file.key)} className={`cursor-pointer ${selectedS3Key === file.key ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-2 font-mono text-xs">{file.key}</td>
                  <td className="px-3 py-2">{file.lastModified ? new Date(file.lastModified).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2">{file.size ? `${Math.round(file.size / 1024)} KB` : '-'}</td>
                </tr>
              ))}
              {s3Files.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-500">No S3 backup files found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={downloadSelectedS3File} disabled={!selectedS3Key || !!busy} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 disabled:opacity-60">Download Selected</button>
          <button onClick={() => runS3Import(true)} disabled={!selectedS3Key || !!busy} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 disabled:opacity-60">Dry Run S3 Restore</button>
          <button onClick={() => runS3Import(false)} disabled={!selectedS3Key || !!busy || restoreConfirm !== RESTORE_CONFIRMATION} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Restore From S3</button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Local File Restore</h2>
        <input type="file" accept="application/json,.json" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="mt-4 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => runLocalImport(true)} disabled={!selectedFile || !!busy} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 disabled:opacity-60">Dry Run Local Restore</button>
          <button onClick={() => runLocalImport(false)} disabled={!selectedFile || !!busy || restoreConfirm !== RESTORE_CONFIRMATION} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Restore Local File</button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Advanced</h2>
        <label className="mt-3 block text-sm font-medium text-gray-700">Collections
          <input value={collections} onChange={(e) => setCollections(e.target.value)} placeholder="Optional comma-separated list, for example clients,retreatclients" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </section>

      {result && <section className="rounded-lg border border-gray-200 bg-gray-950 p-5 text-sm text-gray-100 shadow-sm"><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre></section>}

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Backup / Restore Log</h2>
          <button onClick={loadLogs} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700">Refresh</button>
        </div>
        <div className="mt-4 overflow-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">When</th><th className="px-3 py-2 text-left">Action</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Actor</th><th className="px-3 py-2 text-left">Location</th><th className="px-3 py-2 text-left">Message</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log._id}>
                  <td className="px-3 py-2 whitespace-nowrap">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2">{log.action}</td>
                  <td className="px-3 py-2">{log.status}</td>
                  <td className="px-3 py-2">{log.actorEmail || '-'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{log.storage === 's3' ? `${log.bucket || ''}/${log.key || ''}` : log.fileName || 'local'}</td>
                  <td className="px-3 py-2">{log.message || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No backup log entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default DataBackupPage;
