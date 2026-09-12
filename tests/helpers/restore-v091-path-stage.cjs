'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('assert');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v091-path-stage-boundary.json'),'utf8'));
module.exports=function restoreV091(source,file){const r=fixture.files[file];if(!r)return source;const h=crypto.createHash('sha256').update(source).digest('hex');assert.equal(h,r.afterSha256,'unexpected v0.9.1 edit in '+file);return zlib.gunzipSync(Buffer.from(r.beforeGzipBase64,'base64')).toString('utf8');};
