'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const boundary=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/notation-extraction-boundary.json'),'utf8'));
module.exports=function restoreNotationBaseline(source,file){
  const entry=boundary.files[file];assert(entry,'missing baseline entry: '+file);
  for(const {before,after,offset} of [...entry.substitutions].reverse()){
    assert.equal(source.slice(offset,offset+after.length),after,'unexpected extraction edit in '+file);
    source=source.slice(0,offset)+before+source.slice(offset+after.length);
  }
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),entry.sha256,'non-extracted bytes must match v0.8.0-c: '+file);
  return source;
};
