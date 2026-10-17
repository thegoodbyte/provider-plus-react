import { Client } from '../types';
import { matchesPhoneSearch } from './phoneUtils';

export interface ClientSearchMatch {
  matched: boolean;
  matchType?: 'name' | 'contact' | 'notes' | 'screening' | 'medical' | 'other';
  label?: string;
  snippet?: string;
}

export interface ClientNoteLike {
  _id?: string;
  clientId?: any;
  title?: string;
  content?: string;
  tags?: string[];
}

export function extractMatchSnippet(content: string, term: string, maxLen = 60): string {
  if (!content || !term) return '';
  const lowerContent = content.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const index = lowerContent.indexOf(lowerTerm);
  if (index === -1) return content.slice(0, maxLen);

  const start = Math.max(0, index - Math.floor((maxLen - term.length) / 2));
  const end = Math.min(content.length, start + maxLen);
  let snippet = content.slice(start, end).trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < content.length) snippet = `${snippet}…`;
  return snippet;
}

function searchNestedStrings(obj: any, term: string, prefix = ''): { key: string; value: string } | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      if (v.toLowerCase().includes(term)) {
        return { key: prefix ? `${prefix}.${k}` : k, value: v };
      }
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const nested = searchNestedStrings(v, term, prefix ? `${prefix}.${k}` : k);
      if (nested) return nested;
    }
  }
  return null;
}

