/**
 * Amazon KDP Simplified - Shared lesson data
 *
 * The Supabase "lessons" table is the source of truth (edited from the Admin
 * panel -> Lessons tab). js/config.js LESSONS_DATA is only the fallback, used
 * in Demo Mode or when the database can't be read (e.g. inactive students).
 */

const DEMO_LESSON_OVERRIDES_KEY = 'kdp_demo_lesson_overrides';
let lessonsLoaded = false;

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Lesson videos are stored in the lessons.wistia_video_id column as:
 *   - a Wistia ID   e.g. "8xbijio4bb"
 *   - a YouTube ID  prefixed with "yt:"  e.g. "yt:z766zE9dfps"
 * "WISTIA_VIDEO_ID_n" placeholders mean "no video yet".
 */
function isRealVideoId(id) {
  return Boolean(id) && !String(id).startsWith('WISTIA_VIDEO_ID');
}

function isYouTubeVideo(stored) {
  return String(stored || '').startsWith('yt:');
}

/**
 * Accepts anything copied from YouTube or Wistia (link, share link, embed code,
 * iframe, or a bare ID) and returns the value to store, or null if not recognised.
 */
function parseVideoInput(input) {
  if (!input) return null;
  const value = String(input).trim();

  // YouTube (IDs are case-sensitive, 11 chars)
  const ytPatterns = [
    /youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/watch\?(?:[^"'\s]*&)?v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/
  ];
  for (const re of ytPatterns) {
    const m = value.match(re);
    if (m) return `yt:${m[1]}`;
  }

  // Wistia (10 chars, lowercase)
  const wistiaPatterns = [
    /media-id=["']?([a-z0-9]{10})/i,
    /wistia\.(?:com|net)\/(?:medias|embed\/iframe|embed\/medias)\/([a-z0-9]{10})/i,
    /wistia\.(?:com|net)\/embed\/([a-z0-9]{10})\.js/i,
    /wistia_async_([a-z0-9]{10})/i,
    /wvideo=([a-z0-9]{10})/i,
    /^([a-z0-9]{10})$/i
  ];
  for (const re of wistiaPatterns) {
    const m = value.match(re);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

/** Kept for older code paths */
function parseWistiaId(input) {
  const v = parseVideoInput(input);
  return v && !isYouTubeVideo(v) ? v : null;
}

function getVideoEmbedUrl(stored) {
  if (!isRealVideoId(stored)) return null;
  if (isYouTubeVideo(stored)) {
    const id = encodeURIComponent(stored.slice(3));
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
  }
  return `https://fast.wistia.net/embed/iframe/${encodeURIComponent(stored)}?videoFoam=true`;
}

function getVideoThumbnail(stored) {
  if (!isRealVideoId(stored)) return null;
  if (isYouTubeVideo(stored)) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(stored.slice(3))}/hqdefault.jpg`;
  }
  return `https://fast.wistia.com/embed/medias/${encodeURIComponent(stored)}/swatch`;
}

function getVideoSourceLabel(stored) {
  if (!isRealVideoId(stored)) return '';
  return isYouTubeVideo(stored) ? 'YouTube' : 'Wistia';
}

function getDemoLessonOverrides() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_LESSON_OVERRIDES_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function saveDemoLessonOverride(lessonNumber, fields) {
  const all = getDemoLessonOverrides();
  all[lessonNumber] = Object.assign({}, all[lessonNumber] || {}, fields);
  try { localStorage.setItem(DEMO_LESSON_OVERRIDES_KEY, JSON.stringify(all)); } catch (e) {}
}

/**
 * Loads lessons (database first, config as fallback) into APP_CONFIG.LESSONS_DATA
 * so every page uses the same, up-to-date content.
 */
async function loadCourseLessons(force = false) {
  if (lessonsLoaded && !force) return APP_CONFIG.LESSONS_DATA;

  // Start from the built-in defaults; config video IDs fill in when set
  const base = APP_CONFIG.LESSONS_DATA.map(l => {
    const cfgId = APP_CONFIG.WISTIA_VIDEOS[l.number];
    return Object.assign({}, l, { wistiaId: isRealVideoId(cfgId) ? cfgId : l.wistiaId });
  });

  let rows = null;
  const client = getSupabase();

  if (client) {
    const { data, error } = await client
      .from('lessons')
      .select('id, lesson_number, title, description, notes, duration, wistia_video_id, active')
      .eq('course_id', APP_CONFIG.COURSE_ID)
      .order('lesson_number', { ascending: true });
    if (!error && Array.isArray(data) && data.length) rows = data;
  } else {
    const overrides = getDemoLessonOverrides();
    rows = Object.keys(overrides).map(n => Object.assign({ lesson_number: Number(n) }, overrides[n]));
  }

  if (rows) {
    rows.forEach(row => {
      const lesson = base.find(l => l.number === row.lesson_number);
      if (!lesson) return;
      if (row.id) lesson.id = row.id;
      if (row.title) lesson.title = row.title;
      if (row.description) lesson.description = row.description;
      if (row.notes) lesson.notes = row.notes;
      if (row.duration) lesson.duration = row.duration;
      if (isRealVideoId(row.wistia_video_id)) lesson.wistiaId = row.wistia_video_id;
    });
  }

  APP_CONFIG.LESSONS_DATA = base;
  lessonsLoaded = true;
  return base;
}
