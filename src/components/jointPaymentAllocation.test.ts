import { splitPaymentEvenly } from './jointPaymentAllocation';

describe('joint payment allocation', () => {
  it('splits 6,840 PLN evenly between two bookings', () => {
    expect(splitPaymentEvenly(6840, 2)).toEqual([3420, 3420]);
  });

  it('preserves every cent when the total is not evenly divisible', () => {
    const result = splitPaymentEvenly(100, 3);
    expect(result).toEqual([33.34, 33.33, 33.33]);
    expect(result.reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(100);
  });
});
