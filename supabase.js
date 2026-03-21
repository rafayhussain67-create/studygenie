// supabase.js — StudyGenie Supabase client
// Load this AFTER the Supabase CDN script in every HTML page

const SUPABASE_URL = 'https://joildbbqsisdoqayfwus.supabase.co';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_PUBLISHABLE_KEY_HERE';

// _supa avoids conflict with window.supabase (the CDN library name)
const _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getUser() {
  const { data: { user } } = await _supa.auth.getUser();
  return user;
}

async function getProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data } = await _supa.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

async function signOut() {
  await _supa.auth.signOut();
  window.location.href = 'login.html';
}

const PLAN_LIMITS = { free: 5, starter: 20, scholar: 50, pro: Infinity };

async function getRemainingQuestions() {
  const profile = await getProfile();
  if (!profile) return 0;
  const limit = PLAN_LIMITS[profile.plan] || 5;
  if (limit === Infinity) return Infinity;
  const today = new Date().toISOString().split('T')[0];
  const { data } = await _supa.from('question_usage').select('count').eq('user_id', profile.id).eq('used_date', today).single();
  return Math.max(0, limit - (data?.count || 0));
}

async function incrementQuestionUsage() {
  const user = await getUser();
  if (!user) return;
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await _supa.from('question_usage').select('id, count').eq('user_id', user.id).eq('used_date', today).single();
  if (existing) {
    await _supa.from('question_usage').update({ count: existing.count + 1 }).eq('id', existing.id);
  } else {
    await _supa.from('question_usage').insert({ user_id: user.id, used_date: today, count: 1 });
  }
}

async function updateStreak() {
  const user = await getUser();
  if (!user) return null;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const { data: streak } = await _supa.from('study_streaks').select('*').eq('user_id', user.id).single();
  if (!streak) {
    await _supa.from('study_streaks').insert({ user_id: user.id, current_streak: 1, longest_streak: 1, last_study_date: today });
    return { current_streak: 1, longest_streak: 1 };
  }
  if (streak.last_study_date === today) return streak;
  const newCurrent = streak.last_study_date === yesterday ? streak.current_streak + 1 : 1;
  const newLongest = Math.max(streak.longest_streak, newCurrent);
  await _supa.from('study_streaks').update({ current_streak: newCurrent, longest_streak: newLongest, last_study_date: today }).eq('user_id', user.id);
  return { current_streak: newCurrent, longest_streak: newLongest };
}

async function getStreak() {
  const user = await getUser();
  if (!user) return { current_streak: 0, longest_streak: 0 };
  const { data } = await _supa.from('study_streaks').select('current_streak, longest_streak').eq('user_id', user.id).single();
  return data || { current_streak: 0, longest_streak: 0 };
}

async function saveToHistory(question, answer, subject, level) {
  const user = await getUser();
  if (!user) return null;
  const { data } = await _supa.from('question_history').insert({ user_id: user.id, question, answer, subject, level }).select().single();
  return data;
}

async function saveQuizResult(topic, subject, level, score, total, questions) {
  const user = await getUser();
  if (!user) return;
  await _supa.from('quiz_history').insert({ user_id: user.id, topic, subject, level, score, total, questions });
}
