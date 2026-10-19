import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@hey-api/openapi-ts';
const root=process.env.CONTRACTS_PROJECT_ROOT ? path.resolve(process.env.CONTRACTS_PROJECT_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const args=process.argv.slice(2),check=args.includes('--check');
const apiIndex=args.indexOf('--api');const api=apiIndex>=0?path.resolve(args[apiIndex+1]):process.env.CONTRACTS_API_DIR&&path.resolve(process.env.CONTRACTS_API_DIR);
function verifyPackage(folder){const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));if(manifest.format!==1)throw Error('Unsupported contract package version');for(const [file,digest]of Object.entries(manifest.files)){if(path.isAbsolute(file)||file.split(/[\\/]/).includes('..'))throw Error('Invalid contract package path');if(hash(fs.readFileSync(path.join(folder,file)))!==digest)throw Error(`Contract package checksum mismatch: ${file}`);}return manifest;}
function copyTree(from,to){fs.mkdirSync(to,{recursive:true});for(const entry of fs.readdirSync(from,{withFileTypes:true})){const src=path.join(from,entry.name),dst=path.join(to,entry.name);if(entry.isDirectory())copyTree(src,dst);else fs.copyFileSync(src,dst);}}
const folder=path.join(root,'contracts');
if(api){const upstream=path.join(api,'contracts');const manifest=verifyPackage(upstream);if(check){if(JSON.stringify(manifest)!==JSON.stringify(verifyPackage(folder)))throw Error('API/admin contract drift. Run npm run generate:contracts -- --api <API checkout>.');}else{fs.mkdirSync(folder,{recursive:true});for(const file of [...Object.keys(manifest.files),'manifest.json']){const target=path.join(folder,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(upstream,file),target);}}}
verifyPackage(folder);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ppvc-contracts-'));
try{
 await createClient({input:path.join(folder,'openapi.json'),output:{path:path.join(temp,'sdk'),postProcess:[]},plugins:['@hey-api/typescript','@hey-api/sdk','@hey-api/client-axios']});
 copyTree(path.join(folder,'shared'),path.join(temp,'shared'));
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.relative(temp,path.join(dir,e.name))]).sort();
 const target=path.join(root,'src/generated/contracts');
 if(check){const expected=walk(temp);const actual=fs.existsSync(target)?fs.readdirSync(target,{recursive:true}).filter(p=>fs.statSync(path.join(target,p)).isFile()).sort():[];if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Generated contract file list drift. Run npm run generate:contracts.');for(const file of expected)if(fs.readFileSync(path.join(temp,file),'utf8')!==fs.readFileSync(path.join(target,file),'utf8'))throw Error(`Generated contract drift: ${file}. Run npm run generate:contracts.`);console.log('Generated types and Axios SDK match the pinned API contract.');}
 else{fs.rmSync(target,{recursive:true,force:true});copyTree(temp,target);console.log('Generated shared types and Axios SDK.');}
}finally{fs.rmSync(temp,{recursive:true,force:true});}
