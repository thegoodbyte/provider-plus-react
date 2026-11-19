import React from 'react';
import { ListPlus, Lock, Maximize2, Minimize2, RefreshCw, Unlock } from 'lucide-react';
import Card, { CardHeader } from './ui/Card';
import Badge from './ui/Badge';
import AppleButton from './AppleButton';

type Props = { viewMode: 'detail' | 'simple'; isEditing: boolean; isFullScreen: boolean; saving: string; message: string; showRequirementsOnly?: boolean; onShowRequirementsOnly?: (value: boolean) => void; onViewMode: (mode: 'detail' | 'simple') => void; onUnlock: () => void; onSaveAndLock: () => void; onFullScreen: () => void; onRefresh: () => void; onGenerate: () => void };

const BookingStepsToolbar: React.FC<Props> = ({ viewMode, isEditing, isFullScreen, saving, message, showRequirementsOnly = false, onShowRequirementsOnly = () => undefined, onViewMode, onUnlock, onSaveAndLock, onFullScreen, onRefresh, onGenerate }) => <>
  <Card><CardHeader className="!mb-0 flex-col xl:flex-row" title="Retreat Readiness"
    subtitle={viewMode === 'detail' ? isEditing ? 'Editing is unlocked. Changes stay unlocked until you explicitly lock readiness.' : 'Read-only mode prevents accidental changes. Unlock editing to update status, date, notes, or actions.' : 'Simple view shows only complete, pending, and problem status by color.'}
    action={<div className="flex flex-wrap items-center gap-2">
      <Badge tone={isEditing ? 'warning' : 'neutral'}>{isEditing ? 'Editing unlocked' : 'Read only'}</Badge>
      <div className="inline-flex rounded-apple border border-apple-gray-200 p-0.5">
        <AppleButton size="sm" variant={viewMode === 'detail' ? 'primary' : 'ghost'} aria-pressed={viewMode === 'detail'} onClick={() => onViewMode('detail')}>Detail</AppleButton>
        <AppleButton size="sm" variant={viewMode === 'simple' ? 'primary' : 'ghost'} aria-pressed={viewMode === 'simple'} onClick={() => onViewMode('simple')}>Simple</AppleButton>
      </div>
      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${showRequirementsOnly ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={showRequirementsOnly} onChange={(event) => onShowRequirementsOnly(event.target.checked)} />Show requirements only</label>
      {viewMode === 'detail' && (isEditing ?
        <AppleButton className="gap-2" onClick={onSaveAndLock} disabled={saving === 'save-all'}><Lock className="h-4 w-4" />{saving === 'save-all' ? 'Saving...' : 'Save & Lock'}</AppleButton> :
        <AppleButton className="gap-2" onClick={onUnlock}><Unlock className="h-4 w-4" />Unlock Editing</AppleButton>)}
      <AppleButton variant="secondary" className="gap-2" onClick={onFullScreen} aria-label={isFullScreen ? 'Exit full screen readiness view' : 'Open full screen readiness view'}>{isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}{isFullScreen ? 'Exit full view' : 'Full view'}</AppleButton>
      <AppleButton variant="secondary" className="gap-2" onClick={onRefresh}><RefreshCw className="h-4 w-4" />Refresh</AppleButton>
      <AppleButton className="gap-2" onClick={onGenerate} disabled={saving === 'generate'} title="Create booking steps that are configured for this retreat but do not exist yet"><ListPlus className={`h-4 w-4 ${saving === 'generate' ? 'animate-pulse' : ''}`} />{saving === 'generate' ? 'Generating...' : 'Generate Missing Steps'}</AppleButton>
    </div>} /></Card>
  {message && <div className={`rounded-md border px-4 py-2 text-sm ${message.startsWith('Unable') ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{message}</div>}
</>;
export default BookingStepsToolbar;
