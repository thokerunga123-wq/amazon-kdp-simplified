/**
 * Amazon KDP Simplified - Course Dashboard & Player Logic
 * Instructor: Thokerunga Innocent
 * Vector Icons & Responsive Media
 */

// -----------------------------------------------------------------------------
// PROGRESS HELPER FUNCTIONS
// -----------------------------------------------------------------------------

async function getStudentProgress(userId) {
  const client = getSupabase();

  if (client) {
    const { data, error } = await client
      .from('progress')
      .select('lesson_id, completed, lessons(lesson_number)')
      .eq('user_id', userId);

    if (error) {
      console.error("Error fetching progress:", error);
      return [];
    }

    return data
      .filter(item => item.completed)
      .map(item => item.lessons?.lesson_number)
      .filter(Boolean);
  } else {
    // Demo mode: read from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem(`kdp_progress_${userId}`) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (e) {
      return [];
    }
  }
}

async function markLessonCompleted(userId, lessonNumber, isCompleted = true) {
  const client = getSupabase();

  if (client) {
    const { data: lesson } = await client
      .from('lessons')
      .select('id')
      .eq('course_id', APP_CONFIG.COURSE_ID)
      .eq('lesson_number', lessonNumber)
      .maybeSingle();

    if (!lesson) return false;

    const { error } = await client
      .from('progress')
      .upsert({
        user_id: userId,
        lesson_id: lesson.id,
        completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null
      }, { onConflict: 'user_id,lesson_id' });

    if (error) {
      console.error("Error updating progress:", error);
      return false;
    }
    return true;
  } else {
    // Demo mode
    const key = `kdp_progress_${userId}`;
    let completedList = [];
    const saved = localStorage.getItem(key);
    if (saved) {
      try { completedList = JSON.parse(saved); } catch (e) {}
    }

    if (isCompleted) {
      if (!completedList.includes(lessonNumber)) completedList.push(lessonNumber);
    } else {
      completedList = completedList.filter(n => n !== lessonNumber);
    }

    localStorage.setItem(key, JSON.stringify(completedList));
    return true;
  }
}

// -----------------------------------------------------------------------------
// DASHBOARD VIEW CONTROLLER
// -----------------------------------------------------------------------------

async function initDashboard() {
  const user = await requireAuth();
  if (!user) return;

  const welcomeNameEl = document.getElementById('dash-student-name');
  if (welcomeNameEl) {
    welcomeNameEl.textContent = user.full_name || 'Student';
  }

  // Handle Enrollment Inactive Banner
  const enrollmentNotice = document.getElementById('enrollment-status-alert');
  if (enrollmentNotice) {
    if (user.enrollment_status !== 'active' && !user.is_admin) {
      enrollmentNotice.style.display = 'block';
      enrollmentNotice.innerHTML = `
        <div class="form-alert alert-error" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div>
            <strong>Access Pending:</strong> Your account is registered, but course access has not been activated yet.
            <div style="font-size:0.85rem; margin-top:0.25rem;">
              If you have already paid on Selar, please WhatsApp the admin with your payment receipt for instant activation.
            </div>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <a href="${APP_CONFIG.WHATSAPP_SUPPORT_URL}" target="_blank" class="btn btn-whatsapp btn-sm">WhatsApp Admin</a>
          </div>
        </div>
      `;
    } else {
      enrollmentNotice.style.display = 'none';
    }
  }

  // Fetch Progress
  const completedNumbers = await getStudentProgress(user.id);
  const totalLessons = APP_CONFIG.LESSONS_DATA.length;
  const completedCount = completedNumbers.length;
  const percent = Math.round((completedCount / totalLessons) * 100);

  // Update Progress Bar & Counter
  const percentEl = document.getElementById('progress-percent');
  const countEl = document.getElementById('progress-count');
  const barFillEl = document.getElementById('progress-bar-fill');
  const continueBtn = document.getElementById('btn-continue-learning');

  if (percentEl) percentEl.textContent = `${percent}%`;
  if (countEl) countEl.textContent = `${completedCount} of ${totalLessons} Completed`;
  if (barFillEl) barFillEl.style.width = `${percent}%`;

  // Find next uncompleted lesson
  let nextLesson = 1;
  for (let i = 1; i <= totalLessons; i++) {
    if (!completedNumbers.includes(i)) {
      nextLesson = i;
      break;
    }
  }

  if (continueBtn) {
    continueBtn.href = `lesson.html?lesson=${nextLesson}`;
    continueBtn.innerHTML = `
      <span>${completedCount === 0 ? 'Start Lesson 1' : (completedCount === totalLessons ? 'Review Course' : `Continue Lesson ${nextLesson}`)}</span>
      ${typeof ICONS !== 'undefined' ? ICONS.arrowRight : '→'}
    `;
  }

  // Render Lessons List
  const lessonsContainer = document.getElementById('dashboard-lessons-list');
  if (lessonsContainer) {
    lessonsContainer.innerHTML = '';

    APP_CONFIG.LESSONS_DATA.forEach(lesson => {
      const isCompleted = completedNumbers.includes(lesson.number);
      const card = document.createElement('div');
      card.className = 'dash-lesson-card';

      card.innerHTML = `
        <div class="dash-lesson-left">
          <div class="dash-lesson-badge ${isCompleted ? 'completed' : ''}">
            ${isCompleted ? (typeof ICONS !== 'undefined' ? ICONS.check : '✓') : String(lesson.number).padStart(2, '0')}
          </div>
          <div class="dash-lesson-details">
            <h3>Lesson ${lesson.number}: ${lesson.title}</h3>
            <p>${lesson.description}</p>
            <div class="dash-lesson-meta">
              <span class="icon-inline">${typeof ICONS !== 'undefined' ? ICONS.clock : ''}</span>
              <span>${lesson.duration}</span>
              <span>&bull;</span>
              <span>${isCompleted ? '<span style="color:var(--status-success); font-weight:600;">Completed</span>' : 'Not started'}</span>
            </div>
          </div>
        </div>
        <div>
          <a href="lesson.html?lesson=${lesson.number}" class="btn ${isCompleted ? 'btn-secondary' : 'btn-primary'} btn-sm">
            ${isCompleted ? 'Watch Again' : 'Start Lesson'}
          </a>
        </div>
      `;
      lessonsContainer.appendChild(card);
    });
  }
}

