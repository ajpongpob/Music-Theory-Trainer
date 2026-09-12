(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};

function getClient() {
  if (!app.supabaseClient) {
    throw app.supabaseClientError || new Error('Supabase client is not available');
  }
  return app.supabaseClient;
}

const dashboardRepository = {
  getStudentDashboard() {
    return getClient().rpc('get_my_student_dashboard');
  },

  getStageMastery({exerciseCode, stageCode}) {
    return getClient().rpc('get_my_stage_mastery', {
      p_exercise_code: exerciseCode,
      p_stage_code: stageCode
    });
  },

  getStageEvidence({exerciseCode, stageCode}) {
    return getClient().rpc('get_my_stage_evidence', {
      p_exercise_code: exerciseCode,
      p_stage_code: stageCode,
      p_mode: 'practice',
      p_latest_session_only: false
    });
  },

  finalizePracticeSet({sessionId, expectedQuestions = 5}) {
    return getClient().rpc('finalize_my_practice_set', {
      p_session_id: sessionId,
      p_expected_questions: expectedQuestions
    });
  },

  getLatestDiagnosticFeedback(exerciseCode) {
    return getClient().rpc('get_my_latest_diagnostic_feedback', {
      p_exercise_code: exerciseCode
    });
  },

  getStudentProfile(userId) {
    return getClient()
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();
  },

  getActiveSkills() {
    return getClient()
      .from('skills')
      .select('code,short_name,name_th')
      .eq('active', true);
  },

  getTeacherDashboard() {
    return getClient().rpc('get_my_teacher_dashboard');
  },

  getTeacherProfile(userId) {
    return getClient()
      .from('profiles')
      .select('full_name,role')
      .eq('id', userId)
      .maybeSingle();
  },

  getTeacherClassDashboard(classId) {
    return getClient().rpc('get_my_teacher_class_dashboard', {
      p_class_id: classId
    });
  },

  async getTeacherClassLearningFeedback(classId) {
    const result = await this.getTeacherClassDashboard(classId);
    if (result.error) return result;
    return {
      data: (result.data || []).map(row => ({
        student_id: row.student_id,
        exercise_code: row.exercise_code,
        current_stage_code: row.current_stage_code,
        ...(row.learning_feedback || {})
      })),
      error: null
    };
  }
};

app.dashboardRepository = Object.freeze(dashboardRepository);

// M1.5 is intentionally an additive presentation layer. Load it after the
// original dashboard/trainer scripts so notation and scoring remain frozen.
if (typeof window.addEventListener === 'function' && typeof document !== 'undefined') {
  window.addEventListener('load', () => {
    if (document.querySelector('script[data-m15-learning-feedback]')) return;
    const script = document.createElement('script');
    script.src = './src/m15-learning-feedback.js';
    script.dataset.m15LearningFeedback = 'true';
    document.body.appendChild(script);
  }, {once:true});
}
})();
