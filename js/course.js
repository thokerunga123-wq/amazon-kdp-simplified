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

  const name = (user.full_name || 'Student').replace(/\s*\(admin\)\s*/i, '').trim() || 'Student';
  const firstName = name.split(/\s+/)[0];
  const initials = name.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'S';

  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setText('dash-student-name', firstName);
  setText('dash-user-name', name);
  setText('dash-avatar', initials);

  const adminLink = document.getElementById('dash-admin-link');
  if (adminLink) adminLink.hidden = !user.is_admin;

  // Access pending notice
  const notice = document.getElementById('enrollment-status-alert');
  const hasAccess = user.is_admin || user.enrollment_status === 'active';
  const resources = document.getElementById('dash-resources');
  if (resources) resources.hidden = !hasAccess;
  if (notice) {
    notice.hidden = hasAccess;
    if (!hasAccess) {
      notice.innerHTML = `
        <div>
          <strong>Your access is being activated.</strong>
          <span>Already paid on Selar? Send your receipt on WhatsApp and we'll switch it on.</span>
        </div>
        <a href="${APP_CONFIG.WHATSAPP_SUPPORT_URL}" target="_blank" rel="noopener noreferrer" class="admin-btn-solid dash-alert-btn">Message us</a>
      `;
    }
  }

  // Lessons (latest from the database) + progress
  await loadCourseLessons();
  const completedNumbers = await getStudentProgress(user.id);
  const lessons = APP_CONFIG.LESSONS_DATA;
  const totalLessons = lessons.length;
  const completedCount = lessons.filter(l => completedNumbers.includes(l.number)).length;
  const percent = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

  // Progress ring
  setText('progress-percent', `${percent}%`);
  setText('progress-count', `${completedCount} of ${totalLessons} lessons completed`);
  setText('progress-sub',
    completedCount === 0 ? "Let's get your first book started."
    : completedCount === totalLessons ? 'Course complete. Well done!'
    : `${totalLessons - completedCount} lesson${totalLessons - completedCount === 1 ? '' : 's'} to go.`);
  const ring = document.getElementById('dash-progress-ring');
  if (ring) ring.style.setProperty('--pct', percent);
  setText('dash-lessons-meta', `${totalLessons} lessons`);

  if (!totalLessons) {
    const list = document.getElementById('dashboard-lessons-list');
    if (list) list.innerHTML = '<div class="admin-empty">Lessons are coming soon.</div>';
    const cont = document.getElementById('btn-continue-learning');
    if (cont) cont.hidden = true;
    return;
  }

  // Next lesson
  const next = lessons.find(l => !completedNumbers.includes(l.number)) || lessons[0];
  const continueBtn = document.getElementById('btn-continue-learning');
  if (continueBtn) {
    continueBtn.href = `lesson.html?lesson=${next.number}`;
    continueBtn.classList.toggle('is-locked', !hasAccess);
    setText('dash-continue-label',
      completedCount === 0 ? 'Start here'
      : completedCount === totalLessons ? 'Watch again'
      : `Up next · Lesson ${next.number} of ${totalLessons}`);
    setText('dash-continue-title', next.title);
    setText('dash-continue-desc', next.description || '');
    setText('dash-continue-cta-text', completedCount === 0 ? 'Start lesson 1' : (completedCount === totalLessons ? 'Review course' : 'Continue'));

    const thumb = document.getElementById('dash-continue-thumb');
    const thumbUrl = getVideoThumbnail(next.wistiaId);
    if (thumb) {
      const old = thumb.querySelector('img');
      if (old) old.remove();
      continueBtn.classList.remove('has-thumb');
      if (thumbUrl) {
        const img = document.createElement('img');
        img.src = thumbUrl;
        img.alt = '';
        img.onload = () => continueBtn.classList.add('has-thumb');
        img.onerror = () => { img.remove(); continueBtn.classList.remove('has-thumb'); };
        thumb.prepend(img);
      }
    }
  }

  // Lesson rows
  const list = document.getElementById('dashboard-lessons-list');
  if (!list) return;
  list.innerHTML = '';
  const checkIcon = typeof ICONS !== 'undefined' ? ICONS.check : '✓';

  lessons.forEach(lesson => {
    const done = completedNumbers.includes(lesson.number);
    const isNext = lesson.number === next.number && completedCount !== totalLessons;
    const row = document.createElement('a');
    row.href = `lesson.html?lesson=${lesson.number}`;
    row.className = `dash-lesson-row${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`;
    row.innerHTML = `
      <span class="dash-lesson-badge">${done ? checkIcon : String(lesson.number).padStart(2, '0')}</span>
      <span class="dash-lesson-text">
        <span class="dash-lesson-title">${escapeHtml(lesson.title)}</span>
        <span class="dash-lesson-meta">${escapeHtml(lesson.duration)}</span>
      </span>
      <span class="dash-lesson-state">${done ? 'Completed' : (isNext ? 'Up next' : '')}</span>
      <svg class="svg-icon dash-lesson-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
    `;
    list.appendChild(row);
  });
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

  await loadCourseLessons();

  const total = APP_CONFIG.LESSONS_DATA.length;
  const countEl = document.querySelector('.sidebar-count');
  if (countEl) countEl.textContent = `${total} lesson${total === 1 ? '' : 's'}`;
  if (!total) {
    const title = document.getElementById('player-lesson-title');
    if (title) title.textContent = 'No lessons yet. Check back soon.';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const requestedLesson = parseInt(urlParams.get('lesson'), 10);
  if (requestedLesson && requestedLesson >= 1 && requestedLesson <= total) {
    currentLessonNumber = requestedLesson;
  } else {
    currentLessonNumber = 1;
  }

  completedLessons = await getStudentProgress(currentUser.id);

  renderPlayerSidebar();
  loadLessonContent(currentLessonNumber);
  attachPlayerControls();
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
        <h4>${escapeHtml(lesson.title)}</h4>
        <span><span class="icon-inline">${clockIcon}</span>${escapeHtml(lesson.duration)}${isActive ? ' &bull; <em>Now playing</em>' : ''}</span>
      </div>
    `;

    sidebarContainer.appendChild(item);
  });

  // Sidebar progress summary
  const total = APP_CONFIG.LESSONS_DATA.length;
  const done = APP_CONFIG.LESSONS_DATA.filter(l => completedLessons.includes(l.number)).length;
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

  // Show the Book Formatter Pro download on the lesson that teaches it
  const lessonResources = document.getElementById('lesson-resources');
  if (lessonResources) lessonResources.hidden = !/book\s*formatter/i.test(`${lesson.title} ${lesson.description || ''}`);

  const chipNumber = document.getElementById('lesson-chip-number');
  const chipDuration = document.getElementById('lesson-chip-duration');
  const chipStatus = document.getElementById('lesson-chip-status');
  const lessonDone = completedLessons.includes(lessonNumber);
  if (chipNumber) chipNumber.textContent = `Lesson ${lesson.number} of ${APP_CONFIG.LESSONS_DATA.length}`;
  if (chipDuration) chipDuration.innerHTML = `<span class="icon-inline">${typeof ICONS !== 'undefined' ? ICONS.clock : ''}</span> ${escapeHtml(lesson.duration)}`;
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

  const wistiaId = lesson.wistiaId;

  if (!isRealVideoId(wistiaId)) {
    container.innerHTML = `
      <div class="video-placeholder">
        <div class="video-placeholder-glow"></div>
        <span class="video-placeholder-badge">Lesson ${lesson.number} &bull; ${escapeHtml(lesson.duration)}</span>
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

  const embedUrl = getVideoEmbedUrl(wistiaId);
  container.innerHTML = `
    <iframe
      class="lesson-video-frame"
      src="${embedUrl}"
      title="${escapeHtml(lesson.title)}"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
      frameborder="0">
    </iframe>
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
