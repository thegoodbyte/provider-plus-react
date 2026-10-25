import { resolveMedicalProfile, medicalProfileStatus } from './medicalProfileData';
const clientId = 'client';
const artifact: any = { _id: 'source', clientId, artifactType: 'ekg', documentType: 'EKG', receivedAt: '2026-10-24', files: [{ fileName: 'new.pdf', s3Key: 'private/new.pdf' }] };
const resolve = (data: any = {}) => resolveMedicalProfile({ clientId, legacyRecords: [], artifacts: [artifact], reviews: [], ...data });
it('uses modern source presence without legacy rows or a date', () => {
 expect(resolve().ekg).toMatchObject({ present: true, status: 'received', fileName: 'new.pdf', legacyReview: false });
 expect(resolve({ artifacts: [{ ...artifact, receivedAt: undefined }] }).ekg.present).toBe(true);
});
it('does not apply an older document approval to a newer upload', () => {
 const reviews = [{ _id: 'old-review', clientId, artifactIds: ['old'], status: 'approved', reviewDecision: 'OK' }];
 expect(resolve({ reviews, legacyRecords: [{ clientId, ekgFileName: 'old.pdf', ekgReceivedDate: '2026-01-01', ekgStatus: 'approved' }] }).ekg.status).toBe('received');
});
it('canonical document type wins over a contradictory legacy type', () => {
 const model = resolve({ artifacts: [{ ...artifact, documentType: 'Liver' }] });expect(model.ekg.present).toBe(false);expect(model.liver.present).toBe(true);
});
it.each(['voided', 'superseded'])('ignores %s sources and foreign-client artifacts', status => {
 expect(resolve({ artifacts: [{ ...artifact, status }, { ...artifact, clientId: 'another' }] }).ekg.present).toBe(false);
});
it('rejects foreign-client and conflicting-retreat reviews even when IDs match', () => {
 const reviews = [{ clientId: 'another', artifactIds: ['source'], status: 'approved' }, { clientId, retreatId: 'other-retreat', artifactIds: ['source'], status: 'approved' }];
 expect(resolve({ artifacts: [{ ...artifact, retreatId: 'retreat' }], reviews }).ekg.status).toBe('received');
});
it('selects a newer pending review instead of an older approved attempt', () => {
 const reviews = [{ clientId, display_id: 1, artifactIds: ['source'], status: 'approved', reviewDecision: 'OK', createdAt: '2026-10-23' }, { clientId, display_id: 2, artifactIds: [{_id:'source'}], status: 'awaiting_whatsapp', createdAt: '2026-10-24' }];
 expect(resolve({ reviews }).ekg.status).toBe('awaiting_whatsapp');
});
it('a newer legacy record stays authoritative for its own file', () => {
 const model=resolve({ legacyRecords: [{ clientId, ekgFileName: 'latest-legacy.pdf', ekgReceivedDate: '2026-10-25', ekgStatus: 'declined', retreatId: 'retreat' }] });
 expect(model.ekg).toMatchObject({fileName:'latest-legacy.pdf', status:'declined',legacyReview:true});
});
it.each([
 ['OK','approved'],['caution','caution'],['NOT OK','declined'],['more_info_needed','needs_more_info'],
])('uses saved %s decisions as %s', (reviewDecision, expected) => {
 expect(medicalProfileStatus({ status:'completed',reviewDecision } as any,'ekg')).toBe(expected);
});
it('completed/handled without a decision is reviewed, never approved', () => {
 expect(medicalProfileStatus({ status:'completed',whatsappStatus:'responded' } as any,'ekg')).toBe('reviewed');
 expect(medicalProfileStatus({ status:'awaiting_whatsapp',reviewDecision:'OK' } as any,'ekg')).toBe('awaiting_whatsapp');
});
it('unknown availability is distinct from an empty successful result', () => {
 expect(resolve({artifacts:[],artifactsAvailable:false}).ekg.status).toBe('unavailable');
 expect(resolve({artifacts:[]}).ekg.status).toBe('pending');
});