// -----------------------------------------------------------------------------
// COURSE PLAYER VIEW CONTROLLER (lesson.html)
// -----------------------------------------------------------------------------

let currentLessonNumber = 1;
let currentUser = null;
let completedLessons = [];

async function initCoursePlayer() {
  currentUser = await requireCourseAccess();
  if (!currentUser) return;

  const urlParams = new URLSearchParams(window.location.search);
  const requestedLesson = parseInt(urlParams.get('lesson'), 10);
  if (requestedLesson && requestedLesson >= 1 && requestedLesson <= APP_CONFIG.LESSONS_DATA.length) {
    currentLessonNumber = requestedLesson;
  } else {
    currentLessonNumber = 1;
  }

  completedLessons = await getStudentProgress(currentUser.id);
  await loadLessonVideoIdsFromDatabase();

  renderPlayerSidebar();
  loadLessonContent(currentLessonNumber);
  attachPlayerControls();
}

// Video IDs saved in the Supabase "lessons" table take priority over js/config.js
let dbVideoIds = {};
async function loadLessonVideoIdsFromDatabase() {
  const client = getSupabase();
  if (!client) return;
  const { data, error } = await client
    .from('lessons')
    .select('lesson_number, wistia_video_id')
    .eq('course_id', APP_CONFIG.COURSE_ID);
  if (error || !data) return;
  data.forEach(row => {
    if (row.wistia_video_id && !row.wistia_video_id.startsWith('WISTIA_VIDEO_ID')) {
      dbVideoIds[row.lesson_number] = row.wistia_video_id;
    }
  });
}

