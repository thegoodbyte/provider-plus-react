import { buildBookingStepActionOptions, canSendBookingStepReminder, canSendBookingStepRowEmail, getLinkedBookingStepArtifactId, humanizeBookingStepDocumentKey, interpolateBookingStepActionUrl, resolveBookingStepDocumentType, resolveConfiguredBookingStepDocumentType } from './bookingStepControlRules';

describe('bookingStepControlRules', () => {
  it('humanizes document keys', () => {
    expect(humanizeBookingStepDocumentKey('liver_panel-result')).toBe('Liver Panel Result');
    expect(humanizeBookingStepDocumentKey('')).toBe('');
  });

  it('selects direct and most recent linked artifact ids', () => {
    expect(getLinkedBookingStepArtifactId({ metadata: { latestArtifactId: 7, linkedMedicalArtifactIds: ['old'] } } as any)).toBe('7');
    expect(getLinkedBookingStepArtifactId({ metadata: { linkedMedicalArtifactId: 'linked' } } as any)).toBe('linked');
    expect(getLinkedBookingStepArtifactId({ metadata: { receivedArtifactId: 'received' } } as any)).toBe('received');
    expect(getLinkedBookingStepArtifactId({ metadata: { linkedMedicalArtifactIds: ['old', 'new'] } } as any)).toBe('new');
    expect(getLinkedBookingStepArtifactId({} as any)).toBe('');
  });

  it('interpolates and encodes nested action variables', () => {
    expect(interpolateBookingStepActionUrl('https://x.test/{{ client.name }}/{{missing}}', { client: { name: 'Ada L.' } })).toBe('https://x.test/Ada%20L./');
    expect(interpolateBookingStepActionUrl('plain')).toBe('plain');
  });

  it('resolves mapped and metadata document types in priority order', () => {
    expect(resolveBookingStepDocumentType({ key: 'ekg_received' })).toBe('ekg');
    expect(resolveBookingStepDocumentType({ key: 'custom', metadata: { expectedBookingDocument: 'Signed Form', expectedDocument: 'ignored' } } as any)).toBe('signed_form');
    expect(resolveBookingStepDocumentType({ key: 'custom', metadata: { expectedDocument: 'Health Form' } } as any)).toBe('health_form');
    expect(resolveBookingStepDocumentType({ key: 'custom', metadata: { expectedArtifact: 'Lab Result' } } as any)).toBe('lab_result');
    expect(resolveBookingStepDocumentType({ key: 'custom' })).toBe('custom');
  });

  it('only treats expected artifacts as booking documents without artifact configuration', () => {
    const item: any = { key: 'custom', metadata: { expectedArtifact: 'Lab Result' } };
    expect(resolveConfiguredBookingStepDocumentType(item, false)).toBe('lab_result');
    expect(resolveConfiguredBookingStepDocumentType(item, true)).toBe('');
    expect(resolveConfiguredBookingStepDocumentType({ key: 'contract_signed' }, true)).toBe('contract');
  });

  it('checks reminder and retreat-row email eligibility', () => {
    const booking = { _id: 'b', client: { email: 'a@b.com' } };
    expect(canSendBookingStepReminder({ _id: 'i', bookingId: 'b', status: 'pending' } as any, [booking])).toBe(true);
    expect(canSendBookingStepReminder({ _id: 'i', bookingId: 'b', status: 'completed' } as any, [booking])).toBe(false);
    expect(canSendBookingStepReminder({ bookingId: 'b', status: 'pending' } as any, [booking])).toBe(false);
    expect(canSendBookingStepReminder({ _id: 'i', bookingId: 'missing', status: 'pending' } as any, [booking])).toBe(false);
    expect(canSendBookingStepRowEmail({ templateId: 't', emailEnabled: true, emailTemplateId: 'e' } as any)).toBe(true);
    expect(canSendBookingStepRowEmail({ templateId: 't', emailEnabled: false, emailTemplateId: 'e' } as any)).toBe(false);
  });

  it('builds unique action options while preserving encounter order', () => {
    const items: any[] = [{ key: 'a', title: 'Alpha' }, { key: 'a', title: 'Alpha duplicate' }, { key: 'b', title: 'Beta' }];
    const options = buildBookingStepActionOptions(items, () => [{ key: 'send', label: 'Send', type: 'email' }] as any);
    expect(options).toEqual([
      { value: 'a::send', rowKey: 'a', actionKey: 'send', label: 'Alpha · Send' },
      { value: 'b::send', rowKey: 'b', actionKey: 'send', label: 'Beta · Send' },
    ]);
  });
});
