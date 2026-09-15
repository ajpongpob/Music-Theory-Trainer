'use strict';

const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:900,height:700}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

    await page.setContent(`<!doctype html><html lang="th"><head><meta charset="utf-8"></head><body>
      <main id="surface">
        <h1 id="level">Stage 2</h1>
        <p id="catalog">คลังแบบฝึกหัดและ Level</p>
        <p id="skill">Treble Pitch</p>
        <p id="path">Music Theory Foundations</p>
        <p id="summary">สรุปผล Mastery Session</p>
        <p id="description">ฝึกเขียนบันไดเสียงเมเจอร์บนบรรทัดห้าเส้นตาม Stage และเกณฑ์ Mastery ที่กำหนด</p>
        <p id="reason">เริ่มทำแบบฝึกของระดับนี้ตามเงื่อนไขหลักของระบบ</p>
        <p id="keys">คีย์ในระดับนี้:</p>
      </main>
    </body></html>`);

    await page.evaluate(()=>{
      window.__lang='th';
      window.MajorScaleApp={i18n:{
        getLanguage:()=>window.__lang,
        translateText:text=>String(text??'')
      }};
    });
    await page.addScriptTag({content:read('src/i18n-mode-consistency.js')});
    await page.waitForFunction(()=>window.MajorScaleApp?.i18nModeConsistency);
    await page.evaluate(()=>window.MajorScaleApp.i18nModeConsistency.apply());

    assert.equal(await page.locator('#level').textContent(),'ระดับที่ 2');
    assert.equal(await page.locator('#catalog').textContent(),'คลังแบบฝึกหัดและระดับ');
    assert.equal(await page.locator('#skill').textContent(),'ระดับเสียงบนกุญแจซอล');
    assert.equal(await page.locator('#path').textContent(),'เส้นทางการเรียนรู้พื้นฐานทฤษฎีดนตรี');
    assert.equal(await page.locator('#summary').textContent(),'สรุปผลการผ่านเกณฑ์');
    assert.equal(await page.locator('#description').textContent(),'ฝึกเขียนบันไดเสียงเมเจอร์บนบรรทัดห้าเส้นตามระดับและเกณฑ์การผ่านที่กำหนด');
    assert.equal(await page.locator('#keys').textContent(),'คีย์ในระดับนี้:');
    assert.deepEqual(await page.evaluate(()=>MajorScaleApp.i18nModeConsistency.audit(document.getElementById('surface'))),[],'Thai mode must have no tracked English terminology leaks');

    await page.evaluate(()=>{
      window.__lang='en';
      window.dispatchEvent(new CustomEvent('major-scale:languagechange',{detail:{language:'en'}}));
    });
    await page.waitForFunction(()=>document.getElementById('level').textContent==='Level 2');

    assert.equal(await page.locator('#catalog').textContent(),'Exercise library and levels');
    assert.equal(await page.locator('#skill').textContent(),'Treble Pitch');
    assert.equal(await page.locator('#path').textContent(),'Music Theory Foundations');
    assert.equal(await page.locator('#summary').textContent(),'Mastery Summary');
    assert.equal(await page.locator('#description').textContent(),'Practice writing major scales on the staff according to the assigned level and mastery criteria');
    assert.equal(await page.locator('#reason').textContent(),'Start practicing this level according to the core learning criteria');
    assert.equal(await page.locator('#keys').textContent(),'Keys in this level:');
    assert.deepEqual(await page.evaluate(()=>MajorScaleApp.i18nModeConsistency.audit(document.getElementById('surface'))),[],'English mode must have no tracked Thai UI terminology leaks');

    assert.deepEqual(errors,[]);
    console.log('PASS language mode browser: Thai uses ระดับที่ and Thai-only UI; English uses Level and English-only UI; dynamic switch is reversible');
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
