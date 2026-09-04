const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = Number(process.env.FRONTEND_PORT || 5173);
const HOST = process.env.FRONTEND_HOST || '127.0.0.1';
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };

const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,`http://${req.headers.host||HOST}`).pathname);}
  catch{return res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'}).end('Bad Request');}
  const target=path.join(__dirname,pathname==='/'?'index.html':pathname);
  if(!target.startsWith(__dirname)){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(target,(err,data)=>{
    if(err){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);
  });
});
if(require.main===module)server.listen(PORT,HOST,()=>console.log(`前端页面: http://${HOST}:${PORT}`));
module.exports={server};
