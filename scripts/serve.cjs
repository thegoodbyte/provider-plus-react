const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname, sep } = require('node:path');
const root = resolve('build');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.woff2':'font/woff2', '.pdf':'application/pdf' };
createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405);res.end();return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file = resolve(root, '.' + pathname);
    if(file!==root && !file.startsWith(root+sep)) { res.writeHead(403);res.end();return; }
    if(!extname(file)) file=resolve(root,'index.html');
    const body=await readFile(file);
    res.setHeader('Content-Type',types[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control',file.includes(sep+'assets'+sep)?'public, max-age=31536000, immutable':'no-cache');
    res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT || 3000),'0.0.0.0');
