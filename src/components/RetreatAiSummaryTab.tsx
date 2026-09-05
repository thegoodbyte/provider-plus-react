import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, ClipboardList, CreditCard, FileText, RefreshCw, Sparkles, Stethoscope } from 'lucide-react';
import { assistantApi, AssistantTask, RetreatReadinessAssistantResult } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

interface RetreatAiSummaryTabProps { retreatId: string; }

const CATEGORY_ICON: Record<AssistantTask['category'], React.ComponentType<{ size?: number }>> = {
  medical: Stethoscope,
  documents: FileText,
  payment: CreditCard,
  review: ClipboardList,
};
const CATEGORY_LABEL: Record<AssistantTask['category'], string> = {
  medical: 'Medical',
  documents: 'Documents',
  payment: 'Payment',
  review: 'Review',
};

type ClientTaskGroup = {
  bookingLink: string;
  clientName: string;
  clientLink?: string;
  isBehindOnEverything: boolean;
  tasks: AssistantTask[];
};

const RetreatAiSummaryTab: React.FC<RetreatAiSummaryTabProps> = ({ retreatId }) => {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<RetreatReadinessAssistantResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalysis = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await assistantApi.analyzeRetreatReadiness(retreatId);
      setAnalysis(response.data);
    } catch {
      setError('Unable to load the AI summary for this retreat.');
    } finally {
      setIsLoading(false);
    }
  }, [retreatId]);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  const groups = useMemo<ClientTaskGroup[]>(() => {
    if (!analysis) return [];
    const byBooking = new Map<string, ClientTaskGroup>();
    analysis.clients.forEach((row) => {
      byBooking.set(row.bookingLink, {
        bookingLink: row.bookingLink,
        clientName: row.clientName,
        clientLink: row.clientLink,
        isBehindOnEverything: row.isBehindOnEverything,
        tasks: [],
      });
    });
    analysis.tasks.forEach((task) => {
      byBooking.get(task.bookingLink)?.tasks.push(task);
    });
    return Array.from(byBooking.values())
      .filter((group) => group.tasks.length > 0)
      .sort((a, b) => {
        if (a.isBehindOnEverything !== b.isBehindOnEverything) return a.isBehindOnEverything ? -1 : 1;
        return b.tasks.length - a.tasks.length;
      });
  }, [analysis]);

  const openLink = (link?: string) => { if (link) navigate(link); };

  if (isLoading && !analysis) return <LoadingSpinner message="Building the AI summary..." />;
  if (!analysis) return <div className="ai-summary-empty">{error || 'Unable to load the AI summary.'}</div>;

  const daysLabel = typeof analysis.retreat.daysUntilRetreat === 'number'
    ? analysis.retreat.daysUntilRetreat >= 0
      ? `${analysis.retreat.daysUntilRetreat} days until retreat`
      : `retreat started ${Math.abs(analysis.retreat.daysUntilRetreat)} days ago`
    : 'retreat date not set';

  return (
    <section className="ai-summary-shell">
      <header className="ai-summary-hero">
        <div className="ai-summary-title">
          <span className="ai-summary-icon"><Sparkles size={22} /></span>
          <div>
            <h2>AI Summary</h2>
            <p>{analysis.retreat.code || analysis.retreat.name} · {daysLabel}</p>
          </div>
        </div>
        <button type="button" className="ai-summary-refresh" onClick={fetchAnalysis} disabled={isLoading}>
          <RefreshCw size={15} className={isLoading ? 'ai-summary-spin' : ''} /> Refresh
        </button>
      </header>

      {error && <div className="ai-summary-message error">{error}</div>}

      <p className="ai-summary-narrative">{analysis.aiSummary || analysis.summary}</p>
      {analysis.aiUnavailableReason && <div className="ai-summary-notice">AI note: {analysis.aiUnavailableReason}</div>}

      <div className="ai-summary-tasks">
        <h3>Tasks for today</h3>
        {!groups.length ? (
          <div className="ai-summary-clear"><Check size={17} /> Nothing urgent right now — every client checked looks on track.</div>
        ) : (
          <div className="ai-summary-client-list">
            {groups.map((group) => (
              <article key={group.bookingLink} className={`ai-summary-client-card ${group.isBehindOnEverything ? 'behind' : ''}`}>
                <header>
                  <button type="button" onClick={() => openLink(group.clientLink || group.bookingLink)}>{group.clientName}</button>
                  {group.isBehindOnEverything && <span className="ai-summary-badge"><AlertTriangle size={12} /> Behind on everything</span>}
                </header>
                <ul>
                  {group.tasks.map((task, index) => {
                    const Icon = CATEGORY_ICON[task.category];
                    return (
                      <li key={`${task.category}-${index}`} className={`severity-${task.severity}`}>
                        <Icon size={14} />
                        <span className="ai-summary-task-category">{CATEGORY_LABEL[task.category]}</span>
                        <span>{task.message}</span>
                      </li>
                    );
                  })}
                </ul>
                <button type="button" className="ai-summary-open" onClick={() => openLink(group.bookingLink)}>Open booking</button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default RetreatAiSummaryTab;
