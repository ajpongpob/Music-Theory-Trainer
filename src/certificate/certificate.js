(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
const repo=app.dashboardRepository;
const authRepo=app.authRepository;
const $=id=>document.getElementById(id);
const EXERCISE_CODE='MAJOR_SCALE_NOTATION';
const REQUIRED_STAGE_CODES=Object.freeze(['STAGE_1','STAGE_2','STAGE_3','STAGE_4']);
const CERTIFICATE_HASH='#sd2CertificatePage';
const TEMPLATE_PARTS=6;
const CANVAS_WIDTH=1492;
const CANVAS_HEIGHT=1054;
const PDF_WIDTH=841.89;
const PDF_HEIGHT=595.28;
let certificateState={loading:false,error:'',data:null,template:null};
let certificateLoadPromise=null;

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function language(){return app.i18n?.getLanguage?.()==='en'?'en':'th';}
function text(th,en){return language()==='en'?en:th;}
function safeDate(value){
  if(!value) return null;
  const date=new Date(value);
  return Number.isNaN(date.getTime())?null:date;
}
function latestDate(values){
  return values.map(safeDate).filter(Boolean).sort((a,b)=>b-a)[0]||null;
}
function profileName(profile,user){
  const p=profile||{};
  return [p.first_name,p.last_name].filter(Boolean).join(' ').trim()
    ||String(p.full_name||'').replace(/\u001f/g,' ').trim()
    ||String(p.display_name||p.nickname||'').trim()
    ||String(user?.user_metadata?.full_name||user?.user_metadata?.name||'').trim()
    ||text('ผู้เรียน','Learner');
}
function fnv1a(value){
  let hash=0x811c9dc5;
  for(const char of String(value||'')){
    hash^=char.codePointAt(0);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return hash.toString(16).toUpperCase().padStart(8,'0');
}
function formatCertificateId(userId,completionDate){
  const date=safeDate(completionDate);
  const year=date?String(date.getUTCFullYear()):'0000';
  const dateKey=date?date.toISOString().slice(0,10):'NO-DATE';
  return `MST-${year}-${fnv1a(`${userId||'anonymous'}|${dateKey}|${EXERCISE_CODE}|4`)}`;
}
function selectCertificateStages(rows){
  const exerciseRows=(Array.isArray(rows)?rows:[])
    .filter(row=>String(row.exercise_code||'').toUpperCase()===EXERCISE_CODE)
    .filter(row=>row.stage_id||row.stage_code)
    .sort((a,b)=>Number(a.stage_sequence||0)-Number(b.stage_sequence||0));
  const byCode=new Map(exerciseRows.map(row=>[String(row.stage_code||'').toUpperCase(),row]));
  const exact=REQUIRED_STAGE_CODES.map(code=>byCode.get(code)).filter(Boolean);
  if(exact.length===4) return exact;
  const unique=[],seen=new Set();
  for(const row of exerciseRows){
    const key=row.stage_id||row.stage_code;
    if(!key||seen.has(key)) continue;
    seen.add(key); unique.push(row);
    if(unique.length===4) break;
  }
  return unique;
}
function buildCertificateModel(rows,profile,user){
  const stages=selectCertificateStages(rows);
  const mastered=stages.filter(stage=>stage.stage_status==='mastered');
  const eligible=stages.length===4&&mastered.length===4;
  const completionDate=eligible?latestDate([
    ...stages.map(stage=>stage.stage_mastered_at),
    ...stages.map(stage=>stage.exercise_mastered_at),
    ...stages.map(stage=>stage.path_mastered_at)
  ]):null;
  return Object.freeze({
    eligible,
    masteredCount:mastered.length,
    totalRequired:4,
    stages,
    learnerName:profileName(profile,user),
    completionDate,
    certificateId:formatCertificateId(user?.id,completionDate),
    userId:user?.id||null
  });
}

async function loadTemplate(){
  if(certificateState.template) return certificateState.template;
  const parts=await Promise.all(Array.from({length:TEMPLATE_PARTS},(_,index)=>
    fetch(`./src/certificate/template/part${index}.txt?v=20260915-cert-1`).then(response=>{
      if(!response.ok) throw new Error(`Certificate template part ${index} unavailable`);
      return response.text();
    })
  ));
  const image=new Image();
  image.decoding='async';
  image.src=`data:image/jpeg;base64,${parts.join('').replace(/\s+/g,'')}`;
  await image.decode();
  certificateState.template=image;
  return image;
}

async function loadData({force=false}={}){
  if(certificateLoadPromise&&!force) return certificateLoadPromise;
  certificateState.loading=true;
  renderPage();
  certificateLoadPromise=(async()=>{
    try{
      if(!repo||!authRepo) throw new Error('Certificate data layer is unavailable');
      const authResult=await authRepo.getUser();
      if(authResult?.error) throw authResult.error;
      const user=authResult?.data?.user||null;
      if(!user) throw new Error('Authentication required');
      const [dashboardResult,profileResult]=await Promise.all([
        repo.getStudentDashboard(),
        repo.getStudentProfileDetails(user.id)
      ]);
      if(dashboardResult?.error) throw dashboardResult.error;
      if(profileResult?.error) console.warn('CERTIFICATE PROFILE WARNING:',profileResult.error);
      certificateState.data=buildCertificateModel(dashboardResult?.data||[],profileResult?.data||{},user);
      certificateState.error='';
      if(certificateState.data.eligible) await loadTemplate();
    }catch(error){
      console.error('CERTIFICATE LOAD ERROR:',error);
      certificateState.error=error?.message||String(error);
    }finally{
      certificateState.loading=false;
      certificateLoadPromise=null;
      renderPage();
    }
    return certificateState.data;
  })();
  return certificateLoadPromise;
}

function ensureStylesheet(){
  if(document.querySelector('link[data-certificate-style]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./styles/certificate.css?v=20260915-cert-1';
  link.setAttribute('data-certificate-style','true');
  document.head.appendChild(link);
}
function ensureCertificateNav(){
  const nav=$('sd2TopNav');
  if(nav&&!nav.querySelector('[data-certificate-nav]')){
    const link=document.createElement('a');
    link.className='sd2-nav-button';
    link.href=CERTIFICATE_HASH;
    link.dataset.certificateNav='true';
    link.textContent=text('Certificate','Certificate');
    nav.appendChild(link);
  }
  if(!nav){
    const actions=document.querySelector('#studentDashboard .student-dashboard-actions');
    if(actions&&!actions.querySelector('[data-certificate-nav]')){
      const link=document.createElement('a');
      link.className='btn certificate-legacy-link';
      link.href=CERTIFICATE_HASH;
      link.dataset.certificateNav='true';
      link.textContent='Certificate';
      actions.insertBefore(link,actions.querySelector('#dashboardLogoutButton'));
    }
  }
}
function ensureCertificatePage(){
  if($('sd2CertificatePage')) return $('sd2CertificatePage');
  const shell=document.querySelector('#studentDashboard .student-dashboard-inner');
  if(!shell) return null;
  const page=document.createElement('main');
  page.id='sd2CertificatePage';
  page.className='sd2-certificate-page sd2-page';
  page.hidden=true;
  page.tabIndex=-1;
  const profile=$('sd2ProfilePanel');
  if(profile) profile.insertAdjacentElement('afterend',page);
  else shell.appendChild(page);
  return page;
}
function syncNavigation(){
  ensureCertificateNav();
  const page=ensureCertificatePage();
  if(!page) return;
  const active=window.location.hash===CERTIFICATE_HASH;
  page.hidden=!active;
  document.querySelectorAll('[data-certificate-nav]').forEach(link=>{
    if(active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  });
  if(active){
    ['dashboardContent','sd2PracticePage','sd2ProgressPage','sd2ProfilePanel'].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
    page.focus({preventScroll:true});
    if(!certificateState.data&&!certificateState.loading) loadData();
  }
  app.navigationDrawer?.sync?.();
}

function progressDots(model){
  return Array.from({length:4},(_,index)=>{
    const complete=index<model.masteredCount;
    return `<div class="certificate-level ${complete?'is-complete':''}"><span>${complete?'✓':index+1}</span><small>${text(`ระดับ ${index+1}`,`Level ${index+1}`)}</small></div>`;
  }).join('');
}
function renderPage(){
  ensureCertificateNav();
  const page=ensureCertificatePage();
  if(!page) return;
  if(certificateState.loading){
    page.innerHTML=`<section class="sd2-card certificate-status-card"><div class="certificate-loading">${text('กำลังตรวจสอบสิทธิ์ใบประกาศ…','Checking certificate eligibility…')}</div></section>`;
    return;
  }
  if(certificateState.error){
    page.innerHTML=`<section class="sd2-card certificate-status-card"><div class="sd2-eyebrow">Certificate</div><h2>${text('ไม่สามารถโหลดใบประกาศได้','Certificate unavailable')}</h2><p>${escapeHtml(text('กรุณาลองโหลดข้อมูลอีกครั้ง','Please reload the certificate data.'))}</p><button type="button" class="btn primary" data-certificate-retry>${text('ลองใหม่','Try again')}</button></section>`;
    return;
  }
  const model=certificateState.data;
  if(!model){
    page.innerHTML=`<section class="sd2-card certificate-status-card"><div class="certificate-loading">${text('กำลังเตรียมข้อมูลใบประกาศ…','Preparing certificate data…')}</div></section>`;
    return;
  }
  if(!model.eligible){
    page.innerHTML=`
      <section class="sd2-card certificate-status-card certificate-locked">
        <div class="certificate-lock-icon" aria-hidden="true">🔒</div>
        <div class="sd2-eyebrow">Certificate</div>
        <h2>${text('ยังไม่ปลดล็อกใบประกาศ','Certificate locked')}</h2>
        <p>${text('ผ่านครบทั้ง 4 ระดับของ Major Scale Notation Trainer เพื่อปลดล็อกใบประกาศ','Complete all 4 levels of Major Scale Notation Trainer to unlock your certificate.')}</p>
        <div class="certificate-progress-text"><strong>${model.masteredCount} / 4</strong><span>${text('ระดับที่ผ่านแล้ว','levels completed')}</span></div>
        <div class="certificate-levels">${progressDots(model)}</div>
      </section>`;
    return;
  }
  page.innerHTML=`
    <section class="sd2-card certificate-status-card certificate-unlocked">
      <div class="certificate-unlocked-head"><div><div class="sd2-eyebrow">Certificate · Unlocked</div><h2>${text('ใบประกาศพร้อมดาวน์โหลด','Your certificate is ready')}</h2><p>${text('คุณผ่าน Major Scale Notation Trainer ครบทั้ง 4 ระดับแล้ว','You have completed all 4 levels of Major Scale Notation Trainer.')}</p></div><div class="certificate-check" aria-hidden="true">✓</div></div>
      <div class="certificate-meta"><span><b>${text('ผู้เรียน','Learner')}</b>${escapeHtml(model.learnerName)}</span><span><b>Certificate ID</b>${escapeHtml(model.certificateId)}</span></div>
      <div class="certificate-preview-wrap"><canvas id="certificateCanvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" aria-label="Certificate preview"></canvas></div>
      <div class="certificate-actions"><button id="certificateDownloadPdf" type="button" class="btn primary">${text('ดาวน์โหลด PDF','Download PDF')}</button><button id="certificateDownloadPng" type="button" class="btn">${text('ดาวน์โหลด PNG','Download PNG')}</button></div>
      <p class="certificate-note">${text('วันที่ในใบประกาศอ้างอิงจากวันที่ระบบบันทึกการผ่านระดับสุดท้าย','The completion date is based on the final level mastery recorded by the system.')}</p>
    </section>`;
  requestAnimationFrame(()=>drawCertificate(model));
}

function fitFont(ctx,value,maxWidth,startSize,minSize,family,weight='600'){
  let size=startSize;
  do{ctx.font=`${weight} ${size}px ${family}`;if(ctx.measureText(value).width<=maxWidth)break;size-=2;}while(size>minSize);
  return size;
}
function drawCentered(ctx,value,y,{size=30,minSize=18,maxWidth=1050,color='#505050',weight='500',family="'Noto Sans Thai','Tahoma','Arial',sans-serif"}={}){
  ctx.save();
  ctx.fillStyle=color;
  ctx.textAlign='center';ctx.textBaseline='middle';
  fitFont(ctx,value,maxWidth,size,minSize,family,weight);
  ctx.fillText(value,CANVAS_WIDTH/2,y);
  ctx.restore();
}
function formatDates(date){
  const parsed=safeDate(date);
  if(!parsed) return {th:'—',en:'—'};
  return {
    th:new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric'}).format(parsed),
    en:new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(parsed)
  };
}
function drawCertificate(model){
  const canvas=$('certificateCanvas');
  if(!canvas||!model?.eligible) return null;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
  if(certificateState.template) ctx.drawImage(certificateState.template,0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
  else{ctx.fillStyle='#fffaf3';ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);}
  const dates=formatDates(model.completionDate);
  drawCentered(ctx,'ประกาศนียบัตร',423,{size:48,minSize:34,color:'#9B7428',weight:'700'});
  drawCentered(ctx,'CERTIFICATE OF COMPLETION',468,{size:24,minSize:20,color:'#666',weight:'600',family:"'Georgia','Times New Roman',serif"});
  drawCentered(ctx,'ขอมอบประกาศนียบัตรฉบับนี้ให้แก่ / This certificate is awarded to',525,{size:24,minSize:19,color:'#666'});
  drawCentered(ctx,model.learnerName,592,{size:50,minSize:28,maxWidth:1040,color:'#3f3f3f',weight:'700'});
  ctx.save();ctx.strokeStyle='#C69A42';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(380,627);ctx.lineTo(1112,627);ctx.stroke();ctx.restore();
  drawCentered(ctx,'เพื่อรับรองว่าได้สำเร็จการฝึก Major Scale Notation Trainer ครบทั้ง 4 ระดับ',680,{size:25,minSize:19,color:'#555'});
  drawCentered(ctx,'for successfully completing all four levels of the Major Scale Notation Trainer',720,{size:23,minSize:18,color:'#666',family:"'Arial',sans-serif"});
  drawCentered(ctx,'สาขาวิชาดนตรีสากล มหาวิทยาลัยราชภัฏจันทรเกษม',773,{size:23,minSize:18,color:'#555'});
  drawCentered(ctx,'Western Music Program, Chandrakasem Rajabhat University',808,{size:20,minSize:16,color:'#666',family:"'Arial',sans-serif"});
  drawCentered(ctx,`วันที่สำเร็จ ${dates.th}  ·  Completed ${dates.en}`,862,{size:20,minSize:15,color:'#6b6b6b'});
  drawCentered(ctx,`Certificate ID: ${model.certificateId}`,902,{size:17,minSize:14,color:'#8A6A2B',family:"'Arial',sans-serif",weight:'600'});
  return canvas;
}

function dataUrlBytes(dataUrl){
  const base64=String(dataUrl).split(',')[1]||'';
  const raw=atob(base64),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
  return bytes;
}
function asciiBytes(value){return new TextEncoder().encode(value);}
function concatBytes(parts){
  const total=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(total);
  let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
}
function pdfFromCanvas(canvas){
  const jpeg=dataUrlBytes(canvas.toDataURL('image/jpeg',0.94));
  const content=`q\n${PDF_WIDTH} 0 0 ${PDF_HEIGHT} 0 0 cm\n/Im0 Do\nQ\n`;
  const objects=[
    asciiBytes('<< /Type /Catalog /Pages 2 0 R >>'),
    asciiBytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    concatBytes([asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,asciiBytes('\nendstream')]),
    asciiBytes(`<< /Length ${asciiBytes(content).length} >>\nstream\n${content}endstream`)
  ];
  const chunks=[asciiBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets=[0];
  let length=chunks[0].length;
  objects.forEach((object,index)=>{
    offsets[index+1]=length;
    const wrapped=concatBytes([asciiBytes(`${index+1} 0 obj\n`),object,asciiBytes('\nendobj\n')]);
    chunks.push(wrapped);length+=wrapped.length;
  });
  const xrefOffset=length;
  let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++) xref+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  xref+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(asciiBytes(xref));
  return new Blob(chunks,{type:'application/pdf'});
}
function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function downloadPdf(){
  const model=certificateState.data,canvas=drawCertificate(model);
  if(!model?.eligible||!canvas) return;
  downloadBlob(pdfFromCanvas(canvas),`${model.certificateId}.pdf`);
}
function downloadPng(){
  const model=certificateState.data,canvas=drawCertificate(model);
  if(!model?.eligible||!canvas) return;
  canvas.toBlob(blob=>{if(blob)downloadBlob(blob,`${model.certificateId}.png`);},'image/png');
}

function bind(){
  window.addEventListener('hashchange',syncNavigation);
  window.addEventListener('major-scale:languagechange',()=>{renderPage();ensureCertificateNav();document.querySelectorAll('[data-certificate-nav]').forEach(link=>link.textContent='Certificate');});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('[data-certificate-retry]')){loadData({force:true});return;}
    if(event.target.closest?.('#certificateDownloadPdf')){downloadPdf();return;}
    if(event.target.closest?.('#certificateDownloadPng')){downloadPng();}
  });
}

ensureStylesheet();
ensureCertificateNav();
ensureCertificatePage();
bind();
syncNavigation();
app.certificate=Object.freeze({load:loadData,buildCertificateModel,selectCertificateStages,formatCertificateId,drawCertificate,pdfFromCanvas});
})();