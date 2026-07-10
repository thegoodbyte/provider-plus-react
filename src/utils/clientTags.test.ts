import { normalizeClientTag } from './clientTags';

describe('clientTags', () => {
  it('normalizes client tags to safe lowercase slugs', () => {
    expect(normalizeClientTag(' Medically Approved ')).toBe('medically-approved');
    expect(normalizeClientTag('Liver_received')).toBe('liver-received');
    expect(normalizeClientTag('  EKG   RECEIVED  ')).toBe('ekg-received');
  });
});

