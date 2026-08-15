import { buildBookingStepOptions, formatRetreatCalendarDate, isBookingStepComplete, retreatMonthGroup } from './RetreatsGrid.helpers';
import { BookingFlowTemplate } from '../types';

describe('RetreatsGrid helpers', () => {
  it('builds unique booking step options from multiple matrices', () => {
    const contractTemplate: BookingFlowTemplate = {
      key: 'contract_received',
      title: 'Contract received',
      category: 'contract',
      offsetDays: 0,
      order: 2,
      active: true,
    };
    const ekgTemplate: BookingFlowTemplate = {
      key: 'ekg_received',
      title: 'Entry EKG received',
      category: 'medical',
      offsetDays: 0,
      order: 1,
      active: true,
    };
    const options = buildBookingStepOptions([
      {
        templates: [
          contractTemplate,
          ekgTemplate,
        ],
      },
      {
        templates: [
          contractTemplate,
        ],
      },
    ]);

    expect(options.map((option) => option.key)).toEqual(['ekg_received', 'contract_received']);
  });

  it('treats received-style booking step statuses as complete', () => {
    expect(isBookingStepComplete({ status: 'received' })).toBe(true);
    expect(isBookingStepComplete({ status: 'completed' })).toBe(true);
    expect(isBookingStepComplete({ status: 'pending' })).toBe(false);
  });

  it('keeps UTC retreat dates on their stored calendar day', () => {
    expect(formatRetreatCalendarDate('2026-08-22T00:00:00.000Z', { month: 'short', day: 'numeric' })).toBe('Aug 22');
    expect(formatRetreatCalendarDate('2026-08-29T00:00:00.000Z')).toBe('Aug 29, 2026');
    expect(retreatMonthGroup('2026-09-01T00:00:00.000Z')).toEqual({ key: '2026-8', label: 'September 2026' });
  });
});
