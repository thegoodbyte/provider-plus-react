import {
  getBookingStepDefaultColor,
  getBookingStepToneWithColor,
  normalizeBookingStepColor,
} from './bookingStepColors';

describe('booking step color helpers', () => {
  it('normalizes hex colors', () => {
    expect(normalizeBookingStepColor('dbeafe')).toBe('#dbeafe');
    expect(normalizeBookingStepColor('#DDEEFF')).toBe('#ddeeff');
    expect(normalizeBookingStepColor('')).toBe('');
  });

  it('returns a pastel default color for known sections', () => {
    expect(getBookingStepDefaultColor('medical')).toBe('#dcfce7');
    expect(getBookingStepDefaultColor('questionnaires')).toBe('#ede9fe');
    expect(getBookingStepDefaultColor('unknown-section')).toBe('#f1f5f9');
  });

  it('attaches a custom color to a tone', () => {
    const tone = getBookingStepToneWithColor('medical', '#ccfbf1');
    expect(tone.customColor).toBe('#ccfbf1');
  });
});
