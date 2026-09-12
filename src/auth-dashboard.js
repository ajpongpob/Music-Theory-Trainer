
(() => {
'use strict';
const $ = id => document.getElementById(id);
const screen = $('authScreen'), dashboard = $('studentDashboard'), teacherDashboard = $('teacherDashboard'), trainer = $('trainerApp');
const app = window.MajorScaleApp || {};
const authRepository = app.authRepository;
const client = app.supabaseClient;
const studentDashboardController = app.studentDashboard;
const teacherDashboardController = app.teacherDashboard;
let busy = false, ready = false, revision = 0, activeUser = null;
const PASSWORD_RESET_REDIRECT = 'https://ajpongpob.github.io/Music-Theory-Trainer/?mode=reset-password';
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
    'showForgotPasswordButton','forgotPasswordButton','showLoginFromForgotButton',
    'resetPasswordButton','cancelResetPasswordButton',
    'logoutButton','dashboardLogoutButton','teacherDashboardLogoutButton',
    'teacherDashboardRefreshButton','dashboardButton'
  ].forEach(id => {
    const control=$(id);
    if(control) control.disabled = busy || !ready;
  });
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
async function showTeacherDashboardForAuthenticatedUser({closeSession=false}={}) {
  if(!activeUser) return;
  if(closeSession){
    const closeTrainerSession=window.majorScaleTrainerClosePracticeSession;
    if(typeof closeTrainerSession==='function') await closeTrainerSession();
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
    const closeTrainerSession=window.majorScaleTrainerClosePracticeSession;
    if(typeof closeTrainerSession==='function') await closeTrainerSession();
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
  studentDashboardController?.openExercise?.(button.dataset.exerciseCode,button.dataset.stageCode);
});
$('logoutButton').addEventListener('click', async () => {
  if (busy || !ready) return;
  busy = true; controls();
  try {
    const closeTrainerSession=
      window.majorScaleTrainerClosePracticeSession;

    if(typeof closeTrainerSession==="function"){
      await closeTrainerSession();
    }

    const {error} = await authRepository.signOutLocal();
    if (error) throw error;
    sessionView(null);
  } catch (error) { alert('ออกจากระบบไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่')); }
  finally { busy = false; controls(); }
});
async function initializeAuth() {
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
  } catch (error) {
    sessionView(null);
    ready = !!client;
    message('loginMessage',error.message || 'ตรวจสอบ session ไม่สำเร็จ กรุณาลองใหม่',true);
  } finally { controls(); }
}
// Wait until the existing trainer has installed its event handlers.
document.addEventListener('DOMContentLoaded', initializeAuth, {once:true});
})();

