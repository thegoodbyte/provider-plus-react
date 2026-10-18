import { libraryDocuments, libraryArtifacts } from './documentLibraryRecords';
const types:any[]=[{key:'questionnaire',medicalArtifactType:'questionnaire',libraryPlacement:'documents'},{key:'medications_form',medicalArtifactType:'medications_form',libraryPlacement:'medical'}];
const q:any={_id:'q',artifactType:'questionnaire',clientId:'c',files:[{s3Key:'q.pdf'}],data:{},title:'Prebooking questionnaire'};
const m:any={_id:'m',documentType:'medications_form',clientId:'c',bookingId:'b',files:[{s3Key:'m.pdf'}],title:'Legacy medication form'};
it('includes a client-only questionnaire stored only as an artifact, with original-source metadata',()=>{
 const rows=libraryDocuments([], [q],types);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({bookingId:'',documentType:'questionnaire',title:'Prebooking questionnaire',metadata:{librarySourceArtifactId:'q'}});expect(rows[0].files).toEqual(q.files);
});
it('includes an unmirrored medication document in medical results without giving it an MRR-capable artifact ID',()=>{
 const rows=libraryArtifacts([], [m], types);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({artifactType:'medications_form',data:{librarySourceDocumentId:'m'}});expect(rows[0]._id).toBeUndefined();
});
it('deduplicates explicit links and identical files without modifying source records',()=>{
 const doc:any={_id:'qd',documentType:'questionnaire',clientId:'c',files:[{s3Key:'q.pdf'}]};
 expect(libraryDocuments([doc],[q],types)).toEqual([doc]);
 expect(libraryDocuments([{...doc,files:[],metadata:{linkedMedicalArtifactId:'q'}}],[q],types)).toHaveLength(1);
 const artifact:any={_id:'ma',artifactType:'medications_form',clientId:'c',files:[{s3Key:'m.pdf'}]};
 expect(libraryArtifacts([artifact],[m],types)).toEqual([artifact]);expect(m.files).toEqual([{s3Key:'m.pdf'}]);
});
it('leaves unknown types in their original source and honors custom configurable mappings',()=>{
 expect(libraryDocuments([], [{...q,artifactType:'unknown'}],types)).toHaveLength(0);
 expect(libraryDocuments([], [{...q,artifactType:'custom_artifact'}],[{key:'custom_form',medicalArtifactType:'custom_artifact',libraryPlacement:'both',label:'Custom'}])).toHaveLength(1);
});
