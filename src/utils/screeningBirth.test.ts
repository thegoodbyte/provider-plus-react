import { validateScreeningBirth } from './screeningBirth';

describe('partial screening birth dates', () => {
  it.each([[undefined, undefined, undefined], [1990, undefined, undefined], [1990, 2, undefined], [2000, 2, 29]])('accepts known components %s/%s/%s', (year, month, day) => {
    expect(validateScreeningBirth(year, month, day)).toBeUndefined();
  });
  it.each([[1991, 2, 29], [2000, 4, 31], [2000, 13, 1], [2000, 1, 0], [2000, undefined, 1], [undefined, 2, undefined], [2000.5, 2, 1], [new Date().getFullYear()+1, undefined, undefined]])('rejects invalid components %s/%s/%s', (year, month, day) => {
    expect(validateScreeningBirth(year, month, day)).toBeDefined();
  });
});
