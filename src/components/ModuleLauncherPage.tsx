import { NAVIGATION, SETTINGS_LABEL, canShowNavigation, useNavigationPreferences } from '../navigation/navigation';
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
  const [saveError, setSaveError] = useState('');
  const preferences = useNavigationPreferences();
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
          { id: 'retreat-flow', label: NAVIGATION['retreat-flow'].label, subtitle: 'Per-retreat steps', route: 'retreat-flow', icon: LayoutGrid, tone: 'blue' },
          { id: 'retreat-flow-library', label: NAVIGATION['retreat-flow-library'].label, subtitle: 'Master steps', route: 'retreat-flow-library', icon: BookOpen, tone: 'blue' },
          { id: 'announcements', label: NAVIGATION['announcements'].label, subtitle: 'Before and after retreat emails', route: 'announcements', icon: BookOpen, tone: 'blue' },
          { id: 'booking-flow', label: NAVIGATION['booking-flow'].label, subtitle: 'Per booking', route: 'booking-flow', icon: ListTodo, tone: 'blue' },
          { id: 'booking-step-deadlines', label: 'Step Deadlines', subtitle: 'Across retreats', route: 'booking-step-deadlines', icon: CalendarDays, tone: 'blue' },
        ],
      },
      {
        title: 'Flow',
        tone: 'violet',
        tiles: [
          { id: 'workflow', label: NAVIGATION['workflow'].label, subtitle: 'Readiness', route: 'workflow', icon: Workflow, tone: 'violet' },
          { id: 'flow-tasks', label: 'Flow Tasks', subtitle: 'Queue', route: 'flow-tasks', icon: ListTodo, tone: 'violet' },
          { id: 'integration', label: 'Integration', subtitle: 'Follow-up calls', route: 'integration', icon: PhoneCall, tone: 'violet' },
        ],
      },
      {
        title: 'Medical',
        tone: 'emerald',
        tiles: [
          { id: 'medical-dashboard', label: NAVIGATION['medical-dashboard'].label, subtitle: 'Review queue', route: 'medical-dashboard', icon: HeartPulse, tone: 'emerald' },
          { id: 'medical-artifacts', label: NAVIGATION['medical-artifacts'].label, subtitle: 'Stored records', route: 'medical-artifacts', icon: FileText, tone: 'emerald' },
          { id: 'medical-tracking', label: NAVIGATION['medical-tracking'].label, subtitle: 'Per client status', route: 'medical-tracking', icon: Stethoscope, tone: 'emerald' },
          { id: 'medical-review-requests', label: NAVIGATION['medical-review-requests'].label, subtitle: 'Medical reviews', route: 'medical-review-requests', icon: Inbox, tone: 'emerald' },
          { id: 'medical-retreats', label: NAVIGATION['medical-retreats'].label, subtitle: 'Per retreat', route: 'medical-retreats', icon: Activity, tone: 'emerald' },
          { id: 'booking-step-deadlines', label: 'Step Deadlines', subtitle: 'Across retreats', route: 'booking-step-deadlines', icon: CalendarDays, tone: 'emerald' },
        ],
      },
      {
        title: 'Money',
        tone: 'amber',
        tiles: [
          { id: 'payments', label: NAVIGATION['payments'].label, subtitle: 'Ledger', route: 'payments', icon: CreditCard, tone: 'amber' },
          { id: 'payment-requests', label: NAVIGATION['payment-requests'].label, subtitle: 'Requests', route: 'payment-requests', icon: Receipt, tone: 'amber' },
          { id: 'communications', label: NAVIGATION['communications'].label, subtitle: 'Mail', route: 'communications', icon: Mail, tone: 'amber' },
        ],
      },
      {
        title: 'System',
        tone: 'slate',
        tiles: [
          { id: 'reminders', label: 'Reminders', subtitle: 'Automation', route: 'reminders', icon: Bell, tone: 'slate' },
          { id: 'requirements', label: NAVIGATION['requirements'].label, subtitle: 'Retreat rules', route: 'requirements', icon: ClipboardCheck, tone: 'slate' },
          { id: 'client-forms', label: NAVIGATION['client-forms'].label, subtitle: 'Food, meds, questionnaires', route: 'client-forms', icon: NotebookText, tone: 'slate' },
          { id: 'houses', label: NAVIGATION['houses'].label, subtitle: 'Assets', route: 'houses', icon: Building2, tone: 'slate' },
          { id: 'users', label: NAVIGATION['users'].label, subtitle: 'Access', route: 'users', icon: ShieldCheck, tone: 'slate' },
          { id: 'permissions', label: NAVIGATION['permissions'].label, subtitle: 'Roles', route: 'permissions', icon: ShieldCheck, tone: 'slate' },
          { id: 'analytics', label: NAVIGATION['analytics'].label, subtitle: 'Reports', route: 'analytics', icon: Sparkles, tone: 'slate' },
          { id: 'tasks', label: NAVIGATION['tasks'].label, subtitle: 'General queue', route: 'tasks', icon: FileText, tone: 'slate' },
        ],
      },
    ];

    const medicalSections: LauncherSection[] = [
      {
        title: 'Medical',
        tone: 'emerald',
        tiles: [
          { id: 'medical-dashboard', label: NAVIGATION['medical-dashboard'].label, subtitle: 'Queue', route: 'medical-dashboard', icon: HeartPulse, tone: 'emerald' },
          { id: 'medical-artifacts', label: NAVIGATION['medical-artifacts'].label, subtitle: 'Stored records', route: 'medical-artifacts', icon: FileText, tone: 'emerald' },
          { id: 'medical-tracking', label: NAVIGATION['medical-tracking'].label, subtitle: 'Per client status', route: 'medical-tracking', icon: Stethoscope, tone: 'emerald' },
          { id: 'review-requests', label: NAVIGATION['review-requests'].label, subtitle: 'Approvals', route: 'review-requests', icon: Inbox, tone: 'emerald' },
          { id: 'medical-retreats', label: NAVIGATION['medical-retreats'].label, subtitle: 'Context', route: 'medical-retreats', icon: CalendarDays, tone: 'emerald' },
        ],
      },
      {
        title: 'Flow',
        tone: 'violet',
        tiles: [
          { id: 'workflow', label: NAVIGATION['workflow'].label, subtitle: 'Readiness', route: 'workflow', icon: Workflow, tone: 'violet' },
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
          { id: 'retreat-flow', label: NAVIGATION['retreat-flow'].label, subtitle: 'Steps', route: 'retreat-flow', icon: LayoutGrid, tone: 'blue' },
          { id: 'booking-flow', label: NAVIGATION['booking-flow'].label, subtitle: 'Per booking', route: 'booking-flow', icon: ListTodo, tone: 'blue' },
        ],
      },
      {
        title: 'Comms',
        tone: 'amber',
        tiles: [
          { id: 'communications', label: NAVIGATION['communications'].label, subtitle: 'Templates', route: 'communications', icon: Mail, tone: 'amber' },
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
          { id: 'houses', label: NAVIGATION['houses'].label, subtitle: 'Locations', route: 'houses', icon: Building2, tone: 'blue' },
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
          { id: 'communications', label: NAVIGATION['communications'].label, subtitle: 'Mail', route: 'communications', icon: Mail, tone: 'amber' },
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
          { id: 'communications', label: NAVIGATION['communications'].label, subtitle: 'Messages', route: 'communications', icon: Mail, tone: 'blue' },
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
      case 'admin':
        return adminSections;
      default:
        return [];
    }
  }, [user?.role]);

  const tiles = useMemo(() => {
    const existing = sections.flatMap(section => section.tiles.map(tile => ({ ...tile, section: section.title })));
    const additional: LauncherTile[] = [
      { id: 'retreat-flow-library', label: NAVIGATION['retreat-flow-library'].label, route: 'retreat-flow-library', icon: BookOpen, tone: 'slate', section: SETTINGS_LABEL },
      { id: 'booking-document-types', label: NAVIGATION['booking-document-types'].label, route: 'booking-document-types', icon: FileText, tone: 'slate', section: SETTINGS_LABEL },
      { id: 'retreat-staffing', label: NAVIGATION['retreat-staffing'].label, route: 'retreat-staffing', icon: Users, tone: 'blue', section: 'Retreats' },
    ];
    return Array.from(new Map([...existing, ...additional].map(tile => [tile.id, tile])).values())
      .filter(tile => canShowNavigation(tile.id, user?.role, preferences))
      .map(tile => ({ ...tile, label: NAVIGATION[tile.id]?.label || tile.label, subtitle: NAVIGATION[tile.id]?.description || tile.subtitle }));
  }, [sections, user?.role, preferences]);

  useEffect(() => {
    launcherConfigApi.get().then(({ data }) => {
      const saved = Object.fromEntries((data.assignments || []).map((item) => [item.moduleId, item.ring]));
      setAssignmentMap(saved);
    }).catch(() => undefined);
  }, []);
  const isSetup = (tile: LauncherTile) => Boolean(NAVIGATION[tile.id]?.setup);
  const visibleTiles = tiles.filter(tile => assignmentMap[tile.id] !== 'hidden')
    .sort((a, b) => Number(assignmentMap[a.id] === 'outer') - Number(assignmentMap[b.id] === 'outer'));
  const handleTileClick = (route: string) => navigate(`${routePrefix}/${route}`);
  const renderTile = (tile: LauncherTile) => {
    const Icon = tile.icon;
    return <button key={tile.id} type="button" aria-label={tile.label} onClick={() => handleTileClick(tile.route)} className="launcher-shortcut">
      <Icon className="launcher-shortcut-icon" aria-hidden="true" />
      <span><strong>{tile.label}</strong>{tile.subtitle && <small>{tile.subtitle}</small>}</span>
    </button>;
  };
  const saveConfiguration = async () => {
    setSaving(true);
    setSaveError('');
    try {
      // Preserve preferences for hidden/non-visible modules and existing ring values.
      const next = { ...assignmentMap };
      tiles.forEach(tile => { next[tile.id] = next[tile.id] || 'inner'; });
      await launcherConfigApi.save(Object.entries(next).map(([moduleId, ring]) => ({ moduleId, ring })));
      setEditMode(false);
    } catch { setSaveError('Unable to save shortcuts. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="module-launcher-page">
      <div className="module-launcher-header">
        <div className="module-launcher-brand">
          <div className="module-launcher-mark">
            <img src={`${process.env.PUBLIC_URL}/images/icon/retreategnine.png`} alt="RetreatEngine" />
          </div>
          <div>
            <h1>{NAVIGATION.launcher.label}</h1>
            <p>Open daily work or manage application setup.</p>
          </div>
        </div>
        <div className="module-launcher-header-actions"><div className="module-launcher-role">{user?.role || 'admin'}</div>{user?.role === 'admin' && <button type="button" className="module-launcher-edit-button" onClick={() => setEditMode((value) => !value)}>{editMode ? 'Close editor' : 'Customize shortcuts'}</button>}</div>
      </div>

      {editMode && user?.role === 'admin' && <section className="module-launcher-editor"><div><h2>Customize shortcuts</h2><p>Choose primary shortcuts, additional shortcuts or hide items. Configuration stays in Settings & Setup.</p></div><div className="module-launcher-editor-grid">{tiles.map(tile => <label key={tile.id}>{tile.label}<select value={assignmentMap[tile.id] || 'inner'} onChange={(event) => setAssignmentMap((current) => ({ ...current, [tile.id]: event.target.value as 'inner' | 'outer' | 'hidden' }))}><option value="inner">Primary</option><option value="outer">More shortcuts</option><option value="hidden">Hidden</option></select></label>)}</div><button type="button" className="module-launcher-save-button" disabled={saving} onClick={saveConfiguration}>{saving ? 'Saving…' : 'Save shortcuts'}</button></section>}

      <TasksForTodayPanel />

      {saveError && <p role="alert">{saveError}</p>}
      <section className="launcher-area" aria-labelledby="daily-work-title">
        <h2 id="daily-work-title">Daily Work</h2>
        <p>Clients, bookings, retreats and the work that needs your attention.</p>
        <div className="launcher-shortcuts">{visibleTiles.filter(tile => !isSetup(tile)).map(renderTile)}</div>
        {!visibleTiles.some(tile => !isSetup(tile)) && <p>No daily shortcuts are visible.</p>}
      </section>
      {visibleTiles.some(isSetup) && <section className="launcher-area launcher-setup" aria-labelledby="setup-title">
        <h2 id="setup-title">{SETTINGS_LABEL}</h2>
        <p>Reusable steps, document categories and application configuration.</p>
        <div className="launcher-shortcuts">{visibleTiles.filter(isSetup).map(renderTile)}</div>
      </section>}

    </div>
  );
};

export default ModuleLauncherPage;
