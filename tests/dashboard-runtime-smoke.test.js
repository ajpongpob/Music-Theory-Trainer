const fs=require('fs');
const vm=require('vm');
const path=require('path');
const ROOT=process.env.QA_ROOT || path.resolve(__dirname,'..');

class MockElement {
  constructor(id, tag='div', hidden=false){
    this.id=id; this.tagName=tag.toUpperCase(); this.hidden=hidden; this.inert=false;
    this.disabled=false; this.value=''; this.textContent=''; this.className=''; this.dataset={};
    this.listeners={}; this.options=[]; this.onclick=null; this.style={}; this.inner='';
  }
  addEventListener(type,cb){(this.listeners[type] ||= []).push(cb);}
  click(){
    const ev={target:this,currentTarget:this,preventDefault(){},stopImmediatePropagation(){}};
    if(typeof this.onclick==='function') this.onclick(ev);
    for(const cb of this.listeners.click||[]) cb(ev);
  }
  dispatch(type, extra={}){
    const ev={target:this,currentTarget:this,preventDefault(){},stopImmediatePropagation(){},...extra};
    for(const cb of this.listeners[type]||[]) cb(ev);
  }
  checkValidity(){return true;}
  focus(){}
  closest(sel){return null;}
  querySelectorAll(){return [];}
  set innerHTML(v){
    this.inner=String(v); this.textContent=this.inner.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(this.tagName==='SELECT'){
      this.options=[];
      const re=/<option\s+value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi; let m;
      while((m=re.exec(this.inner))) this.options.push({value:m[1],textContent:m[2].replace(/<[^>]*>/g,'')});
      if(this.options.length && !this.options.some(o=>o.value===this.value)) this.value=this.options[0].value;
      if(!this.options.length) this.value='';
    }
  }
  get innerHTML(){return this.inner;}
}

function parseElements(html){
  const elements=new Map();
  const re=/<([a-zA-Z0-9]+)([^>]*\bid="([^"]+)"[^>]*)>/g; let m;
  while((m=re.exec(html))){
    const tag=m[1], attrs=m[2], id=m[3];
    const el=new MockElement(id,tag,/\bhidden\b/.test(attrs));
    const val=/\bvalue="([^"]*)"/.exec(attrs); if(val) el.value=val[1];
    const cls=/\bclass="([^"]*)"/.exec(attrs); if(cls) el.className=cls[1];
    elements.set(id,el);
  }
  return elements;
}

function makeClient(scenario, ctx){
  const teacher={id:'teacher-1',email:'teacher@example.com',user_metadata:{full_name:'Teacher Test'}};
  const student={id:'student-1',email:'student@example.com',user_metadata:{full_name:'Student Test'}};
  let currentUser = scenario==='teacher'||scenario==='recovery' ? teacher : scenario==='student' ? student : null;
  let cb=null;
  const calls={rpc:[],from:[],signIn:0,reset:0,updatePassword:0,signOut:0};
  ctx.__mockCalls=calls;
  const teacherSummary=[{class_id:'class-1',class_code:'MT-TEST-01',class_name:'ห้องเรียนทดสอบทฤษฎีดนตรี',academic_year:'2569',term:'1',class_active:true,student_count:1,learning_path_id:'path-1',learning_path_code:'MUSIC_THEORY_FOUNDATIONS',learning_path_name:'เส้นทางการเรียนรู้พื้นฐานทฤษฎีดนตรี',learning_path_sort_order:10,assigned_at:'2026-09-11T15:34:38Z'}];
  const teacherDetail=[{class_id:'class-1',class_code:'MT-TEST-01',class_name:'ห้องเรียนทดสอบทฤษฎีดนตรี',academic_year:'2569',term:'1',student_id:'student-1',student_name:'test2',learning_path_id:'path-1',learning_path_code:'MUSIC_THEORY_FOUNDATIONS',learning_path_name:'เส้นทางการเรียนรู้พื้นฐานทฤษฎีดนตรี',learning_path_status:'mastered',learning_status:'completed',path_started_at:'2026-09-11T12:52:04Z',path_mastered_at:'2026-09-11T14:48:23Z',exercise_id:'exercise-1',exercise_code:'MAJOR_SCALE_NOTATION',exercise_name:'การเขียนบันไดเสียงเมเจอร์',exercise_sequence:10,required_for_completion:true,exercise_status:'mastered',stages_mastered:4,stages_total:4,current_stage_id:null,current_stage_code:null,current_stage_name:null,current_stage_sequence:null,latest_mastery_score:100}];
  const studentRows=[1,2,3,4].map((n)=>({learning_path_id:'path-1',learning_path_code:'MUSIC_THEORY_FOUNDATIONS',learning_path_name:'เส้นทางการเรียนรู้พื้นฐานทฤษฎีดนตรี',learning_path_status:'in_progress',enrolled_at:'2026-09-01T00:00:00Z',path_started_at:'2026-09-02T00:00:00Z',path_mastered_at:null,exercise_id:'exercise-1',exercise_code:'MAJOR_SCALE_NOTATION',exercise_name:'การเขียนบันไดเสียงเมเจอร์',exercise_sequence:10,required_for_completion:true,exercise_status:'in_progress',exercise_started_at:'2026-09-02T00:00:00Z',exercise_mastered_at:null,stage_id:'stage-'+n,stage_code:'STAGE_'+n,stage_name:'Stage '+n,stage_sequence:n*10,stage_status:n===1?'mastered':n===2?'in_progress':'locked',last_mastery_score:n===1?95:n===2?80:null,stage_started_at:n<=2?'2026-09-02T00:00:00Z':null,stage_mastered_at:n===1?'2026-09-03T00:00:00Z':null}));
  const mastery=[{overall_score:80,overall_threshold:90,attempts_found:5,rolling_window:10,coverage_passed:true,skills_passed:false,mastery_passed:false,enough_attempts:false,skill_results:[{skill_code:'BN01_TREBLE_PITCH',score:92,threshold:90,passed:true},{skill_code:'GR02_PRIMARY_BEAM',score:70,threshold:85,passed:false}]}];
  const skills=[{code:'BN01_TREBLE_PITCH',short_name:'Pitch',name_th:'ระดับเสียงบนบรรทัดห้าเส้น'},{code:'GR02_PRIMARY_BEAM',short_name:'Beam',name_th:'การเชื่อมเขบ็ต'}];
  function resultFor(table){
    if(table==='profiles') return {full_name:currentUser===teacher?'Teacher Test':'Student Test',role:currentUser===teacher?'teacher':'student'};
    if(table==='skills') return skills;
    return [];
  }
  function query(table){
    calls.from.push(table);
    const q={select(){return q;},eq(){return q;},insert(){return q;},update(){return q;},order(){return q;},limit(){return q;},maybeSingle(){return Promise.resolve({data:resultFor(table),error:null});},single(){return Promise.resolve({data:resultFor(table),error:null});},then(res,rej){return Promise.resolve({data:resultFor(table),error:null}).then(res,rej);}};
    return q;
  }
  return {
    auth:{
      getSession:async()=>({data:{session:currentUser?{user:currentUser}:null},error:null}),
      getUser:async()=>({data:{user:currentUser},error:null}),
      onAuthStateChange(fn){cb=fn; return {data:{subscription:{unsubscribe(){}}}};},
      async signInWithPassword(){calls.signIn++; currentUser=teacher; const session={user:currentUser}; queueMicrotask(()=>cb?.('SIGNED_IN',session)); return {data:{session},error:null};},
      async signUp(){return {data:{session:null,user:{id:'new'}},error:null};},
      async signOut(){calls.signOut++; currentUser=null; queueMicrotask(()=>cb?.('SIGNED_OUT',null)); return {error:null};},
      async resetPasswordForEmail(){calls.reset++; return {data:{},error:null};},
      async updateUser(){calls.updatePassword++; return {data:{user:currentUser},error:null};}
    },
    from:query,
    async rpc(name,args){calls.rpc.push({name,args}); if(name==='get_my_teacher_dashboard') return {data:teacherSummary,error:null}; if(name==='get_my_teacher_class_dashboard') return {data:teacherDetail,error:null}; if(name==='get_my_student_dashboard') return {data:studentRows,error:null}; if(name==='get_my_stage_mastery') return {data:mastery,error:null}; if(name==='ensure_my_learning_path_progression') return {data:[{learning_path_code:'MUSIC_THEORY_FOUNDATIONS',current_exercise_code:'MAJOR_SCALE_NOTATION',current_stage_code:'STAGE_2'}],error:null}; if(name==='get_my_recommended_next_action') return {data:[{learning_path_code:'MUSIC_THEORY_FOUNDATIONS',exercise_code:'MAJOR_SCALE_NOTATION',stage_code:'STAGE_2',action_type:'diagnostic',target_skill_code:null,target_item_code:null,reason_code:'NO_STAGE_EVIDENCE',reason_th:'เริ่มแบบประเมินก่อนเรียน',overall_score:null,overall_threshold:null,attempts_found:0,rolling_window:10}],error:null}; if(name==='get_my_exercise_diagnostic') return {data:[],error:null}; if(name==='apply_my_diagnostic_placement') return {data:[{applied:true,exercise_code:'MAJOR_SCALE_NOTATION',placement_stage_code:'STAGE_2',diagnostic_mastered_stages:1,exercise_mastered:false,reason_code:'DIAGNOSTIC_PLACED'}],error:null}; if(name==='get_my_stage_evidence') return {data:mastery,error:null}; return {data:null,error:null};}
  };
}

