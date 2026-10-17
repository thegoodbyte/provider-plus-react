import { getHelperSlots, getStaffColumns, getColumnStaff, nextHelperRole } from './retreatStaffSlots';

describe('retreat helper columns', () => {
  it('keeps the two original helper columns when no third helper exists', () => {
    expect(getStaffColumns([[]]).map(column => column.label)).toEqual(['Cook', 'Helper 1', 'Helper 2']);
  });
  it('reserves explicit helper roles independently of assignment order', () => {
    const assignments = [{ role: 'third_helper', name: 'Three' }, { role: 'helper', name: 'One' }, { role: 'second_helper', name: 'Two' }];
    expect(getHelperSlots(assignments).map(person => person?.name)).toEqual(['One', 'Two', 'Three']);
    expect(getStaffColumns([assignments]).map(column => column.label)).toContain('Helper 3');
  });
  it('gives repeated legacy helper roles separate columns without losing any people', () => {
    const assignments = [{ name: 'One' }, { role: 'helper', name: 'Three' }, { role: 'second_helper', name: 'Two' }, { role: 'helper', name: 'Four' }];
    expect(getHelperSlots(assignments).map(person => person?.name)).toEqual(['One', 'Two', 'Three', 'Four']);
    expect(getStaffColumns([assignments])).toHaveLength(5);
    expect(getColumnStaff(assignments, 3)[0].name).toBe('Four');
  });
  it('keeps empty helper slots and multiple cooks separate', () => {
    const assignments = [{ role: 'third_helper', name: 'Three' }, { role: 'cook', name: 'Cook A' }, { role: 'cook', name: 'Cook B' }];
    expect(getColumnStaff(assignments, 0)).toEqual([]);
    expect(getColumnStaff(assignments, -1).map(person => person.name)).toEqual(['Cook A', 'Cook B']);
    expect(nextHelperRole(assignments)).toBe('helper');
    expect(nextHelperRole([{ role: 'helper' }, { role: 'second_helper' }])).toBe('third_helper');
  });
});
