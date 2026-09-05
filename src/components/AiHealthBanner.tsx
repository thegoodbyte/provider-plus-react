import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { configSummaryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Every AI-backed feature (medical artifact translation, Food Matrix
 * translation, the readiness assistant) used to degrade silently when
 * OPENAI_API_KEY was missing or invalid -- the only way to notice was a user
 * reporting something looked untranslated. This banner surfaces that
 * instead: nothing renders while things are healthy, non-admins never see
 * it, and it fails silently itself rather than replacing the page if
 * config-summary is unreachable.
 */
const POLL_INTERVAL_MS = 60_000;
const CONSECUTIVE_FAILURE_THRESHOLD = 3;

type AiFeatureHealth = {
  lastFailureReason?: string;
  consecutiveFailures?: number;
};

type AiHealthProblem = { kind: 'not_configured' } | { kind: 'feature_failing'; features: string[] };

const featureLabel = (feature: string) => feature.replace(/_/g, ' ');

const AiHealthBanner: React.FC = () => {
  const { user } = useAuth();
  const [problem, setProblem] = useState<AiHealthProblem | null>(null);
  const isAdmin = user?.role === 'admin' || user?.originalRole === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setProblem(null);
      return undefined;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const response = await configSummaryApi.get();
        const ai = response?.data?.ai;
        if (cancelled || !ai) return;
        if (!ai.openAiConfigured) {
          setProblem({ kind: 'not_configured' });
          return;
        }
        const features: Record<string, AiFeatureHealth> = ai.features || {};
        const failingFeatures = Object.entries(features)
          .filter(([, health]) => (health.consecutiveFailures || 0) >= CONSECUTIVE_FAILURE_THRESHOLD)
          .map(([feature]) => feature);
        setProblem(failingFeatures.length ? { kind: 'feature_failing', features: failingFeatures } : null);
      } catch {
        if (!cancelled) setProblem(null);
      }
    };
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin]);

  if (!problem) return null;

  return (
    <div className="flex items-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-white">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        {problem.kind === 'not_configured'
          ? 'OpenAI is not configured -- AI translation and the readiness assistant will not work until OPENAI_API_KEY is set.'
          : `AI feature${problem.features.length === 1 ? '' : 's'} failing repeatedly: ${problem.features.map(featureLabel).join(', ')}. Check the OpenAI configuration.`}
      </span>
    </div>
  );
};

export default AiHealthBanner;
