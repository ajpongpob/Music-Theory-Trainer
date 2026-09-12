(() => {
'use strict';

function clearQuestionResultOverlay(){
  const overlay=document.getElementById('questionResultOverlay');
  if(!overlay) return;
  overlay.classList.remove('is-visible');
  overlay.hidden=true;
  overlay.setAttribute('aria-hidden','true');
  document.querySelectorAll('.session-app > .session-header, .session-app > .session-main').forEach(node=>{
    node.inert=false;
    node.removeAttribute('aria-hidden');
  });
}

// Dashboard transitions may also be used as a recovery path when an optional
// feedback read fails. Never let a review dialog survive into the next launch.
document.addEventListener('click',event=>{
  const button=event.target.closest?.('button');
  if(!button) return;
  if(button.id==='dashboardButton' || button.id==='m15Dashboard'){
    clearQuestionResultOverlay();
  }
},true);

// Exercise Host dispatches this when the Trainer is shown. This second guard
// prevents any stale review layer from a previous, interrupted session from
// intercepting input in the newly opened exercise.
window.addEventListener('major-scale-trainer-visible',clearQuestionResultOverlay);

window.MajorScaleApp.m15FeedbackHardening=Object.freeze({clearQuestionResultOverlay});
})();
