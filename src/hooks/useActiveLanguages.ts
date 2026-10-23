import { useEffect, useState } from 'react';
import { languagesApi, LanguageOption } from '../services/api';

export interface LanguageChoice {
  code: string;
  label: string;
}

// The single place every language picker in the app reads its option list
// from -- Settings -> Languages controls what shows up here, nothing is
// hardcoded. languagesApi.getActive() is cached client-side for 5 minutes,
// so mounting this hook in several components at once costs one network
// call, not several.
export function useActiveLanguages(): { options: LanguageChoice[]; isLoading: boolean; error: boolean; reload: () => void } {
  const [options, setOptions] = useState<LanguageChoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision((value) => value + 1);
  useEffect(() => {
    window.addEventListener('languages-updated', reload);
    return () => window.removeEventListener('languages-updated', reload);
  }, []);
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(false);
    languagesApi.getActive()
      .then((response) => {
        if (!active) return;
        setOptions((response.data || []).map((language: LanguageOption) => ({ code: language.code, label: language.name })));
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [revision]);
  return { options, isLoading, error, reload };
}