function renderPlayerSidebar() {
  const sidebarContainer = document.getElementById('player-lessons-list');
  if (!sidebarContainer) return;

  sidebarContainer.innerHTML = '';

  APP_CONFIG.LESSONS_DATA.forEach(lesson => {
    const isCompleted = completedLessons.includes(lesson.number);
    const isActive = lesson.number === currentLessonNumber;

    const item = document.createElement('div');
    item.className = `player-lesson-item ${isActive ? 'active' : ''}`;
    item.onclick = () => switchLesson(lesson.number);

    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    if (isActive) item.setAttribute('aria-current', 'true');
    item.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchLesson(lesson.number); }
    };

    const clockIcon = typeof ICONS !== 'undefined' ? ICONS.clock : '';
    item.innerHTML = `
      <div class="player-check-icon ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}">
        ${isCompleted ? (typeof ICONS !== 'undefined' ? ICONS.check : '✓') : String(lesson.number).padStart(2, '0')}
      </div>
      <div class="player-lesson-meta">
        <h4>${lesson.title}</h4>
        <span><span class="icon-inline">${clockIcon}</span>${lesson.duration}${isActive ? ' &bull; <em>Now playing</em>' : ''}</span>
      </div>
    `;

    sidebarContainer.appendChild(item);
  });

  // Sidebar progress summary
  const total = APP_CONFIG.LESSONS_DATA.length;
  const done = completedLessons.length;
  const fill = document.getElementById('sidebar-progress-fill');
  const text = document.getElementById('sidebar-progress-text');
  if (fill) fill.style.width = `${Math.round((done / total) * 100)}%`;
  if (text) text.textContent = `${done} of ${total} completed`;

  // Keep the active lesson visible in the sidebar
  // (only scrolls inside the sidebar list, never the whole page)
  const activeItem = sidebarContainer.querySelector('.player-lesson-item.active');
  if (activeItem && sidebarContainer.scrollHeight > sidebarContainer.clientHeight) {
    const top = activeItem.offsetTop - sidebarContainer.offsetTop;
    const bottom = top + activeItem.offsetHeight;
    if (top < sidebarContainer.scrollTop) {
      sidebarContainer.scrollTop = top - 8;
    } else if (bottom > sidebarContainer.scrollTop + sidebarContainer.clientHeight) {
      sidebarContainer.scrollTop = bottom - sidebarContainer.clientHeight + 8;
    }
  }
}

/**
 * Render lesson notes: "• " lines become a styled list, other lines become paragraphs.
 * Built with textContent so note text can never inject HTML.
 */
function renderLessonNotes(container, notes) {
  container.innerHTML = '';
  let list = null;
  (notes || '').split('\n').forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('•') || line.startsWith('-')) {
      if (!list) {
        list = document.createElement('ul');
        list.className = 'lesson-notes-list';
        container.appendChild(list);
      }
      const li = document.createElement('li');
      const text = line.replace(/^[•-]\s*/, '');
      const actionMatch = text.match(/^(Action Step:)\s*(.*)$/i);
      if (actionMatch) {
        li.className = 'is-action';
        const strong = document.createElement('strong');
        strong.textContent = actionMatch[1] + ' ';
        li.appendChild(strong);
        li.appendChild(document.createTextNode(actionMatch[2]));
      } else {
        li.textContent = text;
      }
      list.appendChild(li);
    } else {
      list = null;
      const p = document.createElement('p');
      p.className = 'lesson-notes-heading';
      p.textContent = line;
      container.appendChild(p);
    }
  });
}

function loadLessonContent(lessonNumber) {
  currentLessonNumber = lessonNumber;
  const lesson = APP_CONFIG.LESSONS_DATA.find(l => l.number === lessonNumber);
  if (!lesson) return;

  const newUrl = `${window.location.pathname}?lesson=${lessonNumber}`;
  window.history.replaceState({ path: newUrl }, '', newUrl);

  document.getElementById('player-lesson-title').textContent = lesson.title;
  document.title = `Lesson ${lesson.number}: ${lesson.title} | Amazon KDP Simplified`;
  document.getElementById('player-lesson-desc').textContent = lesson.description;
  renderLessonNotes(document.getElementById('player-lesson-notes'), lesson.notes);

  const chipNumber = document.getElementById('lesson-chip-number');
  const chipDuration = document.getElementById('lesson-chip-duration');
  const chipStatus = document.getElementById('lesson-chip-status');
  const lessonDone = completedLessons.includes(lessonNumber);
  if (chipNumber) chipNumber.textContent = `Lesson ${lesson.number} of ${APP_CONFIG.LESSONS_DATA.length}`;
  if (chipDuration) chipDuration.innerHTML = `<span class="icon-inline">${typeof ICONS !== 'undefined' ? ICONS.clock : ''}</span> ${lesson.duration}`;
  if (chipStatus) {
    chipStatus.textContent = lessonDone ? 'Completed' : 'In progress';
    chipStatus.className = `lesson-chip ${lessonDone ? 'lesson-chip-success' : ''}`;
  }
  document.getElementById('topbar-lesson-indicator').textContent = `Lesson ${lesson.number} of ${APP_CONFIG.LESSONS_DATA.length}`;

  const completeBtn = document.getElementById('btn-mark-complete');
  const isCompleted = completedLessons.includes(lessonNumber);
  if (completeBtn) {
    if (isCompleted) {
      completeBtn.className = 'btn btn-outline';
      completeBtn.innerHTML = `<span class="icon-inline" style="color:var(--status-success);">${typeof ICONS !== 'undefined' ? ICONS.checkCircle : '✓'}</span> Completed (Click to undo)`;
    } else {
      completeBtn.className = 'btn btn-primary';
      completeBtn.innerHTML = `<span class="icon-inline">${typeof ICONS !== 'undefined' ? ICONS.check : '✓'}</span> Mark as Completed`;
    }
  }

  const prevBtn = document.getElementById('btn-prev-lesson');
  const nextBtn = document.getElementById('btn-next-lesson');
  if (prevBtn) {
    prevBtn.disabled = lessonNumber <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = lessonNumber >= APP_CONFIG.LESSONS_DATA.length;
  }

  renderWistiaPlayer(lesson);
  renderPlayerSidebar();
}

