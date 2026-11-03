import { getRetreatMedicalNotes, buildRetreatMedicalGridData, mergeMedicalReviewRequests, stageBookingFlowItemKey } from './RetreatMedicalGrid.helpers';

describe('RetreatMedicalGrid helpers', () => {
  it('merges retreat and artifact-linked MRR results without duplicates', () => {
    expect(mergeMedicalReviewRequests(
      [{ _id: 'review-1', display_id: 1 } as any],
      [{ _id: 'review-1', display_id: 1 } as any, { _id: 'review-2', display_id: 2 } as any],
    ).map(review => review._id)).toEqual(['review-1', 'review-2']);
  });
  it('excludes cancelled bookings from the medical grid', () => {
    const data = buildRetreatMedicalGridData([
      { _id: 'active-booking', bookingNumber: 1, status: 'confirmed', clientId: { _id: 'active-client', firstName: 'Active' } },
      { _id: 'cancelled-booking', bookingNumber: 2, status: 'cancelled', clientId: { _id: 'cancelled-client', firstName: 'Cancelled' } },
    ] as any, [], [], { retreatCode: 'TEST' });

    expect(data.clients.map((client) => client.bookingId)).toEqual(['active-booking']);
    expect(data.totals.clients).toBe(1);
    expect(data.rows.every((row) => row.cells.length === 1)).toBe(true);
  });

  it('surfaces documentRequestedAt from the matching booking-flow item per stage (PPVC-687)', () => {
    const data = buildRetreatMedicalGridData(
      [{ _id: 'booking-1', bookingNumber: 1, status: 'confirmed', clientId: { _id: 'client-1', firstName: 'Ana' } }] as any,
      [], [], { retreatCode: 'TEST' },
      [
        { bookingId: 'booking-1', key: stageBookingFlowItemKey.ekg, documentRequestedAt: '2026-09-30T10:00:00.000Z' },
        { bookingId: 'booking-1', key: stageBookingFlowItemKey.liver, documentRequestedAt: undefined },
      ] as any,
    );

    const ekgCell = data.rows.find((row) => row.key === 'ekg')!.cells[0];
    const liverCell = data.rows.find((row) => row.key === 'liver')!.cells[0];
    expect(ekgCell.bookingId).toBe('booking-1');
    expect(ekgCell.documentRequestedAt).toBeTruthy();
    expect(liverCell.documentRequestedAt).toBeUndefined();
  });

  it('never shows a raw id hash for an unpopulated client -- falls back to "Unknown client" (PPVC-713)', () => {
    const data = buildRetreatMedicalGridData([
      { _id: 'booking-1', bookingNumber: 1, status: 'confirmed', clientId: 'raw-unpopulated-client-id' },
    ] as any, [], [], { retreatCode: 'TEST' });

    expect(data.clients[0].clientName).toBe('Unknown client');
    expect(data.clients[0].clientName).not.toContain('raw-un');
  });

  it('sorts clients by booking number and resolves the latest linked review per stage', () => {
    const bookings = [
      {
        _id: 'booking-b',
        bookingNumber: 2,
        retreatId: 'retreat-1',
        clientId: {
          _id: 'client-b',
          firstName: 'Alice',
          lastName: 'Zephyr',
          display_id: 202,
        },
      },
      {
        _id: 'booking-a',
        bookingNumber: 1,
        retreatId: 'retreat-1',
        clientId: {
          _id: 'client-a',
          firstName: 'Bob',
          lastName: 'Yellow',
          display_id: 101,
        },
      },
    ] as any;

    const ekgArtifact = {
      _id: 'artifact-ekg',
      display_id: 9001,
      bookingId: 'booking-b',
      clientId: 'client-b',
      retreatId: 'retreat-1',
      documentStage: 'entry',
      documentType: 'EKG',
      artifactType: 'ekg',
      title: 'Entry EKG',
      receivedAt: '2026-07-01T10:00:00.000Z',
    } as any;

    const liverArtifact = {
      _id: 'artifact-liver',
      display_id: 9002,
      bookingId: 'booking-a',
      clientId: 'client-a',
      retreatId: 'retreat-1',
      documentStage: 'entry',
      documentType: 'Liver',
      artifactType: 'liver_panel',
      title: 'Entry liver panel',
      receivedAt: '2026-07-02T10:00:00.000Z',
    } as any;

    const reviews = [
      {
        _id: 'review-ekg-old',
        display_id: 5001,
        medicalArtifactId: 'artifact-ekg',
        clientId: 'client-b',
        retreatId: 'retreat-1',
        requestType: 'ekg_review',
        status: 'pending',
        reviewNotes: 'waiting',
        requestedAt: '2026-07-02T11:00:00.000Z',
      },
      {
        _id: 'review-ekg-new',
        display_id: 5002,
        medicalArtifactId: 'artifact-ekg',
        clientId: 'client-b',
        retreatId: 'retreat-1',
        requestType: 'ekg_review',
        status: 'approved',
        reviewDecision: 'OK',
        reviewNotes: 'Looks good',
        requestedAt: '2026-07-03T11:00:00.000Z',
        reviewedAt: '2026-07-04T11:00:00.000Z',
      },
      {
        _id: 'review-liver',
        display_id: 5003,
        medicalArtifactId: 'artifact-liver',
        clientId: 'client-a',
        retreatId: 'retreat-1',
        requestType: 'liver_panel_review',
        status: 'caution',
        reviewDecision: 'caution',
        reviewNotes: 'Hydrate',
        requestedAt: '2026-07-03T12:00:00.000Z',
      },
    ] as any;

    const data = buildRetreatMedicalGridData(bookings, [ekgArtifact, liverArtifact], reviews, {
      retreatCode: 'JNO-07-25-26',
      code: 'JNO-07-25-26',
      name: 'JNO-07-25-26',
    } as any);

    expect(data.clients.map((client) => client.bookingNumber)).toEqual(['1', '2']);
    expect(data.rows.find((row) => row.key === 'ekg')?.cells[1].reviewLabel).toBe('MRR #5002');
    expect(data.rows.find((row) => row.key === 'ekg')?.cells[1].decisionLabel).toBe('OK');
    expect(data.rows.find((row) => row.key === 'liver')?.cells[0].decisionLabel).toBe('Caution');
    expect(data.rows.map((row) => row.key)).toEqual(['ekg', 'liver', 'medications']);
  });

  it('marks cells with artifacts but no review as artifact only', () => {
    const bookings = [
      {
        _id: 'booking-x',
        bookingNumber: 7,
        retreatId: 'retreat-1',
        clientId: {
          _id: 'client-x',
          firstName: 'Chris',
          lastName: 'Stone',
        },
      },
    ] as any;

    const data = buildRetreatMedicalGridData(
      bookings,
      [{
        _id: 'artifact-only',
        display_id: 1001,
        bookingId: 'booking-x',
        clientId: 'client-x',
        retreatId: 'retreat-1',
        documentStage: 'entry',
        documentType: 'EKG',
        artifactType: 'ekg',
        title: 'Entry EKG',
        receivedAt: '2026-07-01T10:00:00.000Z',
      } as any],
      [],
      { retreatCode: 'JNO-07-25-26' } as any,
    );

    expect(data.rows.find((row) => row.key === 'ekg')?.cells[0].status).toBe('artifact_only');
    expect(data.rows.find((row) => row.key === 'ekg')?.cells[0].reviewLabel).toBe('');
  });

  it('does not reuse one retreat review across every client column', () => {
    const bookings = [
      {
        _id: 'booking-a',
        bookingNumber: 1,
        retreatId: 'retreat-1',
        clientId: {
          _id: 'client-a',
          firstName: 'Anna',
          lastName: 'Blue',
        },
      },
      {
        _id: 'booking-b',
        bookingNumber: 2,
        retreatId: 'retreat-1',
        clientId: {
          _id: 'client-b',
          firstName: 'Ben',
          lastName: 'Green',
        },
      },
    ] as any;

    const reviews = [
      {
        _id: 'review-a',
        display_id: 7001,
        clientId: 'client-a',
        retreatId: 'retreat-1',
        requestType: 'ekg_review',
        status: 'approved',
        reviewDecision: 'OK',
        requestedAt: '2026-07-01T10:00:00.000Z',
      },
      {
        _id: 'review-b',
        display_id: 7002,
        clientId: 'client-b',
        retreatId: 'retreat-1',
        requestType: 'ekg_review',
        status: 'caution',
        reviewDecision: 'caution',
        requestedAt: '2026-07-02T10:00:00.000Z',
      },
    ] as any;

    const data = buildRetreatMedicalGridData(bookings, [], reviews, { retreatCode: 'JNO-07-25-26' } as any);
    const ekgRow = data.rows.find((row) => row.key === 'ekg');

    expect(ekgRow?.cells[0].reviewLabel).toBe('MRR #7001');
    expect(ekgRow?.cells[0].decisionLabel).toBe('OK');
    expect(ekgRow?.cells[1].reviewLabel).toBe('MRR #7002');
    expect(ekgRow?.cells[1].decisionLabel).toBe('Caution');
  });

  it('does not classify questionnaire text as a liver or EKG artifact', () => {
    const bookings = [{
      _id: 'booking-questionnaire',
      bookingNumber: 1235,
      clientId: { _id: 'client-questionnaire', firstName: 'Pawel', lastName: 'Dolata' },
    }] as any;
    const questionnaire = {
      _id: 'artifact-questionnaire',
      bookingId: 'booking-questionnaire',
      clientId: 'client-questionnaire',
      artifactType: 'questionnaire',
      documentType: 'Questionnaire',
      title: 'Health questionnaire',
      description: 'Client answered questions about liver health and EKG history.',
      textContent: 'Previous liver tests and EKG were discussed.',
    } as any;

    const data = buildRetreatMedicalGridData(bookings, [questionnaire], [], { retreatCode: 'TEST' } as any);

    expect(data.rows.find((row) => row.key === 'liver')?.cells[0].status).toBe('missing');
    expect(data.rows.find((row) => row.key === 'ekg')?.cells[0].status).toBe('missing');
  });

  it('uses documentType as authoritative when legacy artifactType disagrees', () => {
    const bookings = [{
      _id: 'booking-conflict',
      bookingNumber: 1235,
      clientId: { _id: 'client-conflict', firstName: 'Pawel', lastName: 'Dolata' },
    }] as any;
    const mislabeledQuestionnaire = {
      _id: 'artifact-conflict',
      bookingId: 'booking-conflict',
      clientId: 'client-conflict',
      artifactType: 'liver_panel',
      documentType: 'Questionnaire',
      title: 'Health questionnaire',
    } as any;

    const data = buildRetreatMedicalGridData(bookings, [mislabeledQuestionnaire], [], { retreatCode: 'TEST' } as any);

    expect(data.rows.find((row) => row.key === 'liver')?.cells[0].status).toBe('missing');
  });

  it('does not classify review notes as the request type', () => {
    const bookings = [{
      _id: 'booking-review-notes',
      bookingNumber: 1235,
      clientId: { _id: 'client-review-notes', firstName: 'Pawel', lastName: 'Dolata' },
    }] as any;
    const questionnaireReview = {
      _id: 'questionnaire-review',
      clientId: 'client-review-notes',
      bookingId: 'booking-review-notes',
      requestType: 'questionnaire_review',
      documentType: 'Questionnaire',
      reviewNotes: 'Please provide liver results and an EKG.',
      status: 'pending',
    } as any;

    const data = buildRetreatMedicalGridData(bookings, [], [questionnaireReview], { retreatCode: 'TEST' } as any);

    expect(data.rows.find((row) => row.key === 'liver')?.cells[0].status).toBe('missing');
    expect(data.rows.find((row) => row.key === 'ekg')?.cells[0].status).toBe('missing');
  });
});


