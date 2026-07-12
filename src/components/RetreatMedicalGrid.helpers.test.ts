import { buildRetreatMedicalGridData } from './RetreatMedicalGrid.helpers';

describe('RetreatMedicalGrid helpers', () => {
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
});
