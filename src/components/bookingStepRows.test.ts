import { buildBookingStepRows, filterBookingStepRowGroups, groupBookingStepRows, numberBookingStepRows, searchBookingStepRows } from './bookingStepRows';

describe('bookingStepRows', () => {
  const templates: any[] = [
    { _id: 't2', key: 'later', title: 'Later', order: 2, category: 'forms', readinessGroup: 'forms', readinessGroupColor: '#abc', emailEnabled: true, emailTemplateId: 'email' },
    { _id: 't1', key: 'first', title: 'First', order: 1, category: 'medical', readinessGroup: 'medical' },
  ];

  it('builds sorted template rows and overlays generated items', () => {
    const rows = buildBookingStepRows(templates as any, [
      { key: 'later', title: 'Updated later', order: 3, category: 'forms', templateId: 't2', emailEnabled: false },
      { key: 'extra', title: 'Extra', order: 2, category: 'other', templateId: { _id: 'embedded', category: 'other', emailEnabled: true } },
    ] as any);
    expect(rows.map((row) => row.key)).toEqual(['first', 'extra', 'later']);
    expect(rows[1]).toMatchObject({ templateId: 'embedded', emailEnabled: true });
    expect(rows[2]).toMatchObject({ title: 'Updated later', templateId: 't2', emailEnabled: true, emailTemplateId: 'email' });
  });

  it('drops a row entirely once its template is deactivated, even when some bookings still have a live item for it', () => {
    // Regression: deactivating a template ("Contract sent") only ever
    // stopped new bookings from generating it. Existing bookings' items
    // for that key stuck around, and this row builder kept manufacturing
    // a row for them straight from those items regardless of the
    // template's current active flag -- so the step never actually left
    // the Steps Matrix.
    const rows = buildBookingStepRows(
      [{ key: 'contract_sent', title: 'Contract sent', order: 3, category: 'contract', active: false } as any],
      [{ key: 'contract_sent', title: 'Contract sent', order: 3, category: 'contract', templateId: { _id: 't3', active: false } }] as any,
    );
    expect(rows.map((row) => row.key)).not.toContain('contract_sent');
  });

  it('still shows a row for a fully custom item with no template reference at all', () => {
    const rows = buildBookingStepRows([], [{ key: 'manual-note', title: 'Manual note', order: 1 }] as any);
    expect(rows.map((row) => row.key)).toEqual(['manual-note']);
  });

  it('sorts equal-order rows by title and accepts string item template ids', () => {
    const rows = buildBookingStepRows([], [{ key: 'z', title: 'Zulu', order: 0, templateId: 'z-id' }, { key: 'a', title: 'Alpha', order: 0 }] as any);
    expect(rows.map((row) => row.title)).toEqual(['Alpha', 'Zulu']);
    expect(rows[1].templateId).toBe('z-id');
  });

  it('marks rows configured as client requirements from templates or item metadata', () => {
    const rows = buildBookingStepRows([
      { key: 'contract', title: 'Contract', order: 1, category: 'contract', isRequirement: true },
      { key: 'optional', title: 'Optional', order: 2, category: 'other' },
    ] as any, [
      { key: 'food', title: 'Food form', order: 3, category: 'dietary', metadata: { requiredFromClient: true } },
    ] as any);
    expect(rows.filter((row) => row.isRequirement).map((row) => row.key)).toEqual(['contract', 'food']);
  });

  it('groups rows in first-seen order and carries the first available color', () => {
    const rows: any[] = [
      { key: 'a', title: 'A', groupKey: 'medical', groupLabel: 'Medical', rows: [], order: 1 },
      { key: 'b', title: 'B', groupKey: 'medical', groupLabel: 'Medical', groupColor: '#123', order: 2 },
      { key: 'c', title: 'C', groupKey: '', category: 'forms', groupLabel: '', order: 3 },
    ];
    const groups = groupBookingStepRows(rows);
    expect(groups.map((group) => group.key)).toEqual(['medical', 'forms']);
    expect(groups[0]).toMatchObject({ color: '#123', rows: [rows[0], rows[1]] });
    expect(groups[1].label).toBe('Forms');
  });

  it('filters, searches, and numbers visible rows', () => {
    const rows: any[] = [{ key: 'a', title: 'Alpha' }, { key: 'b', title: 'Beta' }];
    const groups: any[] = [{ key: 'one', label: 'One', rows }];
    expect(filterBookingStepRowGroups(groups, null)).toBe(groups);
    expect(filterBookingStepRowGroups(groups, ['b'])[0].rows).toEqual([rows[1]]);
    expect(filterBookingStepRowGroups(groups, [])).toEqual([]);
    expect(searchBookingStepRows(rows, ' ALP ')).toEqual([rows[0]]);
    expect(numberBookingStepRows(rows)).toEqual(new Map([['a', 1], ['b', 2]]));
  });
});
