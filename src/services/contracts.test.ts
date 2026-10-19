import { AxiosError } from 'axios';
import { api, contactBookApi } from './api';
import { cacheService } from './cacheService';
import { API_BASE_URL } from '../config/api.config';
const originalAdapter=api.defaults.adapter;
const requests:any[]=[];
beforeEach(()=>{cacheService.clear();localStorage.setItem('token','contract-test-token');requests.length=0;api.defaults.adapter=async(config:any)=>{requests.push(config);const one={_id:'contact',name:'Doctor',role:'medical'};return {data:config.method==='get'&&!config.url.includes('/contact-book/')?[one]:one,status:200,statusText:'OK',headers:{},config};};});
afterAll(()=>{api.defaults.adapter=originalAdapter;localStorage.clear();});
it('generated contact lookup uses the runtime API origin, auth interceptor, encoded query and cache',async()=>{
 const first=await contactBookApi.getAll({search:'Dr & Jane',includeInactive:true});await contactBookApi.getAll({search:'Dr & Jane',includeInactive:true});
 expect(first.data[0].name).toBe('Doctor');expect(requests).toHaveLength(1);const url=new URL(requests[0].url);expect(url.origin).toBe(new URL(API_BASE_URL).origin);expect(url.pathname).toBe('/contact-book');expect(url.searchParams.get('search')).toBe('Dr & Jane');expect(url.searchParams.get('includeInactive')).toBe('true');expect(requests[0].headers.Authorization).toBe('Bearer contract-test-token');
});
it('generated writes retain Axios response shape, encoded IDs and invalidate cached reads',async()=>{
 await contactBookApi.getAll();const created=await contactBookApi.create({name:'Doctor',role:'medical'});expect(created.data._id).toBe('contact');await contactBookApi.getAll();expect(requests).toHaveLength(3);
 await contactBookApi.update('contact / other',{notes:'Update'});expect(requests[3].method).toBe('patch');expect(requests[3].url).toContain('/contact-book/contact%20%2F%20other');expect(JSON.parse(requests[3].data)).toEqual({notes:'Update'});await contactBookApi.delete('contact');expect(requests[4].method).toBe('delete');
});
it('generated reads keep rejection semantics rather than returning an error as successful data',async()=>{
 api.defaults.adapter=async(config)=>{throw new AxiosError('Forbidden','ERR_BAD_REQUEST',config,undefined,{status:403,statusText:'Forbidden',headers:{},data:{message:'Forbidden'},config});};
 await expect(contactBookApi.getOne('denied')).rejects.toMatchObject({response:{status:403}});
});
