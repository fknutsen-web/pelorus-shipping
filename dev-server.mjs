// Local dev server — serves static files and routes /api/* to the serverless
// handlers, emulating Vercel. Run: node dev-server.mjs  (or: npm run dev)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import quote from './api/quote.js';
import lead from './api/lead.js';
import engagement from './api/engagement.js';

const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };
const PORT = process.env.PORT || 3000;

function wrap(res){
  res.status = (c)=>{ res.statusCode=c; return res; };
  res.json = (o)=>{ res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(o)); return res; };
  return res;
}
async function readBody(req){ return new Promise(r=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>r(b)); }); }

http.createServer(async (req,res)=>{
  wrap(res);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')){
    req.body = await readBody(req);
    if (url.pathname === '/api/quote') return quote(req,res);
    if (url.pathname === '/api/lead')  return lead(req,res);
    if (url.pathname === '/api/engagement') return engagement(req,res);
    return res.status(404).json({error:'no such api'});
  }
  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const data = await readFile(join(process.cwd(), path));
    res.setHeader('Content-Type', TYPES[extname(path)] || 'application/octet-stream');
    res.end(data);
  } catch { res.statusCode=404; res.end('Not found'); }
}).listen(PORT, ()=>console.log(`Pelorus dev server → http://localhost:${PORT}`));
