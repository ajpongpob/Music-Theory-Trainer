
(() => {
'use strict';
function ensureMobileSafariFixStylesheet(){
  if(
    typeof document==='undefined' ||
    typeof document.querySelector!=='function' ||
    typeof document.createElement!=='function' ||
    !document.head
  ) return;
  if(document.querySelector('link[data-mobile-safari-fix]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./styles/mobile-safari-fix.css';
  link.setAttribute('data-mobile-safari-fix','true');
  document.head.appendChild(link);
}
ensureMobileSafariFixStylesheet();

const $ = id => document.getElementById(id);
const screen = $('authScreen'), dashboard = $('studentDashboard'), teacherDashboard = $('teacherDashboard'), trainer = $('trainerApp');
const app = window.MajorScaleApp || {};
const authRepository = app.authRepository;
const client = app.supabaseClient;
const studentDashboardController = app.studentDashboard;
const teacherDashboardController = app.teacherDashboard;
let busy = false, ready = false, revision = 0, activeUser = null;
const PASSWORD_RESET_REDIRECT = 'https://ajpongpob.github.io/Music-Theory-Trainer/?mode=reset-password';
const OAUTH_DEFAULT_REDIRECT = 'https://ajpongpob.github.io/Music-Theory-Trainer/';
const passwordRecoveryIntentFromUrl = (() => {
  try{
    const url=new URL(window.location.href);
    const hashParams=new URLSearchParams((url.hash || '').replace(/^#/,''));
    return url.searchParams.get('mode')==='reset-password' || hashParams.get('type')==='recovery';
  }catch(_error){
    return false;
  }
})();
let currentUserRole = null, passwordRecoveryMode = passwordRecoveryIntentFromUrl;
function message(id, text = '', error = false) {
  $(id).textContent = text;
  $(id).className = 'auth-message' + (error ? ' error' : '');
}
function controls() {
  [
    'loginButton','registerButton','showLoginButton','showRegisterButton',
    'googleLoginButton','googleRegisterButton',
    'showForgotPasswordButton','forgotPasswordButton','showLoginFromForgotButton',
    'resetPasswordButton','cancelResetPasswordButton',
    'logoutButton','dashboardLogoutButton','teacherDashboardLogoutButton',
    'teacherDashboardRefreshButton','dashboardButton'
  ].forEach(id => {
    const control=$(id);
    if(control) control.disabled = busy || !ready;
  });
}
function oauthRedirectUrl(){
  try{
    const url=new URL(window.location.href);
    url.search='';
    url.hash='';
    return url.href;
  }catch(_error){
    return OAUTH_DEFAULT_REDIRECT;
  }
}
function authRedirectErrorFromUrl(){
  try{
    const url=new URL(window.location.href);
    const hashParams=new URLSearchParams((url.hash || '').replace(/^#/,''));
    const code=url.searchParams.get('error_code') || hashParams.get('error_code') || url.searchParams.get('error') || hashParams.get('error');
    if(!code) return '';
    return url.searchParams.get('error_description') || hashParams.get('error_description') || code;
  }catch(_error){
    return '';
  }
}
function ensureGoogleAuthControls(){
  if(typeof document==='undefined' || typeof document.createElement!=='function') return;
  if(!document.querySelector('style[data-google-auth-style]')){
    const style=document.createElement('style');
    style.setAttribute('data-google-auth-style','true');
    style.textContent=`
      .auth-oauth-block{margin-top:14px}
      .auth-oauth-divider{display:flex;align-items:center;gap:10px;margin:2px 0 10px;color:#64748b;font-size:.82rem}
      .auth-oauth-divider::before,.auth-oauth-divider::after{content:"";height:1px;background:#d7dee8;flex:1}
      .auth-google-button{width:100%;min-height:44px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#1f2937;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.05)}
      .auth-google-button:hover:not(:disabled){background:#f8fafc;border-color:#94a3b8}
      .auth-google-button:focus-visible{outline:3px solid rgba(37,99,235,.28);outline-offset:2px}
      .auth-google-button:disabled{opacity:.55;cursor:not-allowed}
      .auth-google-mark{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:50%;font-weight:800;color:#2563eb;background:#eff6ff}
    `;
    document.head?.appendChild(style);
  }

  const configs=[
    {panel:'loginPanel',anchor:'loginButton',id:'googleLoginButton',label:'เข้าสู่ระบบด้วย Google',messageId:'loginMessage'},
    {panel:'registerPanel',anchor:'registerButton',id:'googleRegisterButton',label:'สมัครหรือเข้าสู่ระบบด้วย Google',messageId:'registerMessage'}
  ];
  for(const config of configs){
    if($(config.id)) continue;
    const panel=$(config.panel), anchor=$(config.anchor);
    if(!panel || !anchor) continue;
    const block=document.createElement('div');
    block.className='auth-oauth-block';
    const divider=document.createElement('div');
    divider.className='auth-oauth-divider';
    divider.textContent='หรือ';
    const button=document.createElement('button');
    button.id=config.id;
    button.type='button';
    button.className='auth-google-button';
    button.setAttribute('aria-label',config.label);
    button.innerHTML='<span class="auth-google-mark" aria-hidden="true">G</span><span></span>';
    button.lastElementChild.textContent=config.label;
    button.addEventListener('click',()=>signInWithGoogle(config.messageId));
    block.append(divider,button);
    anchor.insertAdjacentElement('afterend',block);
  }
}
function showAuthPanel(name) {
  const panels={
    login:$('loginPanel'),
    register:$('registerPanel'),
    forgot:$('forgotPasswordPanel'),
    reset:$('resetPasswordPanel')
  };
  Object.entries(panels).forEach(([key,element])=>{
    if(element) element.hidden=key!==name;
  });
}
function panel(register) {
  showAuthPanel(register ? 'register' : 'login');
  message('loginMessage');
  message('registerMessage');
  message('forgotMessage');
  message('resetPasswordMessage');
}
function showForgotPasswordPanel() {
  const loginEmail=$('loginEmail')?.value.trim();
  if(loginEmail) $('forgotEmail').value=loginEmail;
  showAuthPanel('forgot');
  message('forgotMessage');
}
function showResetPasswordPanel() {
  screen.hidden=false;
  dashboard.hidden=true; dashboard.inert=true;
  teacherDashboard.hidden=true; teacherDashboard.inert=true;
  trainer.hidden=true; trainer.inert=true;
  showAuthPanel('reset');
  message('resetPasswordMessage');
}
async function resolveAuthenticatedRole() {
  if(!client || !activeUser) return 'student';
  const {data,error}=await authRepository.getUserRole(activeUser);
  if(error) throw error;
  return data?.role || 'student';
}
async function closeActiveExercise() {
  const host=app.exerciseHost;
  if(host?.getCurrentContext()) return host.close();
  const close=window.majorScaleTrainerClosePracticeSession;
  if(typeof close==='function') return close();
}
async function showTeacherDashboardForAuthenticatedUser({closeSession=false}={}) {
  if(!activeUser) return;
  if(closeSession){
    await closeActiveExercise();
  }
  screen.hidden=true;
  dashboard.hidden=true; dashboard.inert=true;
  teacherDashboard.hidden=false; teacherDashboard.inert=false;
  trainer.hidden=true; trainer.inert=true;
  $('sessionSummary').hidden=true;
  $('levelMasteryOverlay').hidden=true;
  if(!teacherDashboardController) throw new Error('Teacher Dashboard module is unavailable');
  await teacherDashboardController.load({activeUser,preferredClassId:$('teacherClassSelect')?.value || null});
}

async function showDashboardForAuthenticatedUser({closeSession=false}={}) {
  if(!activeUser) return;
  try{
    currentUserRole=await resolveAuthenticatedRole();
  }catch(error){
    console.error('RESOLVE USER ROLE ERROR:',error);
    currentUserRole='student';
  }
  if(currentUserRole==='teacher' || currentUserRole==='admin'){
    await showTeacherDashboardForAuthenticatedUser({closeSession});
    return;
  }
  if(closeSession){
    await closeActiveExercise();
  }
  screen.hidden=true;
  teacherDashboard.hidden=true; teacherDashboard.inert=true;
  dashboard.hidden=false;
  dashboard.inert=false;
  trainer.hidden=true;
  trainer.inert=true;
  $('sessionSummary').hidden=true;
  $('levelMasteryOverlay').hidden=true;
  if(!studentDashboardController) throw new Error('Student Dashboard module is unavailable');
  await studentDashboardController.load({activeUser});
}
function sessionView(session) {
  const user = session?.user?.id || null;
  const changed = user !== activeUser;
  activeUser = user;
  if(passwordRecoveryMode){
    showResetPasswordPanel();
    return;
  }
  screen.hidden = !!user;
  if (!user) {
    studentDashboardController?.invalidate?.();
    teacherDashboardController?.invalidate?.();
    currentUserRole=null;
    dashboard.hidden = true; dashboard.inert = true;
    teacherDashboard.hidden = true; teacherDashboard.inert = true;
    trainer.hidden = true; trainer.inert = true;
    $('sessionSummary').hidden = true;
    $('levelMasteryOverlay').hidden = true;
    panel(false);
  }
  if (changed) {
    $('loginPassword').value = ''; $('registerPassword').value = '';
    if (user) {
      Promise.resolve(showDashboardForAuthenticatedUser()).catch(error=>{
        console.error('SHOW DASHBOARD ERROR:',error);
      });
    }
  }
}
// Prevent document-level notation shortcuts while the authentication screen is open.
for (const type of ['keydown','keyup']) window.addEventListener(type, event => {
  if (screen.hidden && dashboard.hidden && teacherDashboard.hidden) return;
  if (type === 'keydown' && event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    if (event.target.tagName === 'BUTTON') event.target.click();
    else {
      const button=!$('resetPasswordPanel').hidden
        ? $('resetPasswordButton')
        : !$('forgotPasswordPanel').hidden
          ? $('forgotPasswordButton')
          : !$('registerPanel').hidden
            ? $('registerButton')
            : $('loginButton');
      button?.click();
    }
  }
  event.stopImmediatePropagation();
}, true);
$('showRegisterButton').addEventListener('click', () => panel(true));
$('showLoginButton').addEventListener('click', () => panel(false));
$('showForgotPasswordButton').addEventListener('click', showForgotPasswordPanel);
$('showLoginFromForgotButton').addEventListener('click', () => panel(false));

async function signInWithGoogle(messageId='loginMessage'){
  if(busy || !ready) return;
  busy=true; controls();
  message(messageId,'กำลังเชื่อมต่อกับ Google...');
  try{
    const {error}=await authRepository.signInWithGoogle({redirectTo:oauthRedirectUrl()});
    if(error) throw error;
  }catch(error){
    busy=false; controls();
    message(messageId,'เข้าสู่ระบบด้วย Google ไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่'),true);
  }
}

async function sendPasswordResetEmail(){
  if(busy || !ready) return;
  const email=$('forgotEmail').value.trim();
  if(!email) return message('forgotMessage','กรุณากรอกอีเมล',true);
  if(!$('forgotEmail').checkValidity()) return message('forgotMessage','กรุณากรอกอีเมลให้ถูกต้อง',true);

  busy=true; controls();
  message('forgotMessage','กำลังส่งลิงก์ตั้งรหัสผ่านใหม่...');
  try{
    const {error}=await authRepository.resetPasswordForEmail(email,PASSWORD_RESET_REDIRECT);
    if(error) throw error;
    message('forgotMessage','หากอีเมลนี้มีบัญชี ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจสอบกล่องจดหมายและโฟลเดอร์สแปม');
  }catch(error){
    message('forgotMessage','ส่งลิงก์ไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่ภายหลัง'),true);
  }finally{
    busy=false; controls();
  }
}

async function saveRecoveredPassword(){
  if(busy || !ready) return;
  const password=$('resetPassword').value;
  const confirmPassword=$('resetPasswordConfirm').value;
  if(!password || !confirmPassword) return message('resetPasswordMessage','กรุณากรอกรหัสผ่านใหม่ให้ครบทั้งสองช่อง',true);
  if(password!==confirmPassword) return message('resetPasswordMessage','รหัสผ่านทั้งสองช่องไม่ตรงกัน',true);

  busy=true; controls();
  message('resetPasswordMessage','กำลังบันทึกรหัสผ่านใหม่...');
  try{
    const {error}=await authRepository.updatePassword(password);
    if(error) throw error;

    $('resetPassword').value='';
    $('resetPasswordConfirm').value='';
    if(window.history?.replaceState){
      window.history.replaceState({},document.title,window.location.pathname);
    }

    const {error:signOutError}=await authRepository.signOutLocal();
    if(signOutError) throw signOutError;

    passwordRecoveryMode=false;
    sessionView(null);
    panel(false);
    message('loginMessage','ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
  }catch(error){
    message('resetPasswordMessage','ตั้งรหัสผ่านใหม่ไม่สำเร็จ: '+(error.message || 'ลิงก์อาจหมดอายุ กรุณาขอลิงก์ใหม่'),true);
  }finally{
    busy=false; controls();
  }
}

$('forgotPasswordButton').addEventListener('click', sendPasswordResetEmail);
$('resetPasswordButton').addEventListener('click', saveRecoveredPassword);
$('cancelResetPasswordButton').addEventListener('click', async()=>{
  if(busy || !ready) return;
  busy=true; controls();
  try{
    await authRepository.signOutLocal();
  }finally{
    passwordRecoveryMode=false;
    if(window.history?.replaceState){
      window.history.replaceState({},document.title,window.location.pathname);
    }
    sessionView(null);
    panel(false);
    busy=false; controls();
  }
});

async function submit(register) {
  if (busy || !ready) return;
  const prefix = register ? 'register' : 'login';
  const email = $(prefix+'Email').value.trim(), password = $(prefix+'Password').value;
  const name = register ? $('registerName').value.trim() : '';
  if (!email || !password || (register && !name)) return message(prefix+'Message','กรุณากรอกข้อมูลให้ครบ',true);
  if (!$(prefix+'Email').checkValidity()) return message(prefix+'Message','กรุณากรอกอีเมลให้ถูกต้อง',true);
  busy = true; controls(); message(prefix+'Message', register ? 'กำลังสมัครสมาชิก...' : 'กำลังเข้าสู่ระบบ...');
  try {
    const {data, error} = register
      ? await authRepository.signUp({email,password,fullName:name})
      : await authRepository.signInWithPassword({email,password});
    if (error) throw error;
    if (data.session?.user) sessionView(data.session);
    else if (register) {
      $('registerPassword').value = ''; $('loginEmail').value = email;
      message('registerMessage','สมัครสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ');
    } else throw new Error('ยังไม่ได้รับ session กรุณาลองเข้าสู่ระบบอีกครั้ง');
  } catch (error) {
    message(prefix+'Message',(register ? 'สมัครไม่สำเร็จ: ' : 'เข้าสู่ระบบไม่สำเร็จ: ')+(error.message || 'กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่'),true);
  } finally { busy = false; controls(); }
}
$('loginButton').addEventListener('click', () => submit(false));
$('registerButton').addEventListener('click', () => submit(true));
$('dashboardLogoutButton').addEventListener('click', () => $('logoutButton').click());
$('teacherDashboardLogoutButton').addEventListener('click', () => $('logoutButton').click());
$('teacherDashboardRefreshButton').addEventListener('click', () => {
  Promise.resolve(teacherDashboardController?.refresh?.({activeUser,preferredClassId:$('teacherClassSelect')?.value || null})).catch(error=>{
    console.error('REFRESH TEACHER DASHBOARD ERROR:',error);
  });
});
$('teacherClassSelect').addEventListener('change', () => {
  const classId=$('teacherClassSelect').value;
  if(!classId) return;
  Promise.resolve(teacherDashboardController?.selectClass?.(classId)).catch(error=>{
    console.error('CHANGE TEACHER CLASS ERROR:',error);
  });
});
$('dashboardButton').addEventListener('click', () => {
  Promise.resolve(showDashboardForAuthenticatedUser({closeSession:true})).catch(error=>{
    console.error('RETURN TO DASHBOARD ERROR:',error);
  });
});
dashboard.addEventListener('click', event => {
  const button=event.target.closest('.dashboard-continue[data-exercise-code]');
  if(!button) return;
  studentDashboardController?.openExercise?.(button.dataset.exerciseCode,button.dataset.stageCode,button.dataset.sessionMode || 'practice');
});
$('logoutButton').addEventListener('click', async () => {
  if (busy || !ready) return;
  busy = true; controls();
  try {
    await closeActiveExercise();

    const {error} = await authRepository.signOutLocal();
    if (error) throw error;
    sessionView(null);
  } catch (error) { alert('ออกจากระบบไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่')); }
  finally { busy = false; controls(); }
});
async function initializeAuth() {
  ensureGoogleAuthControls();
  controls(); message('loginMessage','กำลังตรวจสอบการเข้าสู่ระบบ...');
  try {
    if (!client || !authRepository) {
      throw app.supabaseClientError || new Error('โหลดระบบเข้าสู่ระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้า');
    }
    authRepository.onAuthStateChange((event, session) => {
      revision++;
      if(event==='PASSWORD_RECOVERY') passwordRecoveryMode=true;
      if(passwordRecoveryMode){
        if(event==='SIGNED_OUT'){
          passwordRecoveryMode=false;
          sessionView(null);
          return;
        }
        activeUser=session?.user?.id || activeUser;
        showResetPasswordPanel();
        return;
      }
      sessionView(session);
    });
    const start = revision;
    const {data,error} = await authRepository.getSession();
    if (error) throw error;
    if(passwordRecoveryMode){
      activeUser=data.session?.user?.id || activeUser;
      showResetPasswordPanel();
    }else if (start === revision){
      sessionView(data.session);
    }
    ready = true;
    if(!data.session){
      const redirectError=authRedirectErrorFromUrl();
      if(redirectError) message('loginMessage','เข้าสู่ระบบด้วย Google ไม่สำเร็จ: '+redirectError,true);
    }
  } catch (error) {
    sessionView(null);
    ready = !!client;
    message('loginMessage',error.message || 'ตรวจสอบ session ไม่สำเร็จ กรุณาลองใหม่',true);
  } finally { controls(); }
}
// Wait until the existing trainer has installed its event handlers.
document.addEventListener('DOMContentLoaded', initializeAuth, {once:true});
})();