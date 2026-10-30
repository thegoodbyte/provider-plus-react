import React, { useEffect, useRef } from 'react';
import { Task } from '../../services/taskService';

export function TaskDetails({ task, onClose, onEdit }: { task: Task; onClose: () => void; onEdit: (task: Task) => void }) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="task-details-backdrop" onClick={onClose}>
    <section ref={dialog} className="task-details" role="dialog" aria-modal="true" aria-label="Task details" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <button autoFocus className="btn btn-secondary" onClick={onClose} aria-label="Close task details">Close</button>
      <h2>{task.taskNumber ? `Task #${task.taskNumber}: ` : ''}{task.name}</h2>
      <dl><dt>Status</dt><dd>{task.status.replace('_', ' ')}</dd><dt>Priority</dt><dd>{task.urgency}</dd>
        <dt>Description</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{task.description || 'No description'}</dd>
        {task.dueDate && <><dt>Due</dt><dd>{new Date(task.dueDate).toLocaleString()}</dd></>}
        {task.notes && <><dt>Notes</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{task.notes}</dd></>}
        {task.assignedTo && <><dt>Assigned to</dt><dd>{task.assignedTo}</dd></>}
      </dl>
      {!task.supportReference && <button className="btn btn-primary" onClick={() => { onClose(); onEdit(task); }}>Edit task</button>}
    </section>
  </div>;
}
