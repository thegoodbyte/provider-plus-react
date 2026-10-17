import { matchesClientDeepSearch, extractMatchSnippet } from './clientSearch';
import { Client } from '../types';

describe('clientSearch', () => {
  describe('extractMatchSnippet', () => {
    it('returns an empty string when content is empty', () => {
      expect(extractMatchSnippet('', 'test')).toBe('');
    });

    it('returns snippet around the matching term', () => {
      const content = 'Client mentioned occasional cannabis use and previous crack cocaine history ten years ago in rehab';
      const snippet = extractMatchSnippet(content, 'crack', 40);
      expect(snippet.toLowerCase()).toContain('crack');
      expect(snippet.startsWith('…') || snippet.endsWith('…')).toBe(true);
    });
  });

  describe('matchesClientDeepSearch', () => {
    const baseClient: Client = {
      _id: 'client-123',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '+420 777 123 456',
      phoneCountryCode: '+420',
      address: '123 Main St',
      display_id: 1042,
    };

    it('matches by first or last name', () => {
      expect(matchesClientDeepSearch(baseClient, 'Alice').matched).toBe(true);
      expect(matchesClientDeepSearch(baseClient, 'smith').matched).toBe(true);
    });

    it('matches by display_id', () => {
      expect(matchesClientDeepSearch(baseClient, '1042').matched).toBe(true);
    });

    it('matches by email', () => {
      const match = matchesClientDeepSearch(baseClient, 'alice@');
      expect(match.matched).toBe(true);
      expect(match.matchType).toBe('contact');
    });

    it('matches by phone number flexibly', () => {
      const match = matchesClientDeepSearch(baseClient, '777123');
      expect(match.matched).toBe(true);
      expect(match.matchType).toBe('contact');
    });

    it('matches by client.notes', () => {
      const clientWithNote: Client = {
        ...baseClient,
        notes: 'Follow-up regarding dietary adjustments and past crack use',
      };
      const match = matchesClientDeepSearch(clientWithNote, 'crack');
      expect(match.matched).toBe(true);
      expect(match.matchType).toBe('notes');
      expect(match.snippet?.toLowerCase()).toContain('crack');
    });

    it('matches by Note collection records for this client', () => {
      const notes = [
        {
          _id: 'note-1',
          clientId: 'client-123',
          title: 'Intake Call Notes',
          content: 'Discussed past addiction and crack cocaine recovery',
        },
      ];
      const match = matchesClientDeepSearch(baseClient, 'crack', notes);
      expect(match.matched).toBe(true);
      expect(match.matchType).toBe('notes');
      expect(match.label).toBe('Note: Intake Call Notes');
      expect(match.snippet?.toLowerCase()).toContain('crack');
    });

    it('matches by recreationalDrugs field (e.g. crack)', () => {
      const clientWithDrugs: Client = {
        ...baseClient,
        recreationalDrugs: 'Past crack cocaine usage in early 20s, now sober',
      };
      const match = matchesClientDeepSearch(clientWithDrugs, 'crack');
      expect(match.matched).toBe(true);
      expect(match.matchType).toBe('screening');
      expect(match.label).toBe('Screening (drugs)');
      expect(match.snippet?.toLowerCase()).toContain('crack');
    });

    it('matches by nested screeningData fields', () => {
      const clientWithScreeningData: Client = {
        ...baseClient,
        screeningData: {
          drugsHistory: 'Occasional alcohol, tested crack once',
          generalNotes: 'Very motivated for retreat',
        },
      } as any;
      const match = matchesClientDeepSearch(clientWithScreeningData, 'crack');
      expect(match.matched).toBe(true);
      expect(match.matchType).toBe('screening');
      expect(match.snippet?.toLowerCase()).toContain('crack');
    });

    it('matches medical screening conditions', () => {
      const clientWithMedical: Client = {
        ...baseClient,
        heartConditions: 'Mild arrhythmia diagnosed 2021',
      };
      const match = matchesClientDeepSearch(clientWithMedical, 'arrhythmia');
      expect(match.matched).toBe(true);
      expect(match.matchType).toBe('screening');
      expect(match.label).toBe('Screening (heart)');
    });

    it('returns matched=false when nothing matches', () => {
      expect(matchesClientDeepSearch(baseClient, 'nonexistenttermxyz').matched).toBe(false);
    });

    it('returns matched=true when query is empty', () => {
      expect(matchesClientDeepSearch(baseClient, '').matched).toBe(true);
      expect(matchesClientDeepSearch(baseClient, '   ').matched).toBe(true);
    });
  });
});
