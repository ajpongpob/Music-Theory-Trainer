'use strict';

const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});

    await page.setContent(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
      <div id="authScreen" hidden>
        <section id="loginPanel" class="auth-card"><div class="auth-brand"><div class="auth-brand-icon">♫</div><div><h1>Major Scale Notation Trainer</h1></div></div><button id="showRegisterButton">สมัคร</button><button id="showForgotPasswordButton">ลืมรหัสผ่าน</button></section>
        <section id="registerPanel" class="auth-card" hidden><div class="auth-brand"><div>สมัครสมาชิก</div></div><button id="showLoginButton">เข้าสู่ระบบ</button></section>
        <section id="forgotPasswordPanel" class="auth-card" hidden><div class="auth-brand"><div>ลืมรหัสผ่าน</div></div><button id="showLoginFromForgotButton">เข้าสู่ระบบ</button></section>
        <section id="resetPasswordPanel" class="auth-card" hidden><div class="auth-brand"><div>ตั้งรหัสผ่าน</div></div><button id="cancelResetPasswordButton">ยกเลิก</button></section>
        <section id="profileOnboardingPanel" class="auth-card" hidden><div class="auth-brand"><div>ตั้งค่าโปรไฟล์</div></div><form id="profileOnboardingForm"></form><span id="profileOnboardingEmail">qa@example.com</span><button id="profileOnboardingLogoutButton">ออกจากระบบ</button></section>
      </div>

      <section id="studentDashboard" class="student-dashboard-shell dashboard-v2-enabled">
        <div class="student-dashboard-inner">
          <header class="student-dashboard-header">
            <div class="student-dashboard-brand"><div class="student-dashboard-kicker">Student Dashboard</div><h1>Major Scale Notation Trainer</h1></div>
            <nav id="sd2TopNav" class="sd2-top-nav" aria-label="Main">
              <a href="#dashboardContent" data-sd2-nav="dashboard">Dashboard</a>
              <a href="#sd2Continue" data-sd2-nav="practice">Practice</a>
              <a href="#sd2Skills" data-sd2-nav="progress">Progress</a>
              <a href="#sd2ProfilePanel" data-sd2-nav="profile">Profile</a>
            </nav>
            <div class="student-dashboard-actions"><span id="dashboardUserName" class="dashboard-user-chip">QA Student</span><button id="dashboardLogoutButton">ออกจากระบบ</button></div>
          </header>
          <main id="dashboardContent"><section id="sd2Continue"></section><section id="sd2Skills"></section><section id="sd2ProfilePanel"></section></main>
        </div>
      </section>

      <section id="teacherDashboard" class="student-dashboard-shell" hidden>
        <header class="student-dashboard-header"><div class="student-dashboard-brand"><h1>Teacher Dashboard</h1></div><div class="student-dashboard-actions"><span id="teacherDashboardUserName">QA Teacher</span><button id="teacherDashboardRefreshButton">รีเฟรช</button><button id="teacherDashboardLogoutButton">ออกจากระบบ</button></div></header>
      </section>

      <section id="trainerApp" hidden>
        <header class="session-header"><div class="session-brand"><h1>Major Scale Notation Trainer</h1></div><button id="dashboardButton">แดชบอร์ด</button><button id="logoutButton">ออกจากระบบ</button></header>
      </section>
    </body></html>`);

    await page.evaluate(()=>{
      window.__navHits={dashboard:0,practice:0,progress:0,profile:0,logout:0};
      window.MajorScaleApp={
        authRepository:{getUser:async()=>({data:{user:{id:'student-1',email:'qa@example.com',user_metadata:{full_name:'QA Student'}}}})},
        dashboardRepository:{getStudentProfileDetails:async()=>({data:{first_name:'QA',last_name:'Student',full_name:'QA Student',avatar_url:null},error:null})}
      };
      document.querySelectorAll('#sd2TopNav [data-sd2-nav]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();window.__navHits[link.dataset.sd2Nav]++;}));
      document.getElementById('dashboardLogoutButton').addEventListener('click',()=>window.__navHits.logout++);
      document.getElementById('logoutButton').addEventListener('click',()=>window.__navHits.logout++);
      document.getElementById('profileOnboardingLogoutButton').addEventListener('click',()=>window.__navHits.logout++);
      document.getElementById('dashboardButton').addEventListener('click',()=>{
        document.getElementById('trainerApp').hidden=true;
        document.getElementById('studentDashboard').hidden=false;
      });
    });

    await page.addStyleTag({content:read('styles/navigation-drawer.css')});
    await page.addScriptTag({content:read('src/navigation-drawer.js')});
    await page.waitForFunction(()=>document.getElementById('appNavigationMenuButton')?.parentElement?.classList.contains('student-dashboard-header'));

    assert.equal(await page.locator('#sd2TopNav').isVisible(),false,'legacy top navigation must be hidden in the real app layer');
    assert.equal(await page.locator('#dashboardUserName').getAttribute('role'),'button','header identity must remain a Profile access point');

    const menu=page.locator('#appNavigationMenuButton');
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#appNavigationDrawer').getAttribute('aria-hidden'),'false');
    assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('app-nav-drawer-open')),true);
    assert.deepEqual(
      await page.locator('#appNavigationItems [data-app-nav-action]').evaluateAll(items=>items.map(item=>item.dataset.appNavAction)),
      ['dashboard','practice','progress','profile','logout']
    );

    await page.locator('[data-app-nav-action="progress"]').click();
    assert.equal(await page.evaluate(()=>window.__navHits.progress),1,'drawer Progress must delegate to existing student navigation');
    assert.equal(await menu.getAttribute('aria-expanded'),'false');

    await page.locator('#dashboardUserName').click();
    assert.equal(await page.evaluate(()=>window.__navHits.profile),1,'top Profile access must remain functional');

    await menu.focus();
    await menu.click();
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'),'false','Escape must close drawer');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'appNavigationMenuButton','focus must return to hamburger after Escape');

    await menu.click();
    await page.locator('#appNavigationScrim').click({position:{x:380,y:400}});
    assert.equal(await menu.getAttribute('aria-expanded'),'false','scrim tap must close drawer');

    await page.evaluate(()=>{
      document.getElementById('studentDashboard').hidden=true;
      document.getElementById('trainerApp').hidden=false;
    });
    await page.waitForFunction(()=>document.getElementById('appNavigationMenuButton')?.parentElement?.classList.contains('session-header'));
    assert.equal(await page.locator('#dashboardButton').isVisible(),false,'trainer Dashboard button must move to drawer');
    assert.equal(await page.locator('#trainerHeaderProfileButton').count(),1,'trainer header must keep Profile alongside Logout');
    await menu.click();
    assert.equal(await page.locator('[data-app-nav-action="practice"]').getAttribute('aria-current'),'page','Practice must be current while trainer is open');
    await page.locator('[data-app-nav-action="profile"]').click();
    await page.waitForFunction(()=>!document.getElementById('studentDashboard').hidden);
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(()=>window.__navHits.profile),2,'trainer Profile must return to dashboard Profile');

    await page.evaluate(()=>{
      document.getElementById('studentDashboard').hidden=true;
      document.getElementById('authScreen').hidden=false;
      document.getElementById('loginPanel').hidden=false;
    });
    await page.waitForFunction(()=>document.getElementById('appNavigationMenuButton')?.parentElement?.classList.contains('auth-brand'));
    await menu.click();
    assert.equal(await page.locator('[data-app-nav-action="login"]').count(),1,'auth surfaces must also have hamburger navigation');
    assert.equal(await page.locator('[data-app-nav-action="register"]').count(),1);
    assert.equal(await page.locator('[data-app-nav-action="forgot"]').count(),1);
    await page.keyboard.press('Escape');

    await page.evaluate(()=>{
      document.getElementById('loginPanel').hidden=true;
      document.getElementById('profileOnboardingPanel').hidden=false;
    });
    await page.waitForFunction(()=>document.getElementById('appNavigationMenuButton')?.parentElement===document.querySelector('#profileOnboardingPanel .auth-brand'));
    await menu.click();
    assert.equal(await page.locator('[data-app-nav-action="dashboard"]').isDisabled(),true,'onboarding must not bypass required profile completion');
    assert.equal(await page.locator('[data-app-nav-action="profile"]').getAttribute('aria-current'),'page');
    await page.locator('[data-app-nav-action="logout"]').click();
    assert.equal(await page.evaluate(()=>window.__navHits.logout),1,'drawer Logout must remain usable during onboarding');

    assert.deepEqual(errors,[]);
    console.log('PASS navigation drawer browser: student, trainer, auth and onboarding surfaces; accessible open/close; moved nav; duplicate Profile/Logout access');
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
