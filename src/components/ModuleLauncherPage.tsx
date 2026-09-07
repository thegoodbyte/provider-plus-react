import React, { useEffect, useMemo, useState } from 'react';
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
  PhoneCall,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TasksForTodayPanel from './TasksForTodayPanel';
import { launcherConfigApi } from '../services/api';
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

const ModuleLauncherPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, 'inner' | 'outer' | 'hidden'>>({});
  const [saving, setSaving] = useState(false);
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
          { id: 'integration', label: 'Integration', subtitle: 'Follow-up calls', route: 'integration', icon: PhoneCall, tone: 'violet' },
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
          { id: 'integration', label: 'Integration', subtitle: 'Follow-up calls', route: 'integration', icon: PhoneCall, tone: 'blue' },
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

  const centerTile = tiles.find((tile) => tile.id === 'clients') || tiles[0];
  const orbitTiles = tiles.filter((tile) => tile !== centerTile);
  useEffect(() => {
    launcherConfigApi.get().then(({ data }) => {
      const saved = Object.fromEntries((data.assignments || []).map((item) => [item.moduleId, item.ring]));
      setAssignmentMap(saved);
    }).catch(() => undefined);
  }, []);
  const innerTiles = orbitTiles.filter((tile, index) => (assignmentMap[tile.id] || (index < 8 ? 'inner' : 'outer')) === 'inner');
  const outerTiles = orbitTiles.filter((tile, index) => (assignmentMap[tile.id] || (index < 8 ? 'inner' : 'outer')) === 'outer');
  const centerIcon = centerTile?.icon;

  const handleTileClick = (route: string) => {
    navigate(`${routePrefix}/${route}`);
  };

  const renderTile = (tile: LauncherTile, index: number, count: number, ring: 'inner' | 'outer') => {
    const Icon = tile.icon;
    return <button key={`${ring}-${tile.id}`} type="button" onClick={() => handleTileClick(tile.route)} className={`launcher-hex launcher-orbit-tile launcher-${ring}-tile tone-${tile.tone}`} style={{ '--launcher-index': index, '--launcher-count': count } as React.CSSProperties} title={`${tile.section} - ${tile.label}`} aria-label={`${tile.section} - ${tile.label}`}>
      <div className="launcher-hex-content"><Icon className="launcher-hex-icon" /><div className="launcher-hex-label">{tile.label}</div>{tile.subtitle && <div className="launcher-hex-subtitle">{tile.subtitle}</div>}</div>
    </button>;
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try { await launcherConfigApi.save(orbitTiles.map((tile, index) => ({ moduleId: tile.id, ring: assignmentMap[tile.id] || (index < 8 ? 'inner' : 'outer') }))); setEditMode(false); } finally { setSaving(false); }
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
        <div className="module-launcher-header-actions"><div className="module-launcher-role">{user?.role || 'admin'}</div>{user?.role === 'admin' && <button type="button" className="module-launcher-edit-button" onClick={() => setEditMode((value) => !value)}>{editMode ? 'Close editor' : 'Edit layout'}</button>}</div>
      </div>

      {editMode && user?.role === 'admin' && <section className="module-launcher-editor"><div><h2>Configure launcher circles</h2><p>Choose where each module appears. Clients remains the center hub.</p></div><div className="module-launcher-editor-grid">{orbitTiles.map((tile, index) => <label key={tile.id}>{tile.label}<select value={assignmentMap[tile.id] || (index < 8 ? 'inner' : 'outer')} onChange={(event) => setAssignmentMap((current) => ({ ...current, [tile.id]: event.target.value as 'inner' | 'outer' | 'hidden' }))}><option value="inner">Inner circle</option><option value="outer">Outer circle</option><option value="hidden">Hidden</option></select></label>)}</div><button type="button" className="module-launcher-save-button" disabled={saving} onClick={saveConfiguration}>{saving ? 'Saving…' : 'Save layout'}</button></section>}

      <TasksForTodayPanel />

      <div className="module-launcher-hive-shell">
        <div className="module-launcher-hive">
          <div className="module-launcher-orbit module-launcher-orbit-outer" aria-hidden="true" />
          <div className="module-launcher-orbit module-launcher-orbit-inner" aria-hidden="true" />
          {centerTile && centerIcon && <button type="button" onClick={() => handleTileClick(centerTile.route)} className={`launcher-hex launcher-center tone-${centerTile.tone}`} title={`${centerTile.section} - ${centerTile.label}`} aria-label={`${centerTile.section} - ${centerTile.label}`}>
            <div className="launcher-hex-content"><centerIcon className="launcher-hex-icon" /><div className="launcher-hex-label">{centerTile.label}</div>{centerTile.subtitle && <div className="launcher-hex-subtitle">{centerTile.subtitle}</div>}</div>
          </button>}
          {innerTiles.map((tile, index) => renderTile(tile, index, innerTiles.length, 'inner'))}
          {outerTiles.map((tile, index) => renderTile(tile, index, outerTiles.length, 'outer'))}
        </div>
      </div>
    </div>
  );
};

export default ModuleLauncherPage;
