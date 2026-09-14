(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};
const PROFILE_NAME_SEPARATOR = '\u001f';

function getClient() {
  if (!app.supabaseClient) {
    throw app.supabaseClientError || new Error('Supabase client is not available');
  }
  return app.supabaseClient;
}

function decodeProfileName(fullName) {
  const raw = String(fullName || '').trim();
  if (!raw) return {firstName: null, lastName: null};
  if (raw.includes(PROFILE_NAME_SEPARATOR)) {
    const [firstName, ...lastParts] = raw.split(PROFILE_NAME_SEPARATOR);
    return {
      firstName: firstName.trim() || null,
      lastName: lastParts.join(PROFILE_NAME_SEPARATOR).trim() || null
    };
  }
  const match = raw.match(/^(\S+)(?:\s+(.+))?$/u);
  return {
    firstName: match?.[1]?.trim() || raw,
    lastName: match?.[2]?.trim() || null
  };
}

const PROFILE_DETAILS_SELECT = 'id,first_name,last_name,nickname,full_name,display_name,student_id,program,avatar_url,role,created_at,updated_at';

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
      .select('first_name,last_name,full_name')
      .eq('id', userId)
      .maybeSingle();
  },

  getStudentProfileDetails(userId) {
    return getClient()
      .from('profiles')
      .select(PROFILE_DETAILS_SELECT)
      .eq('id', userId)
      .maybeSingle();
  },

  updateStudentProfile({userId, fullName, displayName, studentId, program, avatarUrl}) {
    const {firstName, lastName} = decodeProfileName(fullName);
    return getClient()
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        nickname: displayName || null,
        student_id: studentId,
        program,
        avatar_url: avatarUrl
      })
      .eq('id', userId)
      .select(PROFILE_DETAILS_SELECT)
      .single();
  },

  getTeacherStudentProfile(userId) {
    return getClient()
      .from('profiles')
      .select(PROFILE_DETAILS_SELECT)
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
      .select('first_name,last_name,full_name,role')
      .eq('id', userId)
      .maybeSingle();
  },

  getTeacherClassDashboard(classId) {
    return getClient().rpc('get_my_teacher_class_dashboard', {
      p_class_id: classId
    });
  },

  async getTeacherClassDashboards(classIds=[]) {
    const ids=[...new Set((classIds || []).filter(Boolean))];
    try {
      const results=await Promise.all(ids.map(async classId=>{
        const result=await this.getTeacherClassDashboard(classId);
        if(result.error) throw result.error;
        return {classId,data:Array.isArray(result.data) ? result.data : []};
      }));
      return {data:results,error:null};
    } catch(error) {
      return {data:null,error};
    }
  },

  createTeacherClass({code,name,academicYear=null,term=null}) {
    return getClient().rpc('create_my_class', {
      p_code: code,
      p_name: name,
      p_academic_year: academicYear,
      p_term: term
    });
  },

  addStudentToTeacherClass({classId,email}) {
    return getClient().rpc('add_student_to_my_class', {
      p_class_id: classId,
      p_student_email: email
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

function loadOptionalStylesheet(href, dataAttribute) {
  if (typeof document === 'undefined' || !document.head) return null;
  if (document.querySelector(`link[${dataAttribute}]`)) return null;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(dataAttribute, 'true');
  document.head.appendChild(link);
  return link;
}

// Additive presentation layers are loaded after the original dashboard/trainer
// scripts so notation, scoring and the authenticated exercise host stay frozen.
if (typeof window.addEventListener === 'function' && typeof document !== 'undefined') {
  window.addEventListener('load', () => {
    loadOptionalStylesheet('./styles/student-dashboard-v2.css?v=20260914-exercise-index-3', 'data-student-dashboard-v2-style');
    loadOptionalStylesheet('./styles/teacher-dashboard-v2.css?v=20260913-teacher-v2', 'data-teacher-dashboard-v2-style');
    const dashboardV2 = loadOptionalScript('./src/dashboard/student-dashboard-v2.js?v=20260914-exercise-index-3', 'data-student-dashboard-v2');
    const loadDashboardAddons = () => {
      loadOptionalScript('./src/dashboard/student-dashboard-v2-compat.js?v=20260914-exercise-index-3', 'data-student-dashboard-v2-compat');
      loadOptionalScript('./src/dashboard/exercise-index.js?v=20260914-exercise-index-3', 'data-exercise-index');
    };
    if (dashboardV2) dashboardV2.addEventListener('load', loadDashboardAddons, {once:true});
    else loadDashboardAddons();

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
      document.body.appendChild(hardening);
    }, {once:true});
    document.body.appendChild(feedback);
  }, {once:true});
}
})();
