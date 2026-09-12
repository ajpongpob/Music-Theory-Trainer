'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/mobile-safari-ui-boundary.json'),'utf8'));
module.exports=function restoreMobileSafariUi(source,file){
  const entry=fixture.files[file];
  if(!entry) return source;
  const hash=crypto.createHash('sha256').update(source).digest('hex');
  assert.equal(hash,entry.afterSha256,'unexpected mobile Safari UI edit in '+file);
  assert.equal(source.slice(entry.offset,entry.offset+entry.inserted.length),entry.inserted,'mobile Safari UI delta moved in '+file);
  return source.slice(0,entry.offset)+source.slice(entry.offset+entry.inserted.length);
};
