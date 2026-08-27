import React, { useEffect, useMemo, useState } from 'react';
import { Task, taskService } from '../../services/taskService';
import './SprintBoard.css';

type Status = Task['status'];
type Context = 'client' | 'booking' | 'retreat' | 'generic';

const columns: Array<{ status: Status; label: string }> = [
  { status: 'pending', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'completed', label: 'Done' },
];

const contexts: Array<{ id: Context; label: string }> = [
  { id: 'client', label: 'Client tasks' },
  { id: 'booking', label: 'Booking tasks' },
  { id: 'retreat', label: 'Retreat tasks' },
  { id: 'generic', label: 'Generic tasks' },
];

const sprintTag = (task: Task) => task.tags?.find(tag => tag.startsWith('sprint:'))?.slice(7) || 'Backlog';
const taskContext = (task: Task): Context => {
  if (task.bookingId || task.type === 'booking') return 'booking';
  if (task.type === 'client' || task.clientId) return 'client';
  if (task.type === 'retreat' || task.retreatId) return 'retreat';
  return 'generic';
};
const isSystemTask = (task: Task) => Boolean(task.sourceType || task.sourceId || task.bookingFlowItemId);

const readSavedSprints = (): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem('task-sprints') || '[]');
    return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : [];
  } catch {
    return [];
  }
};

export const SprintBoard: React.FC<{ tasks: Task[]; onChanged: () => Promise<void>; onEdit: (task: Task) => void; onCreate: (context: Context, sprint: string) => void }> = ({ tasks, onChanged, onEdit, onCreate }) => {
  const [localSprints] = useState<string[]>(readSavedSprints);
  const [serverSprints, setServerSprints] = useState<string[]>([]);
  const [sprintError, setSprintError] = useState('');
  const [activeSprint, setActiveSprint] = useState(() => localStorage.getItem('active-task-sprint') || 'Backlog');
  const [draggedId, setDraggedId] = useState('');
  const [busy, setBusy] = useState(false);
  const sprints = useMemo(() => Array.from(new Set(['Backlog', ...serverSprints, ...localSprints, ...tasks.map(sprintTag)])), [serverSprints, localSprints, tasks]);
  const selectedSprint = sprints.includes(activeSprint) ? activeSprint : 'Backlog';
  const sprintTasks = tasks.filter(task => sprintTag(task) === selectedSprint && task.status !== 'cancelled');

  useEffect(() => {
    taskService.getSprints()
      .then(async items => {
        const names = items.map(item => item.name);
        const migrated = await Promise.all(localSprints.filter(name => !names.includes(name)).map(name => taskService.createSprint(name)));
        setServerSprints(Array.from(new Set([...names, ...migrated.map(item => item.name)])));
        if (migrated.length) localStorage.removeItem('task-sprints');
      })
      .catch(error => setSprintError(error instanceof Error ? error.message : 'Could not load saved sprints'));
  }, [localSprints]);

  const selectSprint = (sprint: string) => {
    setActiveSprint(sprint);
    localStorage.setItem('active-task-sprint', sprint);
  };

  const createSprint = async () => {
    const name = window.prompt('Sprint name');
    const trimmed = name?.trim();
    if (!trimmed) return;
    setSprintError('');
    try {
      const saved = await taskService.createSprint(trimmed);
      setServerSprints(current => Array.from(new Set([...current, saved.name])));
      selectSprint(saved.name);
    } catch (error) {
      setSprintError(error instanceof Error ? error.message : 'Could not create sprint');
    }
  };

  const move = async (context: Context, status: Status) => {
    const task = tasks.find(item => item.id === draggedId);
    if (!task || busy) return;
    const tags = [...(task.tags || []).filter(tag => !tag.startsWith('sprint:'))];
    if (selectedSprint !== 'Backlog') tags.push(`sprint:${selectedSprint}`);
    setBusy(true);
    try {
      await taskService.updateTask(task.id, { type: context, status, tags });
      await onChanged();
    } finally {
      setBusy(false);
      setDraggedId('');
    }
  };

  const assignSprint = async (task: Task, sprint: string) => {
    if (busy) return;
    const tags = [...(task.tags || []).filter(tag => !tag.startsWith('sprint:'))];
    if (sprint !== 'Backlog') tags.push(`sprint:${sprint}`);
    setBusy(true);
    try {
      await taskService.updateTask(task.id, { tags });
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return <div className={`sprint-board ${busy ? 'is-busy' : ''}`}>
    <div className="sprint-board-toolbar">
      <div><strong>Sprints</strong><span>Choose one sprint, then work through its four clear lanes.</span></div>
      <button type="button" onClick={() => void createSprint()}>+ New sprint</button>
    </div>
    {sprintError && <div className="sprint-error" role="alert">{sprintError}</div>}
    <div className="sprint-tabs" role="tablist" aria-label="Sprints">
      {sprints.map(sprint => {
        const count = tasks.filter(task => sprintTag(task) === sprint && task.status !== 'completed' && task.status !== 'cancelled').length;
        return <button type="button" role="tab" aria-selected={selectedSprint === sprint} className={selectedSprint === sprint ? 'active' : ''} key={sprint} onClick={() => selectSprint(sprint)}>{sprint}<span>{count}</span></button>;
      })}
    </div>
    <div className="active-sprint-heading"><div><h2>{selectedSprint}</h2><p>{sprintTasks.length ? `${sprintTasks.length} tasks in this sprint` : 'This sprint is ready. Assign tasks to it from any task card.'}</p></div></div>
    {contexts.map(context => {
      const contextTasks = sprintTasks.filter(task => taskContext(task) === context.id);
      return <section className="sprint-swimlane" key={context.id}>
        <header><h3>{context.label}</h3><span>{contextTasks.length} tasks</span><button type="button" className="swimlane-add-task" onClick={() => onCreate(context.id, selectedSprint)}>+ Custom task</button></header>
        <div className="sprint-columns">
          {columns.map(column => {
            const columnTasks = contextTasks.filter(task => task.status === column.status);
            return <div className="sprint-column" key={column.status} onDragOver={event => event.preventDefault()} onDrop={() => move(context.id, column.status)}>
              <div className="sprint-column-title"><span>{column.label}</span><em>{columnTasks.length}</em></div>
              <div className="sprint-card-list">
                {columnTasks.map(task => <article className={`sprint-task-card urgency-edge-${task.urgency}`} draggable key={task.id} onDragStart={() => setDraggedId(task.id)} onDoubleClick={() => onEdit(task)}>
                  <div className="sprint-card-top"><span className={`task-origin-pill ${isSystemTask(task) ? 'system' : 'custom'}`}>{isSystemTask(task) ? 'System' : 'Custom'}</span><select aria-label={`Move ${task.name} to sprint`} value={selectedSprint} onClick={event => event.stopPropagation()} onChange={event => void assignSprint(task, event.target.value)}>{sprints.map(sprint => <option key={sprint} value={sprint}>{sprint}</option>)}</select></div>
                  <strong title={task.name}>{task.name}</strong>
                  <div><span className={`sprint-priority priority-${task.urgency}`}>{task.urgency}</span><time>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</time></div>
                </article>)}
                {!columnTasks.length && <div className="sprint-empty-column">Drop task here</div>}
              </div>
            </div>;
          })}
        </div>
      </section>;
    })}
  </div>;
};
