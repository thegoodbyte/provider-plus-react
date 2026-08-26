import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { configSummaryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * PPVC-64: app-wide reminder that this environment is currently reading S3
 * files from an override bucket (e.g. prod's), so nobody mistakes browsed
 * data for this environment's own. Self-contained: fetches config-summary
 * itself and renders nothing for non-admins (the endpoint is admin-gated),
 * when the override is inactive, or if the fetch fails.
 */
const POLL_INTERVAL_MS = 60_000;

const StorageOverrideBanner: React.FC = () => {
  const { user } = useAuth();
  const [override, setOverride] = useState<{ bucket: string | null; expiresAt: string | null } | null>(null);
  const isAdmin = user?.role === 'admin' || user?.originalRole === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setOverride(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const response = await configSummaryApi.get();
        const s3ReadOverride = response?.data?.storage?.s3ReadOverride;
        if (!cancelled) {
          setOverride(s3ReadOverride?.active ? { bucket: s3ReadOverride.bucket, expiresAt: s3ReadOverride.expiresAt } : null);
        }
      } catch {
        if (!cancelled) setOverride(null);
      }
    };
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin]);

  if (!override) return null;

  return (
    <div className="flex items-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-white">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Reading files from override bucket <strong>{override.bucket}</strong>
        {override.expiresAt && <> until {new Date(override.expiresAt).toLocaleString()}</>} -- you are viewing another environment's data.
      </span>
    </div>
  );
};

export default StorageOverrideBanner;