async function runScenario(scenario){
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const elements=parseElements(html);
  const docListeners={}; const winListeners={};
  const logs={error:[],warn:[]};
  const document={
    title:'Major Scale Notation Trainer', location:null, activeElement:null,
    documentElement:{classList:{remove(){},add(){}}},
    getElementById(id){return elements.get(id)||null;},
    addEventListener(type,cb){(docListeners[type] ||= []).push(cb);},
    querySelectorAll(){return [];}
  };
  const href='https://example.test/'+(scenario==='recovery'?'?mode=reset-password':'');
  const ctx={
    console:{log(){},warn(...a){logs.warn.push(a.join(' '));},error(...a){logs.error.push(a.join(' '));}},
    document, location:new URL(href), history:{replaceState(){}}, URL, URLSearchParams, Intl, Date, Map, Set, WeakMap, WeakSet, Promise, Object, Array, String, Number, Boolean, RegExp, Math, JSON,
    setTimeout,clearTimeout,queueMicrotask,
    requestAnimationFrame:(cb)=>setTimeout(cb,0), cancelAnimationFrame:clearTimeout,
    Event:class Event{constructor(type){this.type=type;}},
    alert(){},confirm(){return true;},
  };
  ctx.window=ctx; ctx.globalThis=ctx;
  ctx.addEventListener=(type,cb)=>{(winListeners[type] ||= []).push(cb);};
  ctx.dispatchEvent=(ev)=>{for(const cb of winListeners[ev.type]||[]) cb(ev);};
  ctx.history=ctx.history; ctx.window.history=ctx.history;
  ctx.window.location=ctx.location;
  ctx.window.supabase={createClient(){const c=makeClient(scenario,ctx); ctx.__client=c; return c;}};
  vm.createContext(ctx);
  const scripts=[...html.matchAll(/<script\s+src="\.\/(src\/[^"]+\.js)"/g)].map(m=>m[1]).filter(f=>!['src/trainer.js','src/keyboard.js'].includes(f));
  for(const f of scripts){
    try{vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});}
    catch(e){return {scenario,loadError:String(e.stack||e),logs,elements,ctx};}
  }
  for(const cb of docListeners.DOMContentLoaded||[]){try{cb({type:'DOMContentLoaded'});}catch(e){logs.error.push('DOMContentLoaded '+(e.stack||e));}}
  await new Promise(r=>setTimeout(r,30));
  const get=id=>elements.get(id);
  const checks=[]; const check=(name,cond,detail='')=>checks.push({name,pass:!!cond,detail:String(detail)});
  if(scenario==='teacher'){
    check('teacher dashboard visible',get('teacherDashboard').hidden===false,get('teacherDashboard').hidden);
    check('teacher content visible',get('teacherDashboardContent').hidden===false,get('teacherDashboardMessage').textContent);
    check('teacher error banner absent',!get('teacherDashboardMessage').className.includes('error'),get('teacherDashboardMessage').textContent);
    check('teacher name',get('teacherDashboardUserName').textContent.includes('Teacher Test'),get('teacherDashboardUserName').textContent);
    check('class options',get('teacherClassSelect').options.length===1,get('teacherClassSelect').options.length);
    check('class meta',get('teacherClassMeta').textContent.includes('MT-TEST-01'),get('teacherClassMeta').textContent);
    check('student count',get('teacherStudentCount').textContent==='1',get('teacherStudentCount').textContent);
    check('path count',get('teacherPathCount').textContent==='1',get('teacherPathCount').textContent);
    check('completed count',get('teacherCompletedCount').textContent==='1',get('teacherCompletedCount').textContent);
    check('student list',get('teacherStudentList').innerHTML.includes('test2'),get('teacherStudentList').innerHTML.slice(0,150));
    check('mastery 100',get('teacherStudentList').innerHTML.includes('100%'));
    check('assigned path date function executed',get('teacherAssignedPaths').innerHTML.includes('มอบหมาย'),get('teacherAssignedPaths').innerHTML);
    get('teacherDashboardRefreshButton').click(); await new Promise(r=>setTimeout(r,20));
    check('teacher refresh no error',!get('teacherDashboardMessage').className.includes('error'),get('teacherDashboardMessage').textContent);
  }
  if(scenario==='student'){
    check('student dashboard visible',get('studentDashboard').hidden===false,get('studentDashboard').hidden);
    check('student content visible',get('dashboardContent').hidden===false,get('dashboardMessage').textContent);
    check('student name',get('dashboardUserName').textContent.includes('Student Test'),get('dashboardUserName').textContent);
    check('path rendered',get('dashboardPathList').innerHTML.includes('MUSIC_THEORY_FOUNDATIONS'));
    check('stage2 rendered',get('dashboardPathList').innerHTML.includes('Stage 2'));
    check('mastery rendered',get('dashboardMasteryBody').innerHTML.includes('80%'),get('dashboardMasteryBody').innerHTML.slice(0,200));
    check('recommended next action rendered',get('dashboardRecommendation').innerHTML.includes('แบบประเมินก่อนเรียน'),get('dashboardRecommendation').innerHTML);
    let launchCount=0,closeCount=0,lastLevel=null;
    let lastMode=null;ctx.majorScaleTrainerStartForAuthenticatedUser=async (level,mode)=>{launchCount++;lastLevel=level;lastMode=mode;};
    ctx.majorScaleTrainerClosePracticeSession=async()=>{closeCount++;};
    const clickExercise=code=>get('studentDashboard').dispatch('click',{
      target:{closest(){return {dataset:{exerciseCode:code,stageCode:'STAGE_2'}};}}
    });
    clickExercise(' major_scale_notation ');clickExercise(' major_scale_notation ');
    await new Promise(r=>setTimeout(r,20));
    check('Dashboard Host adapter launches exactly once',launchCount===1 && lastLevel===2);
    check('Host receives stage and user',ctx.MajorScaleApp.exerciseHost.getCurrentContext()?.stageCode==='STAGE_2' && ctx.MajorScaleApp.exerciseHost.getCurrentContext()?.userId==='student-1' && lastMode==='practice');
    check('trainer visible through adapter',get('trainerApp').hidden===false);
    get('dashboardButton').click();await new Promise(r=>setTimeout(r,30));
    check('return clears Host and closes once',ctx.MajorScaleApp.exerciseHost.getCurrentContext()===null && closeCount===1);
    check('return refreshes Dashboard',get('studentDashboard').hidden===false);
    clickExercise('INTERVAL_WRITING');await new Promise(r=>setTimeout(r,10));
    check('unsupported stays Dashboard without Major Scale launch',launchCount===1 && get('studentDashboard').hidden===false);
    clickExercise('MAJOR_SCALE_NOTATION');await new Promise(r=>setTimeout(r,10));
    check('reopen after return',launchCount===2);
    get('logoutButton').click();await new Promise(r=>setTimeout(r,20));
    check('logout clears Host and closes once more',ctx.MajorScaleApp.exerciseHost.getCurrentContext()===null && closeCount===2);
  }
  if(scenario==='loginTeacher'){
    check('auth initially visible',get('authScreen').hidden===false,get('authScreen').hidden);
    get('loginEmail').value='teacher@example.com'; get('loginPassword').value='password'; get('loginButton').click();
    await new Promise(r=>setTimeout(r,30));
    check('signIn called',ctx.__mockCalls.signIn===1,ctx.__mockCalls.signIn);
    check('teacher visible after login',get('teacherDashboard').hidden===false,get('teacherDashboard').hidden);
    check('teacher data after login',get('teacherStudentList').innerHTML.includes('test2'),get('teacherDashboardMessage').textContent);
  }
  if(scenario==='forgot'){
    get('showForgotPasswordButton').click(); get('forgotEmail').value='student@example.com'; get('forgotPasswordButton').click(); await new Promise(r=>setTimeout(r,10));
    check('reset called',ctx.__mockCalls.reset===1,ctx.__mockCalls.reset);
    check('confirmation',get('forgotMessage').textContent.includes('ส่งลิงก์'),get('forgotMessage').textContent);
  }
  if(scenario==='recovery'){
    check('reset panel visible',get('resetPasswordPanel').hidden===false,get('resetPasswordPanel').hidden);
    get('resetPassword').value='newpass'; get('resetPasswordConfirm').value='newpass'; get('resetPasswordButton').click(); await new Promise(r=>setTimeout(r,30));
    check('update password called',ctx.__mockCalls.updatePassword===1,ctx.__mockCalls.updatePassword);
    check('signout called',ctx.__mockCalls.signOut>=1,ctx.__mockCalls.signOut);
    check('login panel visible',get('loginPanel').hidden===false,get('loginPanel').hidden);
  }
  check('no console.error',logs.error.length===0,logs.error.join('\n'));
  return {scenario,checks,failed:checks.filter(x=>!x.pass),logs};
}

(async()=>{
  let any=false;
  for(const s of ['teacher','student','loginTeacher','forgot','recovery']){
    const r=await runScenario(s);
    console.log(JSON.stringify(r,null,2));
    if(r.loadError || r.failed?.length) any=true;
  }
  process.exitCode=any?1:0;
})();
