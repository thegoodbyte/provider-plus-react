import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  HeartPulse,
  Inbox,
  LayoutGrid,
  Mail,
  NotebookText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Workflow,
  Receipt,
  ClipboardPaste,
  ListTodo,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './ModuleLauncherPage.css';

type LauncherTile = {
  id: string;
  label: string;
  subtitle?: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';
  section: string;
};

type LauncherSection = {
  title: string;
  tone: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'slate';
  tiles: Omit<LauncherTile, 'section'>[];
};

type LauncherRow = {
  tiles: LauncherTile[];
  offset: number;
};

const getRoutePrefix = (pathname: string, role?: string) => {
  if (role === 'admin') return '/admin';
  if (pathname.startsWith('/medical/')) return '/medical';
  if (pathname.startsWith('/staff/')) return '/staff';
  if (pathname.startsWith('/user/')) return '/user';
  if (pathname.startsWith('/admin/')) return '/admin';
  switch (role) {
    case 'medical_staff':
    case 'medical_advisor':
      return '/medical';
    case 'facilitator':
      return '/staff';
    case 'user':
      return '/user';
    default:
      return '/admin';
  }
};

const buildRows = (tiles: LauncherTile[]): LauncherRow[] => {
  const count = tiles.length;
  const patterns: Record<number, number[]> = {
    24: [1, 2, 3, 4, 5, 4, 3, 2],
    23: [1, 2, 3, 4, 5, 4, 3, 1],
    14: [2, 3, 4, 3, 2],
    13: [1, 2, 3, 4, 3],
    12: [1, 2, 3, 4, 2],
    8: [1, 2, 3, 2],
    7: [1, 2, 2, 2],
    3: [1, 2],
  };

  const pattern = patterns[count] ?? (() => {
    const rows: number[] = [];
    let remaining = count;
    let width = 1;

    while (remaining > 0) {
      const nextWidth = Math.min(width, remaining);
      rows.push(nextWidth);
      remaining -= nextWidth;
      if (remaining <= 0) {
        break;
      }
      if (nextWidth === width && width < 5) {
        width += 1;
      } else if (remaining < width) {
        width = remaining;
      }
    }

    return rows;
  })();

  const rows: LauncherRow[] = [];
  let index = 0;

  pattern.forEach((rowLength, rowIndex) => {
    rows.push({
      tiles: tiles.slice(index, index + rowLength),
      offset: rowIndex % 2,
    });
    index += rowLength;
  });

  if (index < tiles.length) {
    rows.push({
      tiles: tiles.slice(index),
      offset: rows.length % 2,
    });
  }

  return rows.filter((row) => row.tiles.length > 0);
};

const ModuleLauncherPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const routePrefix = useMemo(() => getRoutePrefix(location.pathname, user?.role), [location.pathname, user?.role]);

  const sections = useMemo<LauncherSection[]>(() => {
    const adminSections: LauncherSection[] = [
      {
        title: 'Core',
        tone: 'blue',
        tiles: [
          { id: 'clients', label: 'Clients', subtitle: 'CRM', route: 'clients', icon: Users, tone: 'blue' },
          { id: 'potential-clients', label: 'Potential', subtitle: 'Filtered clients', route: 'clients?filter=leads', icon: ClipboardList, tone: 'blue' },
          { id: 'retreats', label: 'Retreats', subtitle: 'Programs', route: 'retreats', icon: CalendarDays, tone: 'blue' },
          { id: 'bookings', label: 'Bookings', subtitle: 'Retreat seats', route: 'bookings', icon: ClipboardPaste, tone: 'blue' },
          { id: 'retreat-flow', label: 'Readiness Setup', subtitle: 'Per-retreat steps', route: 'retreat-flow', icon: LayoutGrid, tone: 'blue' },
          { id: 'retreat-flow-library', label: 'Booking Step Setup', subtitle: 'Master steps', route: 'retreat-flow-library', icon: BookOpen, tone: 'blue' },
          { id: 'booking-flow', label: 'Booking Flow', subtitle: 'Per booking', route: 'booking-flow', icon: ListTodo, tone: 'blue' },
          { id: 'booking-step-deadlines', label: 'Step Deadlines', subtitle: 'Across retreats', route: 'booking-step-deadlines', icon: CalendarDays, tone: 'blue' },
        ],
      },
      {
        title: 'Flow',
        tone: 'violet',
        tiles: [
          { id: 'workflow', label: 'Workflow', subtitle: 'Readiness', route: 'workflow', icon: Workflow, tone: 'violet' },
          { id: 'flow-tasks', label: 'Flow Tasks', subtitle: 'Queue', route: 'flow-tasks', icon: ListTodo, tone: 'violet' },
        ],
      },
      {
        title: 'Medical',
        tone: 'emerald',
        tiles: [
          { id: 'medical-dashboard', label: 'Dashboard', subtitle: 'Review queue', route: 'medical-dashboard', icon: HeartPulse, tone: 'emerald' },
          { id: 'medical-artifacts', label: 'Artifacts', subtitle: 'Stored records', route: 'medical-artifacts', icon: FileText, tone: 'emerald' },
          { id: 'medical-tracking', label: 'Readiness', subtitle: 'Per client status', route: 'medical-tracking', icon: Stethoscope, tone: 'emerald' },
          { id: 'medical-review-requests', label: 'Review Requests', subtitle: 'Medical reviews', route: 'medical-review-requests', icon: Inbox, tone: 'emerald' },
          { id: 'medical-retreats', label: 'Medical Retreats', subtitle: 'Per retreat', route: 'medical-retreats', icon: Activity, tone: 'emerald' },
          { id: 'booking-step-deadlines', label: 'Step Deadlines', subtitle: 'Across retreats', route: 'booking-step-deadlines', icon: CalendarDays, tone: 'emerald' },
        ],
      },
      {
        title: 'Money',
        tone: 'amber',
        tiles: [
          { id: 'payments', label: 'Payments', subtitle: 'Ledger', route: 'payments', icon: CreditCard, tone: 'amber' },
          { id: 'payment-requests', label: 'Invoices', subtitle: 'Requests', route: 'payment-requests', icon: Receipt, tone: 'amber' },
          { id: 'communications', label: 'Comms', subtitle: 'Mail', route: 'communications', icon: Mail, tone: 'amber' },
        ],
      },
      {
        title: 'System',
        tone: 'slate',
        tiles: [
          { id: 'reminders', label: 'Reminders', subtitle: 'Automation', route: 'reminders', icon: Bell, tone: 'slate' },
          { id: 'requirements', label: 'Requirements', subtitle: 'Retreat rules', route: 'requirements', icon: ClipboardCheck, tone: 'slate' },
          { id: 'client-forms', label: 'Client Forms', subtitle: 'Food, meds, questionnaires', route: 'client-forms', icon: NotebookText, tone: 'slate' },
          { id: 'houses', label: 'Houses', subtitle: 'Assets', route: 'houses', icon: Building2, tone: 'slate' },
          { id: 'users', label: 'Users', subtitle: 'Access', route: 'users', icon: ShieldCheck, tone: 'slate' },
          { id: 'permissions', label: 'Permissions', subtitle: 'Roles', route: 'permissions', icon: ShieldCheck, tone: 'slate' },
          { id: 'analytics', label: 'Analytics', subtitle: 'Reports', route: 'analytics', icon: Sparkles, tone: 'slate' },
          { id: 'tasks', label: 'Tasks', subtitle: 'General queue', route: 'tasks', icon: FileText, tone: 'slate' },
        ],
      },
    ];

    const medicalSections: LauncherSection[] = [
      {
        title: 'Medical',
        tone: 'emerald',
        tiles: [
          { id: 'medical-dashboard', label: 'Dashboard', subtitle: 'Queue', route: 'medical-dashboard', icon: HeartPulse, tone: 'emerald' },
          { id: 'medical-artifacts', label: 'Artifacts', subtitle: 'Stored records', route: 'medical-artifacts', icon: FileText, tone: 'emerald' },
          { id: 'medical-tracking', label: 'Readiness', subtitle: 'Per client status', route: 'medical-tracking', icon: Stethoscope, tone: 'emerald' },
          { id: 'review-requests', label: 'Review Requests', subtitle: 'Approvals', route: 'review-requests', icon: Inbox, tone: 'emerald' },
          { id: 'medical-retreats', label: 'Retreats', subtitle: 'Context', route: 'medical-retreats', icon: CalendarDays, tone: 'emerald' },
        ],
      },
      {
        title: 'Flow',
        tone: 'violet',
        tiles: [
          { id: 'workflow', label: 'Workflow', subtitle: 'Readiness', route: 'workflow', icon: Workflow, tone: 'violet' },
          { id: 'flow-tasks', label: 'Flow Tasks', subtitle: 'Queue', route: 'flow-tasks', icon: ListTodo, tone: 'violet' },
        ],
      },
      {
        title: 'People',
        tone: 'blue',
        tiles: [
          { id: 'clients', label: 'Clients', subtitle: 'CRM', route: 'clients', icon: Users, tone: 'blue' },
          { id: 'potential-clients', label: 'Potential', subtitle: 'Filtered clients', route: 'clients?filter=leads', icon: ClipboardList, tone: 'blue' },
          { id: 'bookings', label: 'Bookings', subtitle: 'Booking list', route: 'bookings', icon: ClipboardPaste, tone: 'blue' },
          { id: 'retreat-flow', label: 'Readiness Setup', subtitle: 'Steps', route: 'retreat-flow', icon: LayoutGrid, tone: 'blue' },
          { id: 'booking-flow', label: 'Booking Flow', subtitle: 'Per booking', route: 'booking-flow', icon: ListTodo, tone: 'blue' },
        ],
      },
      {
        title: 'Comms',
        tone: 'amber',
        tiles: [
          { id: 'communications', label: 'Communications', subtitle: 'Templates', route: 'communications', icon: Mail, tone: 'amber' },
          { id: 'reminders', label: 'Reminders', subtitle: 'Follow-up', route: 'reminders', icon: Bell, tone: 'amber' },
        ],
      },
    ];

    const facilitatorSections: LauncherSection[] = [
      {
        title: 'Planning',
        tone: 'blue',
        tiles: [
          { id: 'bookings', label: 'Bookings', subtitle: 'Seats', route: 'bookings', icon: ClipboardPaste, tone: 'blue' },
          { id: 'retreats', label: 'Retreats', subtitle: 'Programs', route: 'retreats', icon: CalendarDays, tone: 'blue' },
          { id: 'houses', label: 'Houses', subtitle: 'Locations', route: 'houses', icon: Building2, tone: 'blue' },
        ],
      },
      {
        title: 'People',
        tone: 'violet',
        tiles: [
          { id: 'clients', label: 'Clients', subtitle: 'CRM', route: 'clients', icon: Users, tone: 'violet' },
          { id: 'potential-clients', label: 'Potential', subtitle: 'Filtered clients', route: 'clients?filter=leads', icon: ClipboardList, tone: 'violet' },
        ],
      },
      {
        title: 'Ops',
        tone: 'amber',
        tiles: [
          { id: 'reminders', label: 'Reminders', subtitle: 'Tasks', route: 'reminders', icon: Bell, tone: 'amber' },
          { id: 'communications', label: 'Communications', subtitle: 'Mail', route: 'communications', icon: Mail, tone: 'amber' },
        ],
      },
    ];

    const userSections: LauncherSection[] = [
      {
        title: 'My Area',
        tone: 'blue',
        tiles: [
          { id: 'clients', label: 'Clients', subtitle: 'Profile', route: 'clients', icon: Users, tone: 'blue' },
          { id: 'reminders', label: 'Reminders', subtitle: 'Follow-up', route: 'reminders', icon: Bell, tone: 'blue' },
          { id: 'communications', label: 'Communications', subtitle: 'Messages', route: 'communications', icon: Mail, tone: 'blue' },
        ],
      },
    ];

    switch (user?.role) {
      case 'medical_staff':
      case 'medical_advisor':
        return medicalSections;
      case 'facilitator':
        return facilitatorSections;
      case 'user':
        return userSections;
      default:
        return adminSections;
    }
  }, [user?.role]);

  const tiles = useMemo(
    () =>
      sections.flatMap((section) =>
        section.tiles.map((tile) => ({
          ...tile,
          section: section.title,
        })),
      ),
    [sections],
  );

  const rows = useMemo(() => buildRows(tiles), [tiles]);
  const maxRowLength = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.tiles.length), 1),
    [rows],
  );

  const handleTileClick = (route: string) => {
    navigate(`${routePrefix}/${route}`);
  };

  return (
    <div className="module-launcher-page">
      <div className="module-launcher-header">
        <div className="module-launcher-brand">
          <div className="module-launcher-mark">
            <img src={`${process.env.PUBLIC_URL}/images/icon/retreategnine.png`} alt="RetreatEngine" />
          </div>
          <div>
            <h1>Module Launcher</h1>
            <p>Pick the section you need.</p>
          </div>
        </div>
        <div className="module-launcher-role">{user?.role || 'admin'}</div>
      </div>

      <div className="module-launcher-hive-shell">
        <div
          className="module-launcher-hive"
          style={
            {
              '--launcher-row-count': rows.length,
              '--launcher-max-row-length': maxRowLength,
            } as React.CSSProperties
          }
        >
          {rows.map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              className="module-launcher-row"
              style={
                {
                  '--launcher-row-index': rowIndex,
                  '--launcher-row-length': row.tiles.length,
                  '--launcher-row-offset': row.offset,
                } as React.CSSProperties
              }
            >
              {row.tiles.map((tile, tileIndex) => {
                const Icon = tile.icon;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => handleTileClick(tile.route)}
                    className={`launcher-hex ${tile.tone === 'blue' ? 'tone-blue' : ''} ${tile.tone === 'violet' ? 'tone-violet' : ''} ${tile.tone === 'emerald' ? 'tone-emerald' : ''} ${tile.tone === 'amber' ? 'tone-amber' : ''} ${tile.tone === 'rose' ? 'tone-rose' : ''} ${tile.tone === 'slate' ? 'tone-slate' : ''}`}
                    style={
                      {
                        '--launcher-col-index': tileIndex,
                        clipPath: 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)',
                      } as React.CSSProperties
                    }
                    title={`${tile.section} - ${tile.label}`}
                    aria-label={`${tile.section} - ${tile.label}`}
                  >
                    <div className="launcher-hex-content">
                      <Icon className="launcher-hex-icon" />
                      <div className="launcher-hex-label">{tile.label}</div>
                      {tile.subtitle && <div className="launcher-hex-subtitle">{tile.subtitle}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModuleLauncherPage;
