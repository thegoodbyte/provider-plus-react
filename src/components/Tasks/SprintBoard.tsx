import React, { useMemo, useState } from 'react';
import { Task, taskService } from '../../services/taskService';
import './SprintBoard.css';

type Status = Task['status'];
const columns: Array<{ status: Status; label: string }> = [
  { status: 'pending', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'completed', label: 'Done' },
];
const sprintTag = (task: Task) => task.tags?.find((tag) => tag.startsWith('sprint:'))?.slice(7) || 'Backlog';

export const SprintBoard: React.FC<{ tasks: Task[]; onChanged: () => Promise<void>; onEdit: (task: Task) => void }> = ({ tasks, onChanged, onEdit }) => {
  const saved = JSON.parse(localStorage.getItem('task-sprints') || '[]') as string[];
  const [localSprints, setLocalSprints] = useState<string[]>(saved);
  const [draggedId, setDraggedId] = useState('');
  const [busy, setBusy] = useState(false);
  const sprints = useMemo(() => Array.from(new Set(['Backlog', ...localSprints, ...tasks.map(sprintTag)])), [localSprints, tasks]);

  const createSprint = () => {
    const name = window.prompt('Sprint name');
    if (!name?.trim() || sprints.includes(name.trim())) return;
    const next = [...localSprints, name.trim()];
    setLocalSprints(next);
    localStorage.setItem('task-sprints', JSON.stringify(next));
  };
  const move = async (sprint: string, status: Status) => {
    const task = tasks.find((item) => item.id === draggedId);
    if (!task || busy) return;
    const tags = [...(task.tags || []).filter((tag) => !tag.startsWith('sprint:'))];
    if (sprint !== 'Backlog') tags.push(`sprint:${sprint}`);
    setBusy(true);
    try { await taskService.updateTask(task.id, { status, tags } as any); await onChanged(); }
    finally { setBusy(false); setDraggedId(''); }
  };

  return <div className={`sprint-board ${busy ? 'is-busy' : ''}`}>
    <div className="sprint-board-toolbar"><div><strong>Sprint board</strong><span>Drag tasks across lanes or between sprints.</span></div><button type="button" onClick={createSprint}>+ Create sprint</button></div>
    {sprints.map((sprint) => <section className="sprint-swimlane" key={sprint}>
      <header><h3>{sprint}</h3><span>{tasks.filter((task) => sprintTag(task) === sprint && task.status !== 'cancelled').length} tasks</span></header>
      <div className="sprint-columns">
        {columns.map((column) => <div className="sprint-column" key={column.status} onDragOver={(event) => event.preventDefault()} onDrop={() => move(sprint, column.status)}>
          <div className="sprint-column-title"><span>{column.label}</span><em>{tasks.filter((task) => sprintTag(task) === sprint && task.status === column.status).length}</em></div>
          <div className="sprint-card-list">
            {tasks.filter((task) => sprintTag(task) === sprint && task.status === column.status).map((task) => <article className={`sprint-task-card urgency-edge-${task.urgency}`} draggable key={task.id} onDragStart={() => setDraggedId(task.id)} onDoubleClick={() => onEdit(task)}>
              <strong title={task.name}>{task.name}</strong>
              <div><span className={`sprint-priority priority-${task.urgency}`}>{task.urgency}</span><time>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</time></div>
            </article>)}
          </div>
        </div>)}
      </div>
    </section>)}
  </div>;
};
