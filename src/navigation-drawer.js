(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
const $=id=>document.getElementById(id);
const NAV_LABELS=Object.freeze({
  dashboard:['⌂','Dashboard','ภาพรวมการเรียน'],
  practice:['♪','Practice','ทำแบบฝึกหัด'],
  progress:['↗','Progress','ติดตามความก้าวหน้า'],
  profile:['◉','Profile','ข้อมูลผู้ใช้'],
  refresh:['↻','Refresh','โหลดข้อมูลอีกครั้ง'],
  login:['→','เข้าสู่ระบบ','เข้าสู่ระบบด้วยบัญชีของคุณ'],
  register:['＋','สมัครสมาชิก','สร้างบัญชีใหม่'],
  forgot:['?','ลืมรหัสผ่าน','ขอลิงก์ตั้งรหัสผ่านใหม่'],
  logout:['↪','ออกจากระบบ','ออกจากบัญชีนี้']
});

let open=false;
let opener=null;
let surface='auth';
let syncQueued=false;
let accountRevision=0;
let lastAccountKey='';

function isVisible(element){
  if(!element || element.hidden) return false;
  if(element.closest('[hidden]')) return false;
  return true;
}

function currentSurface(){
  const onboarding=$('profileOnboardingPanel');
  if(isVisible(onboarding)) return 'onboarding';
  if(isVisible($('trainerApp'))) return 'trainer';
  if(isVisible($('teacherDashboard'))) return 'teacher';
  if(isVisible($('studentDashboard'))) return 'student';
  return 'auth';
}

function visibleAuthBrand(){
  const panel=[...document.querySelectorAll('#authScreen .auth-card')].find(card=>isVisible(card));
  return panel?.querySelector('.auth-brand') || document.querySelector('#authScreen .auth-brand');
}

function hostFor(nextSurface){
  if(nextSurface==='student') return document.querySelector('#studentDashboard .student-dashboard-header');
  if(nextSurface==='teacher') return document.querySelector('#teacherDashboard .student-dashboard-header');
  if(nextSurface==='trainer') return document.querySelector('#trainerApp .session-header');
  return visibleAuthBrand();
}

function createMenuButton(){
  const button=document.createElement('button');
  button.id='appNavigationMenuButton';
  button.type='button';
  button.className='app-nav-menu-button';
  button.setAttribute('aria-label','เปิดเมนูหลัก');
  button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-controls','appNavigationDrawer');
  button.innerHTML='<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
  button.addEventListener('click',()=>open?closeDrawer({restoreFocus:false}):openDrawer(button));
  return button;
}

function createDrawer(){
  const scrim=document.createElement('div');
  scrim.id='appNavigationScrim';
  scrim.className='app-nav-scrim';
  scrim.setAttribute('aria-hidden','true');
  scrim.addEventListener('click',()=>closeDrawer());

  const drawer=document.createElement('nav');
  drawer.id='appNavigationDrawer';
  drawer.className='app-nav-drawer';
  drawer.setAttribute('aria-label','เมนูหลัก');
  drawer.setAttribute('aria-hidden','true');
  drawer.inert=true;
  drawer.innerHTML=`
    <div class="app-nav-drawer-head">
      <div class="app-nav-drawer-brand"><span class="app-nav-drawer-logo" aria-hidden="true">♫</span><div><strong>Major Scale Notation Trainer</strong><span id="appNavigationSurfaceLabel">Navigation</span></div></div>
      <button id="appNavigationCloseButton" class="app-nav-close" type="button" aria-label="ปิดเมนู">×</button>
    </div>
    <div id="appNavigationAccount" class="app-nav-account" tabindex="-1">
      <span id="appNavigationAvatar" class="app-nav-avatar" aria-hidden="true">♪</span>
      <div><strong id="appNavigationUserName">ผู้ใช้งาน</strong><span id="appNavigationUserMeta">Major Scale Notation Trainer</span></div>
    </div>
    <div id="appNavigationItems" class="app-nav-items"></div>
    <div class="app-nav-drawer-foot">เมนูนี้ใช้ร่วมกันทุกหน้าของเว็บแอป</div>`;

  document.body.append(scrim,drawer);
  $('appNavigationCloseButton')?.addEventListener('click',()=>closeDrawer());
  drawer.addEventListener('click',event=>{
    const item=event.target.closest?.('[data-app-nav-action]');
    if(!item || item.disabled || item.getAttribute('aria-disabled')==='true') return;
    handleAction(item.dataset.appNavAction,item);
  });
  return drawer;
}

function ensureShell(){
  if(!$('appNavigationScrim')) createDrawer();
  if(!$('appNavigationMenuButton')) createMenuButton();
}

function menuButton(){
  ensureShell();
  return $('appNavigationMenuButton');
}

function drawer(){
  ensureShell();
  return $('appNavigationDrawer');
}

function setOpenState(nextOpen){
  open=nextOpen;
  const menu=menuButton(),panel=drawer(),scrim=$('appNavigationScrim');
  menu?.setAttribute('aria-expanded',String(nextOpen));
  menu?.setAttribute('aria-label',nextOpen?'ปิดเมนูหลัก':'เปิดเมนูหลัก');
  panel?.setAttribute('aria-hidden',String(!nextOpen));
  if(panel) panel.inert=!nextOpen;
  scrim?.setAttribute('aria-hidden',String(!nextOpen));
  document.documentElement.classList.toggle('app-nav-drawer-open',nextOpen);
  document.body.classList.toggle('app-nav-drawer-open',nextOpen);
}

function focusableInDrawer(){
  const panel=drawer();
  if(!panel) return [];
  return [...panel.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(element=>!element.closest('[hidden]'));
}

function openDrawer(source){
  if(open) return;
  opener=source || document.activeElement || menuButton();
  syncNow();
  setOpenState(true);
  requestAnimationFrame(()=>{
    const current=drawer()?.querySelector('[aria-current="page"]');
    (current || $('appNavigationCloseButton'))?.focus();
  });
}

function closeDrawer({restoreFocus=true}={}){
  if(!open){
    setOpenState(false);
    return;
  }
  setOpenState(false);
  if(restoreFocus){
    const target=opener && document.contains(opener) ? opener : menuButton();
    requestAnimationFrame(()=>target?.focus?.());
  }
  opener=null;
}

function actionMarkup(action,{current=false,disabled=false}={}){
  const [icon,label,detail]=NAV_LABELS[action] || ['',action,''];
  const danger=action==='logout'?' app-nav-item-danger':'';
  return `<button type="button" class="app-nav-item${danger}" data-app-nav-action="${action}"${current?' aria-current="page"':''}${disabled?' disabled aria-disabled="true"':''}><span class="app-nav-item-icon" aria-hidden="true">${icon}</span><span class="app-nav-item-copy"><strong>${label}</strong><small>${detail}</small></span><span class="app-nav-item-chevron" aria-hidden="true">›</span></button>`;
}

function currentStudentAction(){
  if(surface==='trainer') return 'practice';
  if(surface==='onboarding') return 'profile';
  const hash=window.location.hash;
  if(hash==='#sd2Skills') return 'progress';
  if(hash==='#sd2ProfilePanel') return 'profile';
  if(hash==='#sd2Continue') return 'practice';
  return 'dashboard';
}

function renderMenuItems(){
  const target=$('appNavigationItems');
  if(!target) return;
  if(surface==='auth'){
    const loginVisible=isVisible($('loginPanel'));
    const registerVisible=isVisible($('registerPanel'));
    const forgotVisible=isVisible($('forgotPasswordPanel')) || isVisible($('resetPasswordPanel'));
    target.innerHTML=[
      actionMarkup('login',{current:loginVisible}),
      actionMarkup('register',{current:registerVisible}),
      actionMarkup('forgot',{current:forgotVisible})
    ].join('');
    return;
  }
  if(surface==='onboarding'){
    target.innerHTML=`${actionMarkup('dashboard',{disabled:true})}${actionMarkup('practice',{disabled:true})}${actionMarkup('progress',{disabled:true})}${actionMarkup('profile',{current:true})}<div class="app-nav-separator" role="separator"></div>${actionMarkup('logout')}`;
    return;
  }
  if(surface==='teacher'){
    target.innerHTML=`${actionMarkup('dashboard',{current:true})}${actionMarkup('profile')}<div class="app-nav-separator" role="separator"></div>${actionMarkup('refresh')}${actionMarkup('logout')}`;
    return;
  }
  const current=currentStudentAction();
  target.innerHTML=`${actionMarkup('dashboard',{current:current==='dashboard'})}${actionMarkup('practice',{current:current==='practice'})}${actionMarkup('progress',{current:current==='progress'})}${actionMarkup('profile',{current:current==='profile'})}<div class="app-nav-separator" role="separator"></div>${actionMarkup('logout')}`;
}

function setSurfaceLabel(){
  const label=$('appNavigationSurfaceLabel');
  if(!label) return;
  label.textContent=surface==='teacher'?'Teacher Dashboard':surface==='trainer'?'Practice':surface==='student'?'Student Dashboard':surface==='onboarding'?'Profile Setup':'Account';
}

function accountFallbackName(){
  const student=$('dashboardUserName')?.textContent?.trim();
  const teacher=$('teacherDashboardUserName')?.textContent?.trim();
  if(surface==='teacher' && teacher) return teacher;
  if(student && student!=='ผู้เรียน') return student;
  const email=$('profileOnboardingEmail')?.textContent?.trim();
  return email && email!=='—' ? email : 'ผู้ใช้งาน';
}

async function syncAccount(){
  const rev=++accountRevision;
  let user=null,profile=null;
  try{
    const result=await app.authRepository?.getUser?.();
    user=result?.data?.user || null;
    if(user?.id && surface!=='teacher' && app.dashboardRepository?.getStudentProfileDetails){
      const profileResult=await app.dashboardRepository.getStudentProfileDetails(user.id);
      if(!profileResult?.error) profile=profileResult?.data || null;
    }else if(user?.id && surface==='teacher' && app.dashboardRepository?.getTeacherProfile){
      const profileResult=await app.dashboardRepository.getTeacherProfile(user.id);
      if(!profileResult?.error) profile=profileResult?.data || null;
    }
  }catch(_error){
    // Account text can fall back to the already-rendered header identity.
  }
  if(rev!==accountRevision) return;
  const meta=user?.user_metadata || {};
  const fullName=[profile?.first_name,profile?.last_name].filter(Boolean).join(' ').trim()
    || profile?.full_name
    || meta.full_name
    || meta.name
    || accountFallbackName();
  const email=user?.email || ($('profileOnboardingEmail')?.textContent?.trim() || '');
  const avatarUrl=profile?.avatar_url || meta.avatar_url || meta.picture || '';
  const key=[fullName,email,avatarUrl,surface].join('|');
  if(key===lastAccountKey) return;
  lastAccountKey=key;
  const name=$('appNavigationUserName'),detail=$('appNavigationUserMeta'),avatar=$('appNavigationAvatar');
  if(name) name.textContent=fullName || 'ผู้ใช้งาน';
  if(detail) detail.textContent=email || (surface==='teacher'?'ผู้สอน':'ผู้เรียน');
  if(avatar){
    avatar.textContent=avatarUrl?'':'♪';
    avatar.style.backgroundImage=avatarUrl?`url("${String(avatarUrl).replace(/["\\]/g,'')}")`:'';
    avatar.classList.toggle('has-image',!!avatarUrl);
  }
}

function hiddenStudentNav(action){
  return document.querySelector(`#sd2TopNav [data-sd2-nav="${action}"]`);
}

function dispatchStudentAction(action){
  const link=hiddenStudentNav(action);
  if(link){
    link.click();
    return true;
  }
  if(action==='dashboard'){
    const target=$('dashboardContent');
    if(target){
      window.location.hash='dashboardContent';
      target.scrollIntoView({behavior:'smooth',block:'start'});
      return true;
    }
  }
  if(action==='progress'){
    const target=$('sd2Skills');
    if(target){
      window.location.hash='sd2Skills';
      target.scrollIntoView({behavior:'smooth',block:'start'});
      return true;
    }
  }
  return false;
}

function afterStudentDashboardVisible(callback,tries=40){
  if(isVisible($('studentDashboard'))){callback();return;}
  if(tries<=0)return;
  setTimeout(()=>afterStudentDashboardVisible(callback,tries-1),25);
}

function goStudent(action){
  if(surface==='trainer'){
    if(action==='practice') return true;
    $('dashboardButton')?.click();
    afterStudentDashboardVisible(()=>dispatchStudentAction(action));
    return true;
  }
  return dispatchStudentAction(action);
}

function showTeacherProfile(){
  openDrawer(menuButton());
  const account=$('appNavigationAccount');
  account?.classList.add('is-profile-focus');
  account?.focus();
  setTimeout(()=>account?.classList.remove('is-profile-focus'),900);
}

function doLogout(){
  const candidates=['profileOnboardingLogoutButton','logoutButton','dashboardLogoutButton','teacherDashboardLogoutButton'];
  const visible=candidates.map($).find(isVisible) || candidates.map($).find(Boolean);
  visible?.click();
}

function handleAuthAction(action){
  if(action==='login'){
    ($('showLoginButton') || $('showLoginFromForgotButton') || $('cancelResetPasswordButton'))?.click();
    return;
  }
  if(action==='register'){
    $('showRegisterButton')?.click();
    return;
  }
  if(action==='forgot'){
    $('showForgotPasswordButton')?.click();
  }
}

function handleAction(action,item){
  if(surface==='auth'){
    closeDrawer({restoreFocus:false});
    handleAuthAction(action);
    queueSync();
    return;
  }
  if(action==='logout'){
    closeDrawer({restoreFocus:false});
    doLogout();
    return;
  }
  if(surface==='teacher'){
    if(action==='refresh'){
      closeDrawer({restoreFocus:false});
      $('teacherDashboardRefreshButton')?.click();
      return;
    }
    if(action==='profile'){
      showTeacherProfile();
      return;
    }
    closeDrawer({restoreFocus:false});
    document.querySelector('#teacherDashboard .student-dashboard-header')?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  if(surface==='onboarding'){
    if(action==='profile'){
      closeDrawer({restoreFocus:false});
      $('profileOnboardingForm')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
    return;
  }
  closeDrawer({restoreFocus:false});
  goStudent(action);
  queueSync();
}

function wireHeaderProfile(element,kind){
  if(!element || element.dataset.appNavProfileWired==='true') return;
  element.dataset.appNavProfileWired='true';
  element.classList.add('app-header-profile-button');
  if(element.tagName!=='BUTTON'){
    element.setAttribute('role','button');
    element.tabIndex=0;
  }
  element.setAttribute('aria-label',kind==='teacher'?'เปิดข้อมูลผู้สอน':'เปิดโปรไฟล์');
  const activate=event=>{
    if(event.type==='keydown' && !['Enter',' '].includes(event.key)) return;
    if(event.type==='keydown') event.preventDefault();
    if(kind==='teacher') showTeacherProfile();
    else {
      if(surface==='trainer'){
        $('dashboardButton')?.click();
        afterStudentDashboardVisible(()=>dispatchStudentAction('profile'));
      }else dispatchStudentAction('profile');
    }
  };
  element.addEventListener('click',activate);
  element.addEventListener('keydown',activate);
}

function ensureTrainerProfileButton(){
  const header=document.querySelector('#trainerApp .session-header');
  const logout=$('logoutButton');
  if(!header || !logout) return;
  let button=$('trainerHeaderProfileButton');
  if(!button){
    button=document.createElement('button');
    button.id='trainerHeaderProfileButton';
    button.type='button';
    button.className='btn auth-logout app-header-profile-button';
    button.textContent='Profile';
    logout.insertAdjacentElement('beforebegin',button);
  }
  wireHeaderProfile(button,'student');
  $('dashboardButton')?.classList.add('app-nav-moved-action');
}

function ensureTeacherProfileButton(){
  wireHeaderProfile($('teacherDashboardUserName'),'teacher');
}

function ensureStudentProfileButton(){
  wireHeaderProfile($('dashboardUserName'),'student');
}

function attachMenuToHost(){
  const host=hostFor(surface),button=menuButton();
  if(!host || !button) return;
  if(button.parentElement!==host) host.insertBefore(button,host.firstChild);
  document.querySelectorAll('.app-nav-host').forEach(element=>element.classList.remove('app-nav-host'));
  host.classList.add('app-nav-host');
}

function syncNow(){
  ensureShell();
  const next=currentSurface();
  if(next!==surface && open) closeDrawer({restoreFocus:false});
  surface=next;
  attachMenuToHost();
  ensureStudentProfileButton();
  ensureTeacherProfileButton();
  ensureTrainerProfileButton();
  renderMenuItems();
  setSurfaceLabel();
  syncAccount();
}

function queueSync(){
  if(syncQueued) return;
  syncQueued=true;
  requestAnimationFrame(()=>{
    syncQueued=false;
    syncNow();
  });
}

function onKeydown(event){
  if(!open) return;
  if(event.key==='Escape'){
    event.preventDefault();
    closeDrawer();
    return;
  }
  if(event.key!=='Tab') return;
  const items=focusableInDrawer();
  if(!items.length) return;
  const first=items[0],last=items[items.length-1];
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
}

document.addEventListener('keydown',onKeydown);
window.addEventListener('hashchange',queueSync);
window.addEventListener('pageshow',queueSync);

function start(){
  ensureShell();
  syncNow();
  const observer=new MutationObserver(queueSync);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','inert']});
  app.navigationDrawer=Object.freeze({open:()=>openDrawer(menuButton()),close:()=>closeDrawer(),sync:syncNow,currentSurface:()=>surface});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
