import { getBookingStepClient, getBookingStepClientDisplayId, getBookingStepClientEmail, getBookingStepClientId, getBookingStepClientName, getBookingStepClientPhone, getBookingStepNumber, getBookingStepObjectId, getBookingStepPaymentClientId } from './bookingStepIdentity';

describe('bookingStepIdentity', () => {
  it('normalizes string and object identifiers', () => {
    expect(getBookingStepObjectId('abc')).toBe('abc');
    expect(getBookingStepObjectId({ _id: 'mongo' })).toBe('mongo');
    expect(getBookingStepObjectId({ id: 'plain' })).toBe('plain');
    expect(getBookingStepObjectId(null)).toBe('');
  });

  it('resolves populated clients and their names', () => {
    const booking = { _id: 'booking123456', clientId: { _id: 'client', firstName: 'Ada', lastName: 'Lovelace' } };
    expect(getBookingStepClient(booking)).toBe(booking.clientId);
    expect(getBookingStepClientName(booking)).toBe('Ada Lovelace');
    expect(getBookingStepClientId(booking)).toBe('client');
    expect(getBookingStepClient({ clientId: 'client' })).toBeNull();
  });

  it('uses legacy names, email, and safe fallback names', () => {
    expect(getBookingStepClientName({ client: { fname: 'Grace', lname: 'Hopper' } })).toBe('Grace Hopper');
    expect(getBookingStepClientName({ client: { email: 'client@example.com' } })).toBe('client@example.com');
    expect(getBookingStepClientName({ _id: 'booking123456', client: '' })).toBe('Client 123456');
    expect(getBookingStepClientName({ client: 'client123456' })).toBe('Client 123456');
  });

  it('formats booking and client display identifiers', () => {
    expect(getBookingStepNumber({ bookingNumber: 42 })).toBe(42);
    expect(getBookingStepNumber({ displayNumber: 'B-7' })).toBe('B-7');
    expect(getBookingStepNumber({ _id: 'booking123456' })).toBe('123456');
    expect(getBookingStepClientDisplayId({ client: { display_id: 10 } })).toBe('10');
    expect(getBookingStepClientDisplayId({ clientDisplayNumber: 11 })).toBe('11');
  });

  it('resolves contact and payment client details', () => {
    expect(getBookingStepClientEmail({ client: { email: 'a@b.com' }, clientEmail: 'old@b.com' })).toBe('a@b.com');
    expect(getBookingStepClientEmail({ clientEmail: 'old@b.com' })).toBe('old@b.com');
    expect(getBookingStepClientPhone({ client: { phoneCountryCode: '+420', phone: '123' } })).toBe('+420 123');
    expect(getBookingStepClientPhone({ clientPhone: '456' })).toBe('456');
    expect(getBookingStepPaymentClientId({ clientId: { _id: 'payer' } } as any)).toBe('payer');
  });
});
