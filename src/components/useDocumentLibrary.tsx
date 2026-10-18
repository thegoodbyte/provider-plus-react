import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingDocumentsApi } from '../services/api';
import { BookingDocumentType } from '../types';
export type DocumentLibrary = 'documents' | 'medical';
const key = (value?: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
export function isInDocumentLibrary(type: string | undefined, library: DocumentLibrary, types: BookingDocumentType[]) {
  const normalized = key(type);
  const configured = types.find(item => key(item.key) === normalized)
    || types.find(item => key(item.medicalArtifactType) === normalized);
  // Unregistered types remain visible in their original library.
  return !configured || !configured.libraryPlacement || configured.libraryPlacement === 'both' || configured.libraryPlacement === library;
}
export function useDocumentLibrary(library: DocumentLibrary) {
  const [types,setTypes] = useState<BookingDocumentType[] | null>(null);
  const [error,setError] = useState('');
  const [includeOther,setIncludeOther] = useState(false);
  const reload = useCallback(async () => {
    setError('');
    try { const response=await bookingDocumentsApi.getTypes(true); setTypes(response.data); }
    catch { setError('Library placement settings could not be loaded. Retry, or include all stored records below.'); setTypes(null); }
  },[]);
  useEffect(()=>{void reload();},[reload]);
  const visible = useCallback((type?:string)=>includeOther || (types!==null && isInDocumentLibrary(type,library,types)),[includeOther,types,library]);
  return {types,visible,reload,error,loading:types===null&&!error,includeOther,setIncludeOther};
}
export function DocumentLibraryControls({library}: {library:ReturnType<typeof useDocumentLibrary>}) {
  return <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
    <Link className="font-semibold text-blue-700 underline" to="/admin/booking-document-types">Manage document types &amp; library placement</Link>
    <label className="flex items-center gap-2"><input type="checkbox" checked={library.includeOther} onChange={event=>library.setIncludeOther(event.target.checked)}/>Include records assigned to the other library</label>
    {library.loading&&<span role="status">Loading library settings…</span>}
    {library.error&&<><span role="alert" className="text-red-700">{library.error}</span><button type="button" onClick={()=>void library.reload()}>Retry library settings</button></>}
  </div>;
}
