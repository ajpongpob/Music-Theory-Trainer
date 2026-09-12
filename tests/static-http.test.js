'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const files=['index.html'];
function walk(rel){
  for(const item of fs.readdirSync(path.join(root,rel),{withFileTypes:true})){
    const name=rel+'/'+item.name;
    if(item.isDirectory()) walk(name);else files.push(name);
  }
}
walk('src');walk('styles');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/checkpoint/')){res.writeHead(404);res.end();return;}
  const file=pathname.slice('/checkpoint/'.length)||'index.html';
  if(!files.includes(file)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
  res.end(fs.readFileSync(path.join(root,file)));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    for(const file of files){
      const response=await fetch(`http://127.0.0.1:${server.address().port}/checkpoint/${file}`);
      assert.equal(response.status,200,file+' must return HTTP 200');
      assert(Buffer.from(await response.arrayBuffer()).equals(fs.readFileSync(path.join(root,file))),'HTTP bytes must equal packaged source');
    }
    console.log(`PASS static HTTP: all ${files.length} production files return 200 under a GitHub Pages-style subpath; no build`);
  }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