function renderWistiaPlayer(lesson) {
  const container = document.getElementById('wistia-embed-target');
  if (!container) return;

  const wistiaId = dbVideoIds[lesson.number] || APP_CONFIG.WISTIA_VIDEOS[lesson.number] || lesson.wistiaId;

  if (!wistiaId || wistiaId.startsWith('WISTIA_VIDEO_ID')) {
    container.innerHTML = `
      <div class="video-placeholder">
        <div class="video-placeholder-glow"></div>
        <span class="video-placeholder-badge">Lesson ${lesson.number} &bull; ${lesson.duration}</span>
        <div class="video-placeholder-play" aria-hidden="true">
          <svg viewBox="0 0 24 24"><polygon points="7 4 20 12 7 20 7 4"></polygon></svg>
        </div>
        <h3 class="video-placeholder-title"></h3>
        <p class="video-placeholder-sub">Video coming soon. The lesson notes below are ready for you now.</p>
      </div>
    `;
    container.querySelector('.video-placeholder-title').textContent = lesson.title;
    return;
  }

  container.innerHTML = `
    <div class="wistia_responsive_padding" style="padding:56.25% 0 0 0;position:relative;">
      <div class="wistia_responsive_wrapper" style="height:100%;left:0;position:absolute;top:0;width:100%;">
        <iframe 
          src="https://fast.wistia.net/embed/iframe/${encodeURIComponent(wistiaId)}?videoFoam=true" 
          title="${lesson.title}" 
          allow="autoplay; fullscreen" 
          allowtransparency="true" 
          frameborder="0" 
          scrolling="no" 
          class="wistia_embed" 
          name="wistia_embed" 
          width="100%" 
          height="100%">
        </iframe>
      </div>
    </div>
  `;
}

function switchLesson(targetLessonNumber) {
  if (targetLessonNumber >= 1 && targetLessonNumber <= APP_CONFIG.LESSONS_DATA.length) {
    loadLessonContent(targetLessonNumber);
    const mainArea = document.querySelector('.player-main-area');
    if (mainArea) mainArea.scrollTop = 0;
  }
}

function attachPlayerControls() {
  const completeBtn = document.getElementById('btn-mark-complete');
  const prevBtn = document.getElementById('btn-prev-lesson');
  const nextBtn = document.getElementById('btn-next-lesson');

  if (completeBtn) {
    completeBtn.onclick = async () => {
      const isCurrentlyCompleted = completedLessons.includes(currentLessonNumber);
      const newStatus = !isCurrentlyCompleted;

      completeBtn.disabled = true;
      const success = await markLessonCompleted(currentUser.id, currentLessonNumber, newStatus);
      completeBtn.disabled = false;

      if (success) {
        if (newStatus) {
          if (!completedLessons.includes(currentLessonNumber)) {
            completedLessons.push(currentLessonNumber);
          }
          showToast(`Lesson ${currentLessonNumber} marked as completed!`, 'success');
        } else {
          completedLessons = completedLessons.filter(n => n !== currentLessonNumber);
          showToast(`Lesson ${currentLessonNumber} marked as incomplete.`, 'info');
        }

        loadLessonContent(currentLessonNumber);
      }
    };
  }

  if (prevBtn) {
    prevBtn.onclick = () => switchLesson(currentLessonNumber - 1);
  }

  if (nextBtn) {
    nextBtn.onclick = () => switchLesson(currentLessonNumber + 1);
  }
}
