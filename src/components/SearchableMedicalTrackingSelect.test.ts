import { getMedicalTrackingOptionLabels } from './SearchableMedicalTrackingSelect';

describe('medical tracking option labels', () => {
  it('uses client, record, type and retreat metadata', () => {
    expect(getMedicalTrackingOptionLabels({
      _id: 'tracking-1', client_id: 'client-1', clientDisplayId: 1032,
      firstName: 'Izabella', lastName: 'Doe', type: 'EKG', display_id: 88,
      retreatName: 'BEN-08-03-26',
    } as any)).toEqual({
      primary: '#1032 Izabella Doe · EKG',
      secondary: 'Medical record #88 · BEN-08-03-26',
    });
  });

  it('makes missing legacy metadata explicit without saying unknown', () => {
    const labels = getMedicalTrackingOptionLabels({ _id: 'abcdef123456', client_id: 'client123456', type: 'Liver' } as any);
    expect(labels.primary).toContain('Client 123456');
    expect(labels.secondary).toBe('Medical record 123456 · No retreat linked');
  });
});
