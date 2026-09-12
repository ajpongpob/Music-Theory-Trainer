'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/mobile-safari-ui-boundary.json'),'utf8'));
module.exports=function restoreMobileSafariUi(source,file){
  const entry=fixture.files[file];
  if(!entry) return source;
  assert.equal(source.slice(entry.offset,entry.offset+entry.inserted.length),entry.inserted,'mobile Safari UI delta moved in '+file);
  const restored=source.slice(0,entry.offset)+source.slice(entry.offset+entry.inserted.length);
  const restoredHash=crypto.createHash('sha256').update(restored).digest('hex');
  assert.equal(restoredHash,entry.beforeSha256,'unexpected non-mobile Safari UI edit in '+file);
  return restored;
};
