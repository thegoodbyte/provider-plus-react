import {saveScreeningPdf} from './screeningPdfDownload';
const hide=(persisted=false)=>{const event=new Event('pagehide');Object.defineProperty(event,'persisted',{value:persisted});window.dispatchEvent(event);};
let click:jest.SpyInstance;
beforeEach(()=>{jest.useFakeTimers();URL.createObjectURL=jest.fn(()=> 'blob:screening');URL.revokeObjectURL=jest.fn();click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});});
afterEach(()=>{hide();click.mockRestore();jest.useRealTimers();});
it('starts a named download rather than opening a temporary viewer tab and retains the source beyond one second',()=>{
 let anchor:HTMLAnchorElement|undefined;click.mockImplementation(function(this:HTMLAnchorElement){anchor=this;});
 saveScreeningPdf({data:new Blob(['%PDF-1.4'],{type:'application/pdf'}),headers:{'content-disposition':'attachment; filename="screening-MARTA.pdf"'}},'client');
 expect(anchor!.download).toBe('screening-MARTA.pdf');expect(anchor!.target).toBe('');expect(anchor!.href).toBe('blob:screening');expect(document.body.contains(anchor!)).toBe(false);
 jest.advanceTimersByTime(60000);expect(URL.revokeObjectURL).not.toHaveBeenCalled();
 hide(true);expect(URL.revokeObjectURL).not.toHaveBeenCalled();
 hide();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:screening');
});
it('uses a fallback PDF filename when the response does not expose the filename',()=>{
 let name='';click.mockImplementation(function(this:HTMLAnchorElement){name=this.download;});
 saveScreeningPdf({data:new Blob(['pdf'])},'501');expect(name).toBe('screening-501.pdf');
});
it('supports encoded filenames and removes unsafe path characters',()=>{
 let name='';click.mockImplementation(function(this:HTMLAnchorElement){name=this.download;});
 saveScreeningPdf({data:new Blob(['pdf']),headers:{'content-disposition':"attachment; filename*=UTF-8''screening-%C5%81ucja%2Ftest.pdf"}},'501');
 expect(name).toBe('screening-Łucja_test.pdf');
});
it('does not start a download for an empty response',()=>{
 expect(()=>saveScreeningPdf({data:new Blob([])},'501')).toThrow('empty');expect(click).not.toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();
});
