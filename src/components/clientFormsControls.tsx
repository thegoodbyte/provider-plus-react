import React, { useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';

export const RetreatFilter: React.FC<{ options: string[]; value: string; onChange: (value: string) => void }> = ({ options, value, onChange }) => (
  <Autocomplete options={options} value={value || null} onChange={(_, next) => onChange(next || '')}
    size="small" className="w-full min-w-[240px]" renderInput={(params) => <TextField {...params} label="Retreat" placeholder="All retreats" />} />
);

export function useFormSort<T>(values: Record<string, (row: T) => string | number>) {
  const [sort, setSort] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const header = (title: string) => (
    <th key={title} scope="col" className="px-2 py-3 font-normal" aria-sort={sort?.key === title ? sort.direction : undefined}>
      {values[title] ? <button type="button" className="inline-flex items-center gap-2 text-inherit" onClick={() => setSort({ key: title, direction: sort?.key === title && sort.direction === 'ascending' ? 'descending' : 'ascending' })}>
        {title}<span aria-hidden="true">{sort?.key === title ? sort.direction === 'ascending' ? '↑' : '↓' : '↕'}</span>
      </button> : title}
    </th>
  );
  const sortRows = (rows: T[]) => sort ? [...rows].sort((a, b) => {
    const left = values[sort.key](a);
    const right = values[sort.key](b);
    const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
    return comparison * (sort.direction === 'ascending' ? 1 : -1);
  }) : rows;
  return { header, sortRows };
}

export const answerText = (value: unknown): string => Array.isArray(value) ? value.map(answerText).join(', ') : String(value ?? '—');
export const isEmptyFoodAnswer = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.every(isEmptyFoodAnswer);
  const text = answerText(value).trim().replace(/[.!]+$/, '').toLowerCase();
  return !text || /^(none|n\/a|na|—|–|-|no|not applicable|no allergies|no food allergies|no intolerances|no food intolerances|no foods avoided|no dislikes|no disliked foods|žádné|žádná|nic|brak|nie)$/.test(text);
};
export const highlightFoodAnswer = (key: string, value: unknown) => ['allergies', 'foodIntolerances', 'foodsAvoided', 'foodsDisliked'].includes(key) && !isEmptyFoodAnswer(value);
