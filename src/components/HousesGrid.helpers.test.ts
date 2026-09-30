import { resolveNumberOfRooms } from './HousesGrid.helpers';

describe('resolveNumberOfRooms (PPVC-702)', () => {
  it('prefers the explicit numberOfRooms field when set', () => {
    expect(resolveNumberOfRooms({ numberOfRooms: 5, bedrooms: [{ name: 'A' }, { name: 'B' }] })).toBe(5);
  });

  it('falls back to the legacy numeric bedrooms count', () => {
    expect(resolveNumberOfRooms({ numberOfRooms: undefined, bedrooms: 3 })).toBe(3);
  });

  it('counts the bedrooms array when numberOfRooms is unset -- the regression this guards against', () => {
    expect(resolveNumberOfRooms({ numberOfRooms: undefined, bedrooms: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] })).toBe(3);
  });

  it('returns 0 when there is no usable data', () => {
    expect(resolveNumberOfRooms({ numberOfRooms: undefined, bedrooms: undefined })).toBe(0);
    expect(resolveNumberOfRooms({ numberOfRooms: 0, bedrooms: [] })).toBe(0);
  });
});
