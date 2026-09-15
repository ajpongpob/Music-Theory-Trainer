(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
const readCache=new Map();

function cachedRead(key,factory,ttlMs=1500){
  const now=Date.now(),cached=readCache.get(key);
  if(cached&&now-cached.createdAt<ttlMs)return cached.promise;
  const promise=Promise.resolve().then(factory).then(result=>{
    if(result?.error)readCache.delete(key);
    return result;
  },error=>{readCache.delete(key);throw error;});
  readCache.set(key,{createdAt:now,promise});
  return promise;
}

function getClient(){
  if(!app.supabaseClient){
    throw app.supabaseClientError || new Error('Supabase client is not available');
  }
  return app.supabaseClient;
}

const learningRepository={
  ensureProgression(){
    return cachedRead('ensure-progression',()=>getClient().rpc('ensure_my_learning_path_progression'),5000);
  },

  getRecommendedNextAction(pathCode=null){
    return cachedRead(`recommended-action:${pathCode||''}`,()=>getClient().rpc('get_my_recommended_next_action',{
      p_path_code:pathCode || null
    }));
  },

  getExerciseDiagnostic(exerciseCode){
    return getClient().rpc('get_my_exercise_diagnostic',{
      p_exercise_code:exerciseCode
    });
  },

  applyDiagnosticPlacement(exerciseCode){
    return getClient().rpc('apply_my_diagnostic_placement',{
      p_exercise_code:exerciseCode
    });
  },

  evaluatePretestProgress(sessionId){
    return getClient().rpc('evaluate_my_pretest_progress',{
      p_session_id:sessionId
    });
  },

  getStageEvidence({exerciseCode,stageCode,mode='practice',latestSessionOnly=false}){
    return getClient().rpc('get_my_stage_evidence',{
      p_exercise_code:exerciseCode,
      p_stage_code:stageCode,
      p_mode:mode,
      p_latest_session_only:!!latestSessionOnly
    });
  }
};

app.learningRepository=Object.freeze(learningRepository);
})();
