
/* Sibelius-style keyboard input */
(function(){
  document.addEventListener("keydown",function(e){
    // Do not intercept text fields
    if(e.target && ["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
    if(e.ctrlKey || e.metaKey || e.altKey || e.isComposing)return;

    const keyboard=window.majorScaleTrainerKeyboard;
    if(!keyboard)return;

    const key=e.key.toLowerCase();

    // Global visible shortcuts
    if(e.key==="9"){
      e.preventDefault();
      document.getElementById("beamSelected")?.click();
      return;
    }
    if(e.key==="0"){
      e.preventDefault();
      document.getElementById("unbeamSelected")?.click();
      return;
    }
    if(e.key==="8"){
      e.preventDefault();
      document.getElementById('toggleStem')?.click();
      return;
    }

    if(key==="m"){
      e.preventDefault();
      document.getElementById("rangeSelectToggle")?.click();
      return;
    }
    if(key==="r"){
      e.preventDefault();
      document.getElementById("resetScore")?.click();
      return;
    }
    if(key==="k"){
      e.preventDefault();
      document.getElementById("checkAnswer")?.click();
      return;
    }

    // Note entry A-G
    if(["a","b","c","d","e","f","g"].includes(key)){
      e.preventDefault();
      keyboard.insertLetter(key.toUpperCase());
      return;
    }

    // Sibelius-style numpad rhythm shortcuts
    if(["1","2","3","4","5"].includes(e.key)){
      e.preventDefault();
      keyboard.setRhythm(e.key);
      return;
    }

    // Accidental shortcuts
    if([".","+","-","*","/"].includes(e.key)){
      e.preventDefault();
      keyboard.setAccidental(e.key);
      return;
    }

    // Arrow navigation
  });
})();

/* Level-completion mastery detail
   Reuse the existing Mastery source and summary-bar styling so the score shown
   after a Stage pass is the authoritative rolling Mastery result, not a second
   client-side calculation. */
(function(){
  const SKILLS=[
    ["BN01_TREBLE_PITCH","Pitch Name","ชื่อระดับเสียง"],
    ["MS03_SCALE_ACCIDENTAL","Accidental","เครื่องหมายแปลงเสียง"],
    ["RH01_DURATION_VALUE","Duration Value","ค่าความยาวตัวโน้ต"],
    ["GR02_PRIMARY_BEAM","Primary Beam","การรวมเขบ็ต"],
    ["BN06_STEM_DIRECTION","Stem Direction","ทิศทางก้านโน้ต"]
  ];

  function ensureSkillSummary(){
    const overlay=document.getElementById("levelMasteryOverlay");
    const button=document.getElementById("continueNextLevel");
    if(!overlay || !button) return null;

    let wrap=document.getElementById("levelMasterySkillSummary");
    if(wrap) return wrap;

    wrap=document.createElement("div");
    wrap.id="levelMasterySkillSummary";
    wrap.className="lo-summary-list";
    wrap.setAttribute("aria-label","คะแนน Mastery รายทักษะ");
    button.parentNode.insertBefore(wrap,button);
    return wrap;
  }

  function completedLevelFromUi(){
    const title=document.getElementById("levelMasteryTitle")?.textContent || "";
    const match=title.match(/Level\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function renderLoading(wrap){
    wrap.innerHTML=`
      <div class="lo-summary-row developing">
        <div class="lo-summary-name">
          <b>Skill Mastery</b>
          <span>กำลังโหลดคะแนนรายทักษะ...</span>
        </div>
        <strong>—</strong>
      </div>
    `;
  }

  function renderScores(wrap,result){
    const rows=Array.isArray(result?.skill_results) ? result.skill_results : [];
    const scores=new Map(
      rows
        .filter(item=>item?.skill_code)
        .map(item=>[
          item.skill_code,
          item.score===null || item.score===undefined ? null : Number(item.score)
        ])
    );

    wrap.innerHTML=SKILLS.map(([code,label,thai])=>{
      const raw=scores.get(code);
      const score=Number.isFinite(raw) ? Math.max(0,Math.min(100,Math.round(raw))) : null;
      return `
        <div class="lo-summary-row ${score===null?"not-assessed":"strong"}">
          <div class="lo-summary-name">
            <b>${label}</b>
            <span>${thai}</span>
          </div>
          <div class="lo-summary-bar" role="progressbar"
               aria-label="${label}"
               aria-valuemin="0" aria-valuemax="100"
               aria-valuenow="${score===null?0:score}">
            <i style="width:${score===null?0:score}%"></i>
          </div>
          <strong>${score===null?"—":score+"%"}</strong>
        </div>
      `;
    }).join("");
  }

  function renderError(wrap){
    wrap.innerHTML=`
      <div class="lo-summary-row developing">
        <div class="lo-summary-name">
          <b>Skill Mastery</b>
          <span>ไม่สามารถโหลดคะแนนรายทักษะได้ในขณะนี้</span>
        </div>
        <strong>—</strong>
      </div>
    `;
  }

  async function refreshCompletedLevelSkills(){
    const overlay=document.getElementById("levelMasteryOverlay");
    if(!overlay || overlay.hidden) return;

    const level=completedLevelFromUi();
    const wrap=ensureSkillSummary();
    if(!level || !wrap) return;

    const stageCode=`STAGE_${level}`;
    if(wrap.dataset.stageCode===stageCode && wrap.dataset.loaded==="true") return;

    wrap.dataset.stageCode=stageCode;
    wrap.dataset.loaded="false";
    renderLoading(wrap);

    const app=window.MajorScaleApp || {};
    const repository=app.masteryRepository;
    const exerciseCode=app.majorScaleConfig?.exerciseCode;

    if(!repository || !exerciseCode){
      renderError(wrap);
      return;
    }

    try{
      const response=await repository.getStageMastery({exerciseCode,stageCode});
      if(response?.error) throw response.error;
      const result=Array.isArray(response?.data) ? response.data[0] : response?.data;
      if(!result) throw new Error("No Stage Mastery result");
      if(overlay.hidden || wrap.dataset.stageCode!==stageCode) return;
      renderScores(wrap,result);
      wrap.dataset.loaded="true";
    }catch(error){
      console.error("LEVEL MASTERY SKILL SUMMARY ERROR:",error);
      if(!overlay.hidden && wrap.dataset.stageCode===stageCode) renderError(wrap);
    }
  }

  const init=()=>{
    const overlay=document.getElementById("levelMasteryOverlay");
    if(!overlay) return;

    ensureSkillSummary();
    new MutationObserver(()=>{
      if(!overlay.hidden) refreshCompletedLevelSkills();
    }).observe(overlay,{attributes:true,attributeFilter:["hidden"]});

    if(!overlay.hidden) refreshCompletedLevelSkills();
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }
})();

/* Mastery badge V1 loader. Keeping this as a separate module lets the badge
   presentation evolve without coupling reward UI to notation keyboard input. */
(function(){
  if(document.querySelector('script[data-major-scale-badge-system]')) return;
  const script=document.createElement('script');
  script.src='./src/badge-system.js?v=20260914-1';
  script.async=false;
  script.setAttribute('data-major-scale-badge-system','true');
  document.head.appendChild(script);
})();
