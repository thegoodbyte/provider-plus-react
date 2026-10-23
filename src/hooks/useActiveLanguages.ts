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
export function useActiveLanguages(): { options: LanguageChoice[]; isLoading: boolean } {
  const [options, setOptions] = useState<LanguageChoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    languagesApi.getActive()
      .then((response) => {
        if (!active) return;
        setOptions((response.data || []).map((language: LanguageOption) => ({ code: language.code, label: language.name })));
      })
      .catch(() => { if (active) setOptions([]); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  return { options, isLoading };
}
