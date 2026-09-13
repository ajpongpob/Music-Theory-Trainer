
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

  // Load the shared UI language layer after the core application scripts.
  // It translates existing and future-rendered UI without touching notation,
  // scoring, authentication, or database behavior.
  if(!document.querySelector('script[data-major-scale-i18n]')){
    const script=document.createElement('script');
    script.src='./src/i18n.js?v=20260913-1';
    script.async=false;
    script.setAttribute('data-major-scale-i18n','true');
    document.head.appendChild(script);
  }
})();
