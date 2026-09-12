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

  getPretestJourney(exerciseCode) {
    return getClient().rpc('get_my_pretest_journey', {
      p_exercise_code: exerciseCode
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

  async getStudentLearningHistory({limit = 40} = {}) {
    const client = getClient();
    const safeLimit = Math.max(5, Math.min(100, Number(limit) || 40));

    try {
      const [sessionsResult, practiceCountResult] = await Promise.all([
        client
          .from('practice_sessions')
          .select('id,mode,planned_questions,completed_questions,overall_score,started_at,completed_at,last_activity_at,exercise_id,stage_id')
          .order('started_at', {ascending: false})
          .limit(safeLimit),
        client
          .from('practice_sessions')
          .select('id', {count: 'exact', head: true})
          .eq('mode', 'practice')
      ]);

      if (sessionsResult.error) return {data: null, error: sessionsResult.error};
      if (practiceCountResult.error) return {data: null, error: practiceCountResult.error};

      const sessions = Array.isArray(sessionsResult.data) ? sessionsResult.data : [];
      const sessionIds = sessions.map(row => row.id).filter(Boolean);
      let attempts = [];
      let skillResults = [];

      if (sessionIds.length) {
        const attemptsResult = await client
          .from('attempts')
          .select('id,practice_session_id,question_number,score,item_code,checked_at,created_at')
          .in('practice_session_id', sessionIds)
          .order('question_number', {ascending: true});

        if (attemptsResult.error) return {data: null, error: attemptsResult.error};
        attempts = Array.isArray(attemptsResult.data) ? attemptsResult.data : [];

        const attemptIds = attempts.map(row => row.id).filter(Boolean);
        if (attemptIds.length) {
          const skillsResult = await client
            .from('attempt_skill_results')
            .select('attempt_id,skill_code,correct_count,total_count,score,created_at')
            .in('attempt_id', attemptIds);

          if (skillsResult.error) return {data: null, error: skillsResult.error};
          skillResults = Array.isArray(skillsResult.data) ? skillsResult.data : [];
        }
      }

      return {
        data: {
          sessions,
          attempts,
          skillResults,
          totalPracticeSessions: Number.isFinite(Number(practiceCountResult.count))
            ? Number(practiceCountResult.count)
            : sessions.filter(row => row.mode === 'practice').length
        },
        error: null
      };
    } catch (error) {
      return {data: null, error};
    }
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

function loadOptionalScript(src, dataAttribute) {
  if (typeof document === 'undefined' || !document.body) return null;
  if (document.querySelector(`script[${dataAttribute}]`)) return null;
  const script = document.createElement('script');
  script.src = src;
  script.setAttribute(dataAttribute, 'true');
  document.body.appendChild(script);
  return script;
}

// Additive presentation layers are loaded after the original dashboard/trainer
// scripts so notation, scoring and the authenticated exercise host stay frozen.
if (typeof window.addEventListener === 'function' && typeof document !== 'undefined') {
  window.addEventListener('load', () => {
    loadOptionalScript('./src/dashboard/student-dashboard-v2.js', 'data-student-dashboard-v2');
    loadOptionalScript('./src/feedback-notation-errors.js', 'data-feedback-notation-errors');

    if (document.querySelector('script[data-m15-learning-feedback]')) return;
    const feedback = document.createElement('script');
    feedback.src = './src/m15-learning-feedback.js';
    feedback.dataset.m15LearningFeedback = 'true';
    feedback.addEventListener('load', () => {
      if (document.querySelector('script[data-m15-feedback-hardening]')) return;
      const hardening = document.createElement('script');
      hardening.src = './src/m15-learning-feedback-hardening.js';
      hardening.dataset.m15FeedbackHardening = 'true';
      hardening.addEventListener('load', () => {
        if (document.querySelector('script[data-m16-pretest-flow]')) return;
        const pretest = document.createElement('script');
        pretest.src = './src/m16-pretest-flow.js';
        pretest.dataset.m16PretestFlow = 'true';
        document.body.appendChild(pretest);
      }, {once:true});
      document.body.appendChild(hardening);
    }, {once:true});
    document.body.appendChild(feedback);
  }, {once:true});
}
})();
