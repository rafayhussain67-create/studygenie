// supabase.js — shared Supabase client
// This file is loaded by every HTML page that needs Supabase

const SUPABASE_URL = 'https://joildbbqsisdoqayfwus.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6WADiIvIXFdVLlVuVqVU6w_YAnD8TMO';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return data;
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

// ─────────────────────────────────────────────
// QUESTION LIMIT HELPERS
// ─────────────────────────────────────────────

const PLAN_LIMITS = { free: 5, starter: 20, scholar: 50, pro: Infinity };

async function getRemainingQuestions() {
  const profile = await getProfile();
  if (!profile) return 0;

  const limit = PLAN_LIMITS[profile.plan] || 5;
  if (limit === Infinity) return Infinity;

  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('question_usage')
    .select('count')
    .eq('user_id', profile.id)
    .eq('used_date', today)
    .single();

  const used = data?.count || 0;
  return Math.max(0, limit - used);
}

async function incrementQuestionUsage() {
  const user = await getUser();
  if (!user) return;

  const today = new Date().toISOString().split('T')[0];
  // Try to update existing row first
  const { data: existing } = await supabase
    .from('question_usage')
    .select('id, count')
    .eq('user_id', user.id)
    .eq('used_date', today)
    .single();

  if (existing) {
    await supabase
      .from('question_usage')
      .update({ count: existing.count + 1 })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('question_usage')
      .insert({ user_id: user.id, used_date: today, count: 1 });
  }
}

// ─────────────────────────────────────────────
// STREAK HELPERS
// ─────────────────────────────────────────────

async function updateStreak() {
  const user = await getUser();
  if (!user) return;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const { data: streak } = await supabase
    .from('study_streaks')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!streak) {
    // First time
    await supabase.from('study_streaks').insert({
      user_id: user.id, current_streak: 1, longest_streak: 1, last_study_date: today
    });
    return { current_streak: 1, longest_streak: 1 };
  }

  if (streak.last_study_date === today) return streak; // Already updated today

  let newCurrent = 1;
  if (streak.last_study_date === yesterday) {
    newCurrent = streak.current_streak + 1; // Consecutive day
  }

  const newLongest = Math.max(streak.longest_streak, newCurrent);
  await supabase
    .from('study_streaks')
    .update({ current_streak: newCurrent, longest_streak: newLongest, last_study_date: today })
    .eq('user_id', user.id);

  return { current_streak: newCurrent, longest_streak: newLongest };
}

async function getStreak() {
  const user = await getUser();
  if (!user) return { current_streak: 0, longest_streak: 0 };
  const { data } = await supabase
    .from('study_streaks')
    .select('current_streak, longest_streak')
    .eq('user_id', user.id)
    .single();
  return data || { current_streak: 0, longest_streak: 0 };
}

// ─────────────────────────────────────────────
// HISTORY HELPERS
// ─────────────────────────────────────────────

async function saveToHistory(question, answer, subject, level) {
  const user = await getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('question_history')
    .insert({ user_id: user.id, question, answer, subject, level })
    .select()
    .single();
  return data;
}

// ─────────────────────────────────────────────
// QUIZ HISTORY HELPERS
// ─────────────────────────────────────────────

async function saveQuizResult(topic, subject, level, score, total, questions) {
  const user = await getUser();
  if (!user) return;
  await supabase.from('quiz_history').insert({
    user_id: user.id, topic, subject, level, score, total, questions
  });
}
