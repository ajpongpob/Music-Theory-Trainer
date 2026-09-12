from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'tests/dashboard-runtime-smoke.test.js'
text=path.read_text(encoding='utf-8')

old="""      async signInWithPassword(){calls.signIn++; currentUser=teacher; const session={user:currentUser}; queueMicrotask(()=>cb?.('SIGNED_IN',session)); return {data:{session},error:null};},"""
new="""      async signInWithPassword({email}={}){calls.signIn++; currentUser=email==='student@example.com'?student:teacher; const session={user:currentUser}; queueMicrotask(()=>cb?.('SIGNED_IN',session)); return {data:{session},error:null};},"""
if text.count(old)!=1: raise SystemExit(f'signIn mock expected 1 match, found {text.count(old)}')
text=text.replace(old,new,1)

student_check="""    check('student dashboard visible',get('studentDashboard').hidden===false,get('studentDashboard').hidden);"""
student_new=student_check+"\n    check('refresh/session restore keeps the authenticated student',get('dashboardUserName').textContent.includes('Student Test'),get('dashboardUserName').textContent);"
if text.count(student_check)!=1: raise SystemExit(f'student refresh insertion expected 1 match, found {text.count(student_check)}')
text=text.replace(student_check,student_new,1)

marker="""  if(scenario==='forgot'){
"""
switch_block="""  if(scenario==='switchUser'){
    check('auth initially visible for switch-user flow',get('authScreen').hidden===false,get('authScreen').hidden);
    get('loginEmail').value='student@example.com'; get('loginPassword').value='password'; get('loginButton').click();
    await new Promise(r=>setTimeout(r,30));
    check('student login visible before switch',get('studentDashboard').hidden===false && get('dashboardUserName').textContent.includes('Student Test'),get('dashboardUserName').textContent);
    let launchCount=0,closeCount=0;
    ctx.majorScaleTrainerStartForAuthenticatedUser=async()=>{launchCount++;};
    ctx.majorScaleTrainerClosePracticeSession=async()=>{closeCount++;};
    get('studentDashboard').dispatch('click',{target:{closest(){return {dataset:{exerciseCode:'MAJOR_SCALE_NOTATION',stageCode:'STAGE_2',sessionMode:'practice'}};}}});
    await new Promise(r=>setTimeout(r,20));
    check('student exercise host context belongs to student-1',launchCount===1 && ctx.MajorScaleApp.exerciseHost.getCurrentContext()?.userId==='student-1',ctx.MajorScaleApp.exerciseHost.getCurrentContext()?.userId);
    get('logoutButton').click();
    await new Promise(r=>setTimeout(r,25));
    check('logout clears prior user exercise/session context',get('authScreen').hidden===false && ctx.MajorScaleApp.exerciseHost.getCurrentContext()===null && closeCount===1,ctx.MajorScaleApp.exerciseHost.getCurrentContext()?.userId||'cleared');
    get('loginEmail').value='teacher@example.com'; get('loginPassword').value='password'; get('loginButton').click();
    await new Promise(r=>setTimeout(r,35));
    check('new teacher login replaces prior student',get('teacherDashboard').hidden===false && get('teacherDashboardUserName').textContent.includes('Teacher Test'),get('teacherDashboardUserName').textContent);
    check('new login does not inherit prior exercise host context',ctx.MajorScaleApp.exerciseHost.getCurrentContext()===null,ctx.MajorScaleApp.exerciseHost.getCurrentContext()?.userId||'clear');
    check('two distinct login operations completed',ctx.__mockCalls.signIn===2,ctx.__mockCalls.signIn);
  }
"""+marker
if text.count(marker)!=1: raise SystemExit(f'switch-user block insertion expected 1 match, found {text.count(marker)}')
text=text.replace(marker,switch_block,1)

old_list="""for(const s of ['teacher','student','loginTeacher','forgot','recovery'])"""
new_list="""for(const s of ['teacher','student','loginTeacher','switchUser','forgot','recovery'])"""
if text.count(old_list)!=1: raise SystemExit(f'scenario list expected 1 match, found {text.count(old_list)}')
text=text.replace(old_list,new_list,1)

path.write_text(text,encoding='utf-8')
print('Added refresh and cross-user auth/session isolation regression scenario')
