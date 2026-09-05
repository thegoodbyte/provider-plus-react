import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ClipboardList, CreditCard, FileText, Sparkles, Stethoscope } from 'lucide-react';
import { assistantApi, TasksForTodayResult, TodayTask } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ASSISTANT_ROLES = new Set(['admin', 'medical_staff']);
const MAX_VISIBLE_TASKS = 6;

const CATEGORY_ICON: Record<TodayTask['category'], React.ComponentType<{ size?: number }>> = {
  medical: Stethoscope,
  documents: FileText,
  payment: CreditCard,
  review: ClipboardList,
};

const TasksForTodayPanel: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasAccess = ASSISTANT_ROLES.has(user?.role || '');
  const [data, setData] = useState<TasksForTodayResult | null>(null);

  useEffect(() => {
    if (!hasAccess) return undefined;
    let cancelled = false;
    assistantApi.getTasksForToday()
      .then((response) => { if (!cancelled) setData(response.data); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [hasAccess]);

  const visibleTasks = useMemo(() => (data?.tasks || []).slice(0, MAX_VISIBLE_TASKS), [data]);
  const hiddenCount = Math.max((data?.tasks.length || 0) - visibleTasks.length, 0);

  if (!hasAccess || !data) return null;

  const openLink = (link?: string) => { if (link) navigate(link); };

  return (
    <section className="tasks-today-panel">
      <header>
        <div className="tasks-today-title"><Sparkles size={17} /> Tasks for Today</div>
        {data.retreats.length > 0 && (
          <div className="tasks-today-retreats">
            {data.retreats.map((retreat) => (
              <button key={retreat.id} type="button" onClick={() => openLink(retreat.link)}>
                {retreat.name || 'Retreat'}{typeof retreat.daysUntilRetreat === 'number' ? ` · ${retreat.daysUntilRetreat}d` : ''}
              </button>
            ))}
          </div>
        )}
      </header>

      {!data.tasks.length ? (
        <div className="tasks-today-clear"><Check size={15} /> All caught up on your upcoming retreats.</div>
      ) : (
        <>
          <ul className="tasks-today-list">
            {visibleTasks.map((task, index) => {
              const Icon = CATEGORY_ICON[task.category];
              return (
                <li key={`${task.bookingLink}-${task.category}-${index}`} className={`severity-${task.severity}`}>
                  <Icon size={14} />
                  <div className="tasks-today-item-body">
                    <button type="button" onClick={() => openLink(task.clientLink || task.bookingLink)}>{task.clientName}</button>
                    <span className="tasks-today-item-message">{task.message}</span>
                  </div>
                  {task.retreatName && <span className="tasks-today-item-retreat">{task.retreatName}</span>}
                </li>
              );
            })}
          </ul>
          {hiddenCount > 0 && <div className="tasks-today-more">+{hiddenCount} more</div>}
        </>
      )}
    </section>
  );
};

export default TasksForTodayPanel;
