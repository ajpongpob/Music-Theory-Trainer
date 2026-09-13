'use strict';
const assert=require('assert');

const marker='/* ===== Register visual differentiation: yellow-gray accent ===== */';
const expectedTail=`/* ===== Register visual differentiation: yellow-gray accent ===== */
/* Keep the app's existing blue identity, while making Sign up visibly distinct
   with the same yellow + neutral gray vocabulary used by the trainer UI. */
#registerPanel{
  position:relative;
  overflow:hidden;
  padding-top:76px;
  border-color:#cfd6e1;
  border-radius:26px 26px 20px 20px;
  background:
    linear-gradient(180deg,rgba(245,185,22,.075) 0,rgba(245,185,22,0) 150px),
    #fff;
  box-shadow:
    0 18px 50px rgba(23,32,51,.12),
    0 0 0 1px rgba(245,185,22,.08);
}

#registerPanel::before{
  content:"สร้างบัญชีใหม่";
  position:absolute;
  inset:0 0 auto 0;
  height:46px;
  display:flex;
  align-items:center;
  padding:0 22px;
  border-bottom:1px solid #d8dee9;
  background:
    linear-gradient(90deg,#f5b916 0 86px,#e9edf3 86px 100%);
  color:#344054;
  font-size:.78rem;
  font-weight:900;
  letter-spacing:.02em;
}

#registerPanel .auth-brand{
  margin-bottom:18px;
  padding-bottom:16px;
  border-bottom:1px solid #e4e7ec;
}

#registerPanel .auth-brand-icon{
  background:#344054;
  color:#f5b916;
  border:1px solid #475467;
  box-shadow:inset 0 -2px 0 rgba(0,0,0,.16);
}

#registerPanel .auth-brand p{
  color:#596579;
}

#registerPanel h2{
  position:relative;
  margin-bottom:20px;
  padding-left:14px;
  color:#172033;
}

#registerPanel h2::before{
  content:"";
  position:absolute;
  left:0;
  top:.15em;
  bottom:.15em;
  width:5px;
  border-radius:999px;
  background:#f5b916;
}

#registerPanel .auth-field input{
  border-color:#c7ced9;
  background:#f8fafc;
}

#registerPanel .auth-field input:hover{
  border-color:#98a2b3;
}

#registerPanel .auth-field input:focus{
  outline:2px solid rgba(49,94,251,.16);
  border-color:#315efb;
  box-shadow:0 0 0 4px rgba(245,185,22,.14);
  background:#fff;
}

#registerPanel .auth-primary{
  position:relative;
  border:1px solid #2448c7;
  box-shadow:
    inset 5px 0 0 #f5b916,
    0 5px 14px rgba(49,94,251,.18);
}

#registerPanel .auth-primary:hover:not(:disabled){
  filter:brightness(.97);
  transform:translateY(-1px);
}

#registerPanel .auth-primary:active:not(:disabled){
  transform:translateY(0);
}

#registerPanel .auth-switch{
  margin-top:14px;
  border:1px solid #d8dee9;
  border-radius:10px;
  background:#f2f4f7;
  color:#344054;
}

#registerPanel .auth-switch:hover{
  border-color:#b8c0cc;
  background:#e9edf3;
  color:#315efb;
}

@media(max-width:480px){
  #registerPanel{
    padding-top:70px;
    border-radius:22px 22px 18px 18px;
  }

  #registerPanel::before{
    height:42px;
    padding:0 18px;
    background:linear-gradient(90deg,#f5b916 0 72px,#e9edf3 72px 100%);
  }
}
`;

module.exports=function restoreRegisterAuthTheme(source,file){
  if(file!=='styles/app.css') return source;
  const index=source.indexOf(marker);
  if(index<0) return source;
  assert.equal(source.indexOf(marker,index+marker.length),-1,'duplicate register theme marker');
  assert.equal(source.slice(index).trimEnd(),expectedTail.trimEnd(),'unexpected register auth theme edit in styles/app.css');
  assert(index>=2 && source.slice(index-2,index)==='\n\n','register auth theme must remain an appended CSS delta');
  return source.slice(0,index-1);
};