describe('compact WhatsApp notes in the retreat medical grid', () => {
  const review = { reviewChannel: 'whatsapp', status: 'approved', whatsappStatus: 'responded', whatsappDecision: 'OK' } as any;
  it.each([
    ['Advisor response received via WhatsApp: Can stay on it but check with advisor.', 'WA: Can stay on it but check with advisor.'],
    ['Actual clinical note', 'WA: Actual clinical note'],
    ['Advisor response received via WhatsApp', 'WA: OK'],
    ['OK — medical advisor via WhatsApp', 'WA: OK'],
    ['', 'WA: OK'],
  ])('shows actual response from %s without modifying history', (reviewNotes, expected) => {
    const record = { ...review, reviewNotes }; const original = JSON.stringify(record);
    expect(getRetreatMedicalNotes(record)).toBe(expected);
    expect(JSON.stringify(record)).toBe(original);
  });
  it.each([['OK','OK'], ['caution','Caution'], ['more_info_needed','More Info Needed'], ['NOT OK','Declined'], ['WONT_DO',"Won't do"]])('keeps decision %s distinct', (whatsappDecision, label) => {
    expect(getRetreatMedicalNotes({ ...review, whatsappDecision, reviewNotes: 'Advisor response received via WhatsApp' })).toBe(`WA: ${label}`);
  });
  it('handles legacy channel-less notes without altering explicit internal notes', () => {
    const reviewNotes = 'Advisor response received via WhatsApp: Legacy note';
    expect(getRetreatMedicalNotes({ ...review, reviewChannel: undefined, reviewNotes })).toBe('WA: Legacy note');
    expect(getRetreatMedicalNotes({ ...review, reviewChannel: 'internal', reviewNotes })).toBe(reviewNotes);
  });
  it('never infers approval from a generic receipt or pending state', () => {
    expect(getRetreatMedicalNotes({ ...review, status:'in_review', whatsappDecision:undefined, reviewNotes:'' })).toBe('WA: Response recorded; decision not recorded');
    expect(getRetreatMedicalNotes({ ...review, status:'awaiting_whatsapp', whatsappDecision:undefined, whatsappStatus:'awaiting_response' })).toBe('WA: Awaiting response');
  });
  it('preserves non-WA and artifact notes, including full long responses', () => {
    expect(getRetreatMedicalNotes({ status:'approved', reviewNotes:'Internal note' } as any)).toBe('Internal note');
    expect(getRetreatMedicalNotes(null, { notes:'Artifact note' } as any)).toBe('Artifact note');
    const note='Full response '.repeat(80);
    expect(getRetreatMedicalNotes({ ...review, reviewNotes:note })).toBe('WA: '+note.trim());
  });
});
