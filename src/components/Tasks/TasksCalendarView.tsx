import React, { useMemo, useState } from 'react';
import { BookingFlowItem, Client, Retreat, RetreatClient } from '../../types';
import { Task, taskService } from '../../services/taskService';

type CalendarEvent = {
  id: string;
  date: Date;
  title: string;
  subtitle: string;
  kind: 'task' | 'deadline';
  status?: string;
  urgency?: string;
  overdue: boolean;
};

interface TasksCalendarViewProps {
  tasks: Task[];
  deadlines: BookingFlowItem[];
}

const toDateOnly = (value?: string | Date | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const dateKey = (date: Date) => date.toLocaleDateString('en-CA');

const formatShortDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const getClientLabel = (client?: string | Client | any) => {
  if (!client) return '';
  if (typeof client === 'string') return '';
  const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
  const displayId = client.display_id ? `#${client.display_id}` : '';
  return [displayId, name || client.email].filter(Boolean).join(' ');
};

const getRetreatCode = (retreat?: string | Retreat | any) => {
  if (!retreat || typeof retreat === 'string') return '';
  return retreat.code || retreat.retreatCode || retreat.name || '';
};

const getBookingNumber = (booking?: string | RetreatClient | any) => {
  if (!booking || typeof booking === 'string') return '';
  return booking.bookingNumber ? `Booking #${booking.bookingNumber}` : '';
};

const buildEvents = (tasks: Task[], deadlines: BookingFlowItem[]): CalendarEvent[] => {
  const taskEvents = tasks
    .map((task): CalendarEvent | null => {
      const date = toDateOnly(task.dueDate);
      if (!date) return null;
      const clientLabel = getClientLabel(task.clientId);
      const retreatCode = getRetreatCode(task.retreatId);
      return {
        id: `task-${task.id}`,
        date,
        title: task.name,
        subtitle: [clientLabel, retreatCode, task.type].filter(Boolean).join(' - '),
        kind: 'task',
        status: task.status,
        urgency: task.urgency,
        overdue: taskService.isOverdue(task.dueDate || '', task.status),
      };
    })
    .filter(Boolean) as CalendarEvent[];

  const deadlineEvents = deadlines
    .map((item): CalendarEvent | null => {
      const date = toDateOnly(item.dueDate);
      if (!date) return null;
      const booking = typeof item.bookingId === 'object' ? item.bookingId : null;
      const client = item.clientId || booking?.clientId;
      const retreat = item.retreatId || booking?.retreatId;
      return {
        id: `deadline-${item._id || `${item.key}-${dateKey(date)}`}`,
        date,
        title: item.title || item.key || 'Booking deadline',
        subtitle: [getClientLabel(client), getBookingNumber(booking), getRetreatCode(retreat)].filter(Boolean).join(' - '),
        kind: 'deadline',
        status: item.status,
        overdue: taskService.isOverdue(date.toISOString(), item.status || 'pending'),
      };
    })
    .filter(Boolean) as CalendarEvent[];

  return [...taskEvents, ...deadlineEvents].sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
};

const TasksCalendarView: React.FC<TasksCalendarViewProps> = ({ tasks, deadlines }) => {
  const events = useMemo(() => buildEvents(tasks, deadlines), [tasks, deadlines]);
  const firstEventDate = events[0]?.date || new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(firstEventDate.getFullYear(), firstEventDate.getMonth(), 1));

  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });

  const eventsByDay = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      const key = dateKey(event.date);
      acc[key] = [...(acc[key] || []), event];
      return acc;
    }, {});
  }, [events]);

  const monthEvents = events.filter((event) => event.date >= monthStart && event.date <= monthEnd);
  const overdueCount = monthEvents.filter((event) => event.overdue).length;

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div className="tasks-calendar">
      <div className="tasks-calendar-toolbar">
        <div>
          <h2>{visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <p>{monthEvents.length} item(s), {overdueCount} overdue</p>
        </div>
        <div className="tasks-calendar-actions">
          <button type="button" className="btn btn-secondary" onClick={() => moveMonth(-1)}>Previous</button>
          <button type="button" className="btn btn-secondary" onClick={() => setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button>
          <button type="button" className="btn btn-secondary" onClick={() => moveMonth(1)}>Next</button>
        </div>
      </div>

      <div className="tasks-calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="tasks-calendar-weekday">{day}</div>
        ))}
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = eventsByDay[key] || [];
          const outsideMonth = day.getMonth() !== visibleMonth.getMonth();
          const isToday = key === dateKey(new Date());
          return (
            <div key={key} className={`tasks-calendar-day ${outsideMonth ? 'outside-month' : ''} ${isToday ? 'today' : ''}`}>
              <div className="tasks-calendar-day-number">{day.getDate()}</div>
              <div className="tasks-calendar-events">
                {dayEvents.slice(0, 4).map((event) => (
                  <div key={event.id} className={`tasks-calendar-event ${event.kind} ${event.overdue ? 'overdue' : ''}`}>
                    <span className="event-kind">{event.kind === 'deadline' ? 'Deadline' : 'Task'}</span>
                    <span className="event-title">{event.title}</span>
                    {event.subtitle && <span className="event-subtitle">{event.subtitle}</span>}
                    <span className="event-meta">{formatShortDate(event.date)}{event.status ? ` - ${event.status.replace(/_/g, ' ')}` : ''}</span>
                  </div>
                ))}
                {dayEvents.length > 4 && <div className="tasks-calendar-more">+{dayEvents.length - 4} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TasksCalendarView;
