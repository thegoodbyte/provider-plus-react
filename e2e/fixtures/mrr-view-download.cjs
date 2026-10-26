// Reuse real Nest/JWT/Mongo download endpoint; capture only storage delivery.
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 if(!process.env.TEST_FIXTURE_OUTPUT)throw Error('TEST_FIXTURE_OUTPUT required');
 const source=process.env.DOWNLOAD_FIXTURE_SOURCE;if(!source)throw Error('DOWNLOAD_FIXTURE_SOURCE required');
 const f=await require(path.resolve(source,'test/whatsapp-download-names.fixture.cjs')).createFixture();
 const http=f.app.getHttpAdapter().getInstance();let base='';
 f.service.s3Service.getPresignedUrl=async(key,_expires,fileName)=>base+'/fixture/download/'+encodeURIComponent(key)+'?name='+encodeURIComponent(fileName||'document.pdf');
 http.get('/fixture/download/:key',async(req,res)=>{
  const upload=f.effects.uploads.find(x=>x.key===req.params.key);
  if(!upload)return res.status(404).send('Synthetic file unavailable');
  res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(String(req.query.name)));res.send(upload.buffer);
 });
 http.get('/fixture/snapshot',async(_req,res)=>res.json({reviews:await f.models.MedicalReviewRequest.find().sort({_id:1}).lean(),artifacts:await f.models.MedicalArtifact.find().sort({_id:1}).lean()}));
 await f.app.listen(Number(process.env.TEST_FIXTURE_PORT||0),'127.0.0.1');base='http://127.0.0.1:'+f.app.getHttpServer().address().port;
 fs.writeFileSync(process.env.TEST_FIXTURE_OUTPUT,JSON.stringify({url:base,requestId:f.requestId,tokens:f.tokens}));console.log('Synthetic real-API MRR download fixture ready');
 const close=async()=>{await f.close();process.exit(0)};process.once('SIGTERM',close);process.once('SIGINT',close);
})().catch(e=>{console.error(e);process.exitCode=1});
