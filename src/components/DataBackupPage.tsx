import { AlertTriangle, CheckCircle, Download as DownloadIcon, Loader, RefreshCw, Upload as UploadIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { backupsApi } from '../services/api';
import DevelopmentRefreshPanel from './DevelopmentRefreshPanel';
import AppleButton from './AppleButton';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, EmptyState } from './ui';

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

  const activeOperation = busy.endsWith('dry-run')
    ? {
        title: 'Dry run in progress',
        message: 'Uploading and checking the backup. No database data is being changed.',
      }
    : busy === 'restore'
      ? {
          title: 'Database restore in progress',
          message: 'Keep this page open until the restore finishes.',
        }
      : null;

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
    await runImport(dryRun, 'local', () => backupsApi.importBackup(selectedFile, {
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
    await runImport(dryRun, 's3', () => backupsApi.importFromS3({
      bucket: bucket.trim() || undefined,
      key: selectedS3Key,
      dryRun,
      confirm: dryRun ? undefined : restoreConfirm,
      emailMode: overrideEmails ? 'override' : 'preserve',
      overrideEmail: overrideEmails ? overrideEmail : undefined,
      ...commonOptions,
    }));
  };

  const runImport = async (dryRun: boolean, source: 'local' | 's3', action: () => Promise<any>) => {
    if (!dryRun && restoreConfirm !== RESTORE_CONFIRMATION) {
      setError(`Type ${RESTORE_CONFIRMATION} before restoring.`);
      return;
    }
    setBusy(dryRun ? `${source}-dry-run` : 'restore');
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
      {activeOperation && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 w-[min(28rem,calc(100vw-3rem))] rounded-lg border border-blue-300 bg-white p-4 shadow-2xl"
        >
          <div className="flex items-start gap-3">
            <Icon icon={Loader} className="mt-0.5 shrink-0 animate-spin text-xl text-blue-600" />
            <div>
              <div className="font-semibold text-gray-950">{activeOperation.title}</div>
              <p className="mt-1 text-sm text-gray-700">{activeOperation.message}</p>
              {selectedFile && busy === 'local-dry-run' && (
                <p className="mt-2 break-all text-xs text-gray-500">File: {selectedFile.name}</p>
              )}
              <p className="mt-2 text-xs font-medium text-blue-700">Large backup files can take several minutes.</p>
            </div>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Data Backup</h1>
        <p className="text-sm text-gray-600">Export, upload to S3, and restore Provider Plus Mongo backups.</p>
      </div>

      <DevelopmentRefreshPanel />

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <div className="flex items-center gap-2 font-semibold"><Icon icon={CheckCircle} />{notice.title}</div>
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

      <section className="rounded-apple-lg border border-apple-gray-200 bg-apple-surface shadow-apple-sm p-5">
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
        <section className="rounded-apple-lg border border-apple-gray-200 bg-apple-surface shadow-apple-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900">Create Backup</h2>
          <p className="mt-1 text-sm text-gray-600">Local download or upload directly to S3. S3 uses server-side AES256 encryption.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <AppleButton variant="secondary" onClick={downloadLocalExport} disabled={!!busy}>
              <Icon icon={DownloadIcon} /> Download JSON
            </AppleButton>
            <AppleButton onClick={exportToS3} disabled={!!busy}>
              <Icon icon={UploadIcon} /> Upload Backup to S3
            </AppleButton>
          </div>
        </section>

        <section className="rounded-apple-lg border border-apple-gray-200 bg-apple-surface shadow-apple-sm p-5">
          <h2 className="text-lg font-semibold text-gray-900">Restore Controls</h2>
          <p className="mt-1 text-sm text-gray-600">Dry run first. Restore replaces selected collections with backup contents.</p>
          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={overrideEmails} onChange={(e) => setOverrideEmails(e.target.checked)} />Override email fields during import</label>
          <input type="email" value={overrideEmail} onChange={(e) => setOverrideEmail(e.target.value)} className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-medium"><Icon icon={AlertTriangle} />Destructive restore requires confirmation</div>
            <p className="mt-1">Type {RESTORE_CONFIRMATION} to enable restore.</p>
          </div>
          <input value={restoreConfirm} onChange={(e) => setRestoreConfirm(e.target.value)} placeholder={RESTORE_CONFIRMATION} className="mt-3 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </section>
      </div>

      <section className="rounded-apple-lg border border-apple-gray-200 bg-apple-surface shadow-apple-sm p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Available S3 Restore Files</h2>
            <p className="text-sm text-gray-600">Select a backup from the configured bucket, or point to another bucket/prefix.</p>
          </div>
          <AppleButton variant="secondary" onClick={loadS3Files} disabled={busy === 's3-list'}>
            <Icon icon={RefreshCw} /> Refresh
          </AppleButton>
        </div>
        <div className="mt-4 overflow-hidden rounded-apple-lg border border-apple-gray-200">
          {s3Files.length === 0 ? (
            <div className="p-5"><EmptyState title="No S3 backup files found." /></div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>File</TableHeaderCell>
                  <TableHeaderCell>Modified</TableHeaderCell>
                  <TableHeaderCell>Size</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {s3Files.map((file) => (
                  <TableRow key={file.key} onClick={() => setSelectedS3Key(file.key)} className={selectedS3Key === file.key ? 'bg-blue-50' : ''}>
                    <TableCell className="font-mono text-xs">{file.key}</TableCell>
                    <TableCell>{file.lastModified ? new Date(file.lastModified).toLocaleString() : '-'}</TableCell>
                    <TableCell>{file.size ? `${Math.round(file.size / 1024)} KB` : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <AppleButton variant="secondary" onClick={downloadSelectedS3File} disabled={!selectedS3Key || !!busy}>Download Selected</AppleButton>
          <AppleButton variant="secondary" onClick={() => runS3Import(true)} disabled={!selectedS3Key || !!busy}>
            {busy === 's3-dry-run' && <Icon icon={Loader} className="animate-spin" />}
            {busy === 's3-dry-run' ? 'Running dry run…' : 'Dry Run S3 Restore'}
          </AppleButton>
          <AppleButton variant="danger" onClick={() => runS3Import(false)} disabled={!selectedS3Key || !!busy || restoreConfirm !== RESTORE_CONFIRMATION}>Restore From S3</AppleButton>
        </div>
      </section>

      <section className="rounded-apple-lg border border-apple-gray-200 bg-apple-surface shadow-apple-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900">Local File Restore</h2>
        <input type="file" accept="application/json,.json" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="mt-4 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <div className="mt-4 flex flex-wrap gap-2">
          <AppleButton variant="secondary" onClick={() => runLocalImport(true)} disabled={!selectedFile || !!busy}>
            {busy === 'local-dry-run' && <Icon icon={Loader} className="animate-spin" />}
            {busy === 'local-dry-run' ? 'Running dry run…' : 'Dry Run Local Restore'}
          </AppleButton>
          <AppleButton variant="danger" onClick={() => runLocalImport(false)} disabled={!selectedFile || !!busy || restoreConfirm !== RESTORE_CONFIRMATION}>Restore Local File</AppleButton>
        </div>
      </section>

      <section className="rounded-apple-lg border border-apple-gray-200 bg-apple-surface shadow-apple-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900">Advanced</h2>
        <label className="mt-3 block text-sm font-medium text-gray-700">Collections
          <input value={collections} onChange={(e) => setCollections(e.target.value)} placeholder="Optional comma-separated list, for example clients,retreatclients" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </section>

      {result && <section className="rounded-lg border border-gray-200 bg-gray-950 p-5 text-sm text-gray-100 shadow-sm"><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre></section>}

      <section className="rounded-apple-lg border border-apple-gray-200 bg-apple-surface shadow-apple-sm p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Backup / Restore Log</h2>
          <AppleButton variant="secondary" size="sm" onClick={loadLogs}>Refresh</AppleButton>
        </div>
        <div className="mt-4 overflow-hidden rounded-apple-lg border border-apple-gray-200">
          {logs.length === 0 ? (
            <div className="p-5"><EmptyState title="No backup log entries yet." /></div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>When</TableHeaderCell>
                  <TableHeaderCell>Action</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Actor</TableHeaderCell>
                  <TableHeaderCell>Location</TableHeaderCell>
                  <TableHeaderCell>Message</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell className="whitespace-nowrap">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.status}</TableCell>
                    <TableCell>{log.actorEmail || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{log.storage === 's3' ? `${log.bucket || ''}/${log.key || ''}` : log.fileName || 'local'}</TableCell>
                    <TableCell>{log.message || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
};

export default DataBackupPage;
