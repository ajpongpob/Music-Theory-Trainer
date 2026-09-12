'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('assert');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v090-master-core-boundary.json'),'utf8'));
module.exports=function restoreV090(source,file){
  const record=fixture.files[file]; if(!record) return source;
  const hash=crypto.createHash('sha256').update(source).digest('hex');
  assert.equal(hash,record.afterSha256,'unexpected v0.9.0 edit in '+file);
  return zlib.gunzipSync(Buffer.from(record.beforeGzipBase64,'base64')).toString('utf8');
};