function humanizeScreeningKey(key: string): string {
  const lastPart = key.split('.').pop() || key;
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Deep search a client record across:
 * 1. Name, preferred name, display ID
 * 2. Email, phone (flexible formatting)
 * 3. Client notes (`client.notes`)
 * 4. Linked Note documents from Note collection
 * 5. Screening fields (`recreationalDrugs`, `whySeekingIboga`, `currentMedications`, etc.)
 * 6. Nested arbitrary strings inside `screeningData`
 * 7. Medical conditions, allergies, dietary, location
 */
export function matchesClientDeepSearch(
  client: Client | null | undefined,
  searchTerm: string,
  allNotes?: ClientNoteLike[]
): ClientSearchMatch {
  if (!client) return { matched: false };
  const query = (searchTerm || '').trim();
  if (!query) return { matched: true };

  const term = query.toLowerCase();

  // 1. Core identification: Name & display ID
  const fullName = `${client.firstName || ''} ${client.lastName || ''}`.trim().toLowerCase();
  const preferredName = (client.preferredName || '').toLowerCase();
  const displayIdStr = client.display_id ? String(client.display_id) : '';

  if (
    fullName.includes(term) ||
    (client.firstName && client.firstName.toLowerCase().includes(term)) ||
    (client.lastName && client.lastName.toLowerCase().includes(term)) ||
    preferredName.includes(term) ||
    displayIdStr === term ||
    (displayIdStr && displayIdStr.includes(term))
  ) {
    return { matched: true, matchType: 'name' };
  }

  // 2. Contact: Email & Phone
  if (client.email && client.email.toLowerCase().includes(term)) {
    return { matched: true, matchType: 'contact', label: 'Email', snippet: client.email };
  }

  if (matchesPhoneSearch(client.phone, client.phoneCountryCode, term)) {
    return { matched: true, matchType: 'contact', label: 'Phone', snippet: client.phone };
  }

  // 3. Client top-level notes
  if (client.notes && client.notes.toLowerCase().includes(term)) {
    return {
      matched: true,
      matchType: 'notes',
      label: 'Note',
      snippet: extractMatchSnippet(client.notes, term),
    };
  }

  // 4. Notes collection entries (Note model)
  if (allNotes && allNotes.length > 0 && client._id) {
    const clientIdStr = String(client._id);
    for (const note of allNotes) {
      const noteClientId = note.clientId?._id ? String(note.clientId._id) : String(note.clientId || '');
      if (noteClientId === clientIdStr) {
        if (note.title && note.title.toLowerCase().includes(term)) {
          return {
            matched: true,
            matchType: 'notes',
            label: `Note: ${note.title}`,
            snippet: note.content ? extractMatchSnippet(note.content, term) : note.title,
          };
        }
        if (note.content && note.content.toLowerCase().includes(term)) {
          return {
            matched: true,
            matchType: 'notes',
            label: note.title ? `Note: ${note.title}` : 'Note',
            snippet: extractMatchSnippet(note.content, term),
          };
        }
        if (note.tags && note.tags.some((t) => t.toLowerCase().includes(term))) {
          return {
            matched: true,
            matchType: 'notes',
            label: 'Note Tag',
            snippet: note.tags.find((t) => t.toLowerCase().includes(term)) || '',
          };
        }
      }
    }
  }

  // 5. Screening substance & recreational drugs
  if (client.recreationalDrugs && client.recreationalDrugs.toLowerCase().includes(term)) {
    return {
      matched: true,
      matchType: 'screening',
      label: 'Screening (drugs)',
      snippet: extractMatchSnippet(client.recreationalDrugs, term),
    };
  }

  // 6. Medical and psychological screening fields
  const screeningFields: Array<{ key: keyof Client; label: string }> = [
    { key: 'currentMedications', label: 'Screening (medications)' },
    { key: 'medicalConditions', label: 'Medical conditions' },
    { key: 'whySeekingIboga', label: 'Screening (intent)' },
    { key: 'whatToChange', label: 'Screening (goals)' },
    { key: 'previousPlantMedicines', label: 'Screening (plant medicines)' },
    { key: 'addictionHistory', label: 'Screening (addiction)' },
    { key: 'mentalHealthHistory', label: 'Screening (mental health)' },
    { key: 'traumaHistory', label: 'Screening (trauma)' },
    { key: 'childhood', label: 'Screening (childhood)' },
    { key: 'heartConditions', label: 'Screening (heart)' },
    { key: 'liverConditions', label: 'Screening (liver)' },
    { key: 'asthmaConditions', label: 'Screening (asthma)' },
    { key: 'bloodPressureIssues', label: 'Screening (blood pressure)' },
    { key: 'otherMedicalComplications', label: 'Screening (medical)' },
    { key: 'alcoholConsumption', label: 'Screening (alcohol)' },
    { key: 'suicidalThoughts', label: 'Screening (mental health)' },
    { key: 'hospitalizations', label: 'Screening (hospitalizations)' },
    { key: 'allergies', label: 'Allergies' },
    { key: 'dietaryRestrictions', label: 'Dietary' },
    { key: 'specialRequests', label: 'Special requests' },
    { key: 'rejectionReason', label: 'Rejection reason' },
    { key: 'blacklistReason', label: 'Blacklist reason' },
  ];

  for (const { key, label } of screeningFields) {
    const val = client[key];
    if (typeof val === 'string' && val.toLowerCase().includes(term)) {
      return {
        matched: true,
        matchType: 'screening',
        label,
        snippet: extractMatchSnippet(val, term),
      };
    }
  }

  // 7. Recursive check in client.screeningData
  const screeningData = (client as any).screeningData;
  if (screeningData && typeof screeningData === 'object') {
    const found = searchNestedStrings(screeningData, term);
    if (found) {
      return {
        matched: true,
        matchType: 'screening',
        label: `Screening (${humanizeScreeningKey(found.key)})`,
        snippet: extractMatchSnippet(found.value, term),
      };
    }
  }

  // 8. Other profile fields
  const profileFields: Array<{ key: keyof Client; label: string }> = [
    { key: 'city', label: 'City' },
    { key: 'country', label: 'Country' },
    { key: 'address', label: 'Address' },
    { key: 'occupation', label: 'Occupation' },
    { key: 'source', label: 'Source' },
  ];
  for (const { key, label } of profileFields) {
    const val = client[key];
    if (typeof val === 'string' && val.toLowerCase().includes(term)) {
      return {
        matched: true,
        matchType: 'other',
        label,
        snippet: extractMatchSnippet(val, term),
      };
    }
  }

  return { matched: false };
}
