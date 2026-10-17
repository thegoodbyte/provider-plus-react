import { useEffect, useState } from 'react';
import { housesApi } from '../services/api';
import { House, Retreat } from '../types';

export default function useBookingHouse(retreat?: Retreat) {
  const source = retreat?.houseId;
  const id = typeof source === 'string' ? source : source?._id;
  const key = `${retreat?._id || ''}:${id || ''}`;
  const sourceSignature = JSON.stringify(source || null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; house?: House; loading: boolean; error: string }>({ key: '', loading: false, error: '' });
  useEffect(() => {
    let active = true;
    if (!source) { setState({ key, loading: false, error: '' }); return; }
    if (!id) { setState({ key, loading: false, error: 'This retreat’s house reference is incomplete.' }); return; }
    if (typeof source === 'object' && Array.isArray(source.bedrooms)) {
      setState({ key, house: source, loading: false, error: '' }); return;
    }
    setState({ key, loading: true, error: '' });
    housesApi.getOne(id).then(({ data }) => {
      if (!active) return;
      if (!data || data._id !== id) throw new Error('House could not be resolved');
      setState({ key, house: data, loading: false, error: '' });
    }).catch(() => { if (active) setState({ key, loading: false, error: 'Could not load bedrooms for this retreat’s house.' }); });
    return () => { active = false; };
  }, [sourceSignature, key, attempt]);
  const current = state.key === key ? state : { loading: Boolean(source), error: '', house: undefined };
  return { house: current.house, loading: current.loading, error: current.error, retry: () => setAttempt(n => n + 1) };
}
