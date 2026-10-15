import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
function pdfFixture(){
 let text='%PDF-1.4\n';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>','<< /Length 0 >>\nstream\nendstream'];const offsets=[0];
 objects.forEach((body,i)=>{offsets.push(Buffer.byteLength(text));text+=(i+1)+' 0 obj\n'+body+'\nendobj\n';});const xref=Buffer.byteLength(text);text+='xref\n0 5\n0000000000 65535 f \n';offsets.slice(1).forEach(n=>text+=String(n).padStart(10,'0')+' 00000 n \n');text+='trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';return Buffer.from(text);
}
const pdf=pdfFixture();
async function fixture(page:any,fail=false){
 await page.addInitScript(()=>{const original=URL.createObjectURL.bind(URL);(window as any).__pdfUrls=[];URL.createObjectURL=(blob:Blob)=>{const url=original(blob);(window as any).__pdfUrls.push(url);return url;};});
 let failed=false;
 await page.route('**/*',async(route:any)=>{const req=route.request();if(!['xhr','fetch'].includes(req.resourceType())||req.url().startsWith('blob:'))return route.continue();const path=new URL(req.url()).pathname;const json=(data:any)=>route.fulfill({json:data});
 if(path.endsWith('/screening/download-pdf')){if(fail&&!failed){failed=true;return route.fulfill({status:503,json:{message:'PDF service unavailable'}});}return route.fulfill({status:200,contentType:'application/pdf',headers:{'content-disposition':'attachment; filename="screening-synthetic.pdf"','access-control-expose-headers':'Content-Disposition'},body:pdf});}
 if(path==='/clients/client-1')return json({_id:'client-1',firstName:'Synthetic',lastName:'Client',display_id:501,phone:'+420700000000',screeningData:{mainIntent:'Synthetic test'}});
 if(path==='/environment/status')return json({environment:'local',production:false,enabledJobs:[]});return json([]);
 });
}
for(const width of [1440,390])for(const entry of ['editor','details'])test('named screening PDF downloads with intact bytes and durable source '+entry+' '+width,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});await page.clock.install();await fixture(page);
 await page.goto(entry==='editor'?'/admin/clients/client-1/screening':'/admin/clients/client-1?tab=screening');
 const button=entry==='editor'?page.getByRole('button',{name:'PDF',exact:true}):page.getByRole('button',{name:'Download screening PDF',exact:true});
 const downloadEvent=page.waitForEvent('download');await button.click();const download=await downloadEvent;
 expect(download.suggestedFilename()).toBe('screening-synthetic.pdf');const target=testInfo.outputPath('screening.pdf');await download.saveAs(target);expect(await download.failure()).toBeNull();expect(await readFile(target)).toEqual(pdf);
 await page.clock.runFor(2100);
 const stored=await page.evaluate(async()=>{const urls=(window as any).__pdfUrls as string[];const response=await fetch(urls[urls.length-1]);return {ok:response.ok,text:await response.text()};});
 expect(stored.ok).toBe(true);expect(stored.text).toBe(pdf.toString());
});
test('screening download failure is visible and the user can retry',async({page})=>{
 await fixture(page,true);await page.goto('/admin/clients/client-1/screening');const button=page.getByRole('button',{name:'PDF',exact:true});await button.click();await expect(page.getByText('Could not download screening PDF. Please try again.')).toBeVisible();const done=page.waitForEvent('download');await button.click();expect((await done).suggestedFilename()).toBe('screening-synthetic.pdf');
});
