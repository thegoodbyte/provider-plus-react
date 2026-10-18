import {BookingDocument,BookingDocumentType,MedicalArtifact} from '../types';
const id=(value:any):string=>typeof value==='string'?value:value?._id||'';
const paths=(record:any):string[] => (record.files||[]).map((file:any)=>file.s3Key||file.filePath).filter(Boolean);
function sameFiles(a:any,b:any) { return id(a.clientId)===id(b.clientId)&&paths(a).some(path=>paths(b).includes(path)); }
function linked(document:BookingDocument,artifact:MedicalArtifact) {
 const metadata=document.metadata||{},data=artifact.data||{};
 return [metadata.linkedMedicalArtifactId,metadata.medicalArtifactId,metadata.artifactId].some(value=>value&&id(value)===id(artifact))
 || id(data.bookingDocumentId)===id(document) || sameFiles(document,artifact);
}
export function libraryDocuments(documents:BookingDocument[],artifacts:MedicalArtifact[],types:BookingDocumentType[]):BookingDocument[] {
 const extra=artifacts.flatMap(artifact=>{
  const config=types.find(type=>type.medicalArtifactType===artifact.artifactType||type.key===artifact.artifactType);
  if(!config||!['documents','both'].includes(config.libraryPlacement||'')||documents.some(document=>linked(document,artifact)))return [];
  return [{_id:`artifact:${artifact._id}`,display_id:artifact.display_id,documentType:config.key,title:artifact.title,description:artifact.description,clientId:artifact.clientId,bookingId:artifact.bookingId||'',retreatId:artifact.retreatId,files:artifact.files,receivedAt:artifact.receivedAt,status:artifact.status==='superseded'?'superseded':'stored',metadata:{librarySourceArtifactId:artifact._id}} as BookingDocument];
 });return [...documents,...extra];
}
export function libraryArtifacts(artifacts:MedicalArtifact[],documents:BookingDocument[],types:BookingDocumentType[]):MedicalArtifact[] {
 const extra=documents.flatMap(document=>{
  const config=types.find(type=>type.key===document.documentType);
  if(!config||!['medical','both'].includes(config.libraryPlacement||'')||artifacts.some(artifact=>linked(document,artifact)))return [];
  // A read-only view of the original document; no synthetic MRR-capable ID.
  return [{artifactType:(config.medicalArtifactType||config.key) as MedicalArtifact['artifactType'],documentStage:(config.medicalDocumentStage||'entry') as MedicalArtifact['documentStage'],documentType:(config.medicalDocumentType||'other') as MedicalArtifact['documentType'],display_id:document.display_id,title:document.title,clientId:document.clientId||'',bookingId:document.bookingId,retreatId:document.retreatId,files:document.files,receivedAt:document.receivedAt,status:document.status==='superseded'?'superseded':'stored',data:{librarySourceDocumentId:document._id}} as MedicalArtifact];
 });return [...artifacts,...extra];
}
