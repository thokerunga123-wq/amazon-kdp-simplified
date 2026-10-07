/**
 * Amazon KDP Simplified - Admin Dashboard, Student Credential Generator & Device Lock Manager
 * Instructor: Thokerunga Innocent
 */

let allStudents = [];
let currentFilter = 'all';
let searchQuery = '';

async function initAdminDashboard() {
  const adminUser = await requireAdmin();
  if (!adminUser) return;

  const displayName = (adminUser.full_name || adminUser.email || 'Administrator').replace(/\s*\(admin\)\s*/i, '').trim();
  const adminNameEl = document.getElementById('admin-user-name');
  if (adminNameEl) adminNameEl.textContent = displayName;
  const avatarEl = document.getElementById('admin-avatar');
  if (avatarEl) avatarEl.textContent = getInitials(displayName);

  attachAdminEventListeners();
  initAdminTabs();
  await loadStudents();
  await loadAdminLessons();
}

function getInitials(name) {
  const parts = String(name || '').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/**
 * Students / Lessons tabs (remembers the last tab via the URL hash)
 */
function initAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const show = (name) => {
    tabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.admin-panel').forEach(p => {
      p.hidden = p.id !== `panel-${name}`;
    });
    if (window.location.hash !== `#${name}`) {
      history.replaceState(null, '', `#${name}`);
    }
  };
  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
  show(window.location.hash === '#lessons' ? 'lessons' : 'students');
}

/**
 * Load students from Supabase (or demo state)
 */
async function loadStudents() {
  const client = getSupabase();

  if (client) {
    // 1. Fetch profiles
    const { data: profiles, error: profileErr } = await client
      .from('profiles')
      .select('id, full_name, email, is_admin, device_id, created_at')
      .order('created_at', { ascending: false });

    if (profileErr) {
      console.error("Error loading profiles:", profileErr);
      showToast("Failed to fetch students", "error");
      return;
    }

    // 2. Fetch enrollments
    const { data: enrollments } = await client
      .from('enrollments')
      .select('user_id, status, created_at');

    // 3. Fetch progress counts
    const { data: progressItems } = await client
      .from('progress')
      .select('user_id, completed')
      .eq('completed', true);

    const enrollmentMap = {};
    (enrollments || []).forEach(e => {
      enrollmentMap[e.user_id] = e.status;
    });

    const progressMap = {};
    (progressItems || []).forEach(p => {
      progressMap[p.user_id] = (progressMap[p.user_id] || 0) + 1;
    });

    allStudents = profiles.map(p => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      is_admin: p.is_admin,
      device_id: p.device_id,
      status: enrollmentMap[p.id] || 'inactive',
      completed_lessons: progressMap[p.id] || 0,
      created_at: p.created_at
    }));
  } else {
    // Demo Mode Storage
    const demoList = getDemoStudents();
    allStudents = demoList.map(s => ({
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      password: s.password || 'password123',
      is_admin: s.is_admin,
      device_id: s.device_id,
      status: s.enrollment_status || 'active',
      completed_lessons: getDemoCompletedCount(s.id),
      created_at: s.created_at || new Date().toISOString()
    }));
  }

  updateMetrics();
  renderStudentTable();
}

function getDemoCompletedCount(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`kdp_progress_${userId}`) || '[]');
    return Array.isArray(saved) ? saved.length : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Update Metric Cards
 */
function updateMetrics() {
  const studentsOnly = allStudents.filter(s => !s.is_admin);
  const total = studentsOnly.length;
  const active = studentsOnly.filter(s => s.status === 'active').length;
  const inactive = studentsOnly.filter(s => s.status !== 'active').length;
  const lockedDevices = studentsOnly.filter(s => s.device_id).length;

  document.getElementById('metric-total-students').textContent = total;
  document.getElementById('metric-active-students').textContent = active;
  document.getElementById('metric-inactive-students').textContent = inactive;
  document.getElementById('metric-locked-devices').textContent = lockedDevices;
}

/**
 * Filter & Render Student Table
 */
function renderStudentTable() {
  const tableBody = document.getElementById('students-table-body');
  if (!tableBody) return;

  const filtered = allStudents.filter(student => {
    if (student.is_admin) return false;

    if (currentFilter === 'active' && student.status !== 'active') return false;
    if (currentFilter === 'inactive' && student.status === 'active') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (student.full_name || '').toLowerCase().includes(q);
      const matchEmail = (student.email || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    const hasAny = allStudents.some(st => !st.is_admin);
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="admin-empty">
          <div class="admin-empty-title">${hasAny ? 'No students match your search.' : 'No students yet.'}</div>
          <div class="admin-empty-sub">${hasAny ? 'Try a different name, email or filter.' : 'When someone pays on Selar, click <strong>Add student</strong> to create their login.'}</div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = '';
  const totalLessons = APP_CONFIG.LESSONS_DATA.length;

  filtered.forEach(student => {
    const row = document.createElement('tr');
    const percent = Math.round((student.completed_lessons / totalLessons) * 100);
    const dateFormatted = new Date(student.created_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const isActive = student.status === 'active';
    const isDeviceLocked = Boolean(student.device_id);

    row.innerHTML = `
      <td>
        <div class="admin-student">
          <span class="admin-student-avatar">${escapeHtml(getInitials(student.full_name || student.email))}</span>
          <div class="admin-student-text">
            <div class="admin-student-name">${escapeHtml(student.full_name || 'Student')}</div>
            <div class="admin-student-email">${escapeHtml(student.email)}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="admin-status ${isActive ? 'is-active' : 'is-inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
      </td>
      <td>
        <div class="admin-progress" title="${student.completed_lessons} of ${totalLessons} lessons completed">
          <div class="admin-progress-track"><div class="admin-progress-fill" style="width:${percent}%"></div></div>
          <span>${student.completed_lessons}/${totalLessons}</span>
        </div>
      </td>
      <td>
        ${isDeviceLocked
          ? `<div class="admin-device is-locked">
               <span class="icon-inline">${ICONS.lock}</span><span>Locked</span>
               <button onclick="resetStudentDeviceLock('${student.id}')" class="admin-text-btn" title="Let the student log in on a new device">Reset</button>
             </div>`
          : `<div class="admin-device"><span class="icon-inline">${ICONS.device}</span><span>Not used yet</span></div>`
        }
      </td>
      <td class="admin-muted">${dateFormatted}</td>
      <td class="col-actions">
        <div class="admin-row-actions">
          ${isActive
            ? `<button onclick="toggleEnrollment('${student.id}', 'inactive')" class="admin-btn-ghost is-danger">Deactivate</button>`
            : `<button onclick="toggleEnrollment('${student.id}', 'active')" class="admin-btn-solid">Activate</button>`
          }
          <button onclick="viewStudentDetails('${student.id}')" class="admin-icon-btn" title="Details" aria-label="Student details">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

/**
 * Toggle Enrollment (Activate / Deactivate)
 */
async function toggleEnrollment(studentId, newStatus) {
  const client = getSupabase();

  if (client) {
    // Upsert so activation also works for students who have no enrollment row yet
    const { error } = await client
      .from('enrollments')
      .upsert({
        user_id: studentId,
        course_id: APP_CONFIG.COURSE_ID,
        status: newStatus,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,course_id' });

    if (error) {
      console.error("Error updating enrollment:", error);
      showToast("Failed to update enrollment status", "error");
      return;
    }
  } else {
    // Demo Mode
    const students = getDemoStudents();
    const match = students.find(s => s.id === studentId);
    if (match) {
      match.enrollment_status = newStatus;
      saveDemoStudents(students);
    }
  }

  showToast(`Student status updated to ${newStatus.toUpperCase()}`, "success");
  await loadStudents();
}

/**
 * Reset Device Lock for a Student
 */
async function resetStudentDeviceLock(studentId) {
  const confirmReset = confirm("Reset device lock for this student? This allows them to log in on a new laptop or device.");
  if (!confirmReset) return;

  const client = getSupabase();

  if (client) {
    const { error } = await client.rpc('reset_student_device', { target_user_id: studentId });

    if (error) {
      console.error("Error resetting device:", error);
      showToast("Failed to reset device lock", "error");
      return;
    }
  } else {
    // Demo Mode
    const students = getDemoStudents();
    const match = students.find(s => s.id === studentId);
    if (match) {
      match.device_id = null;
      saveDemoStudents(students);
    }
  }

  showToast("Device lock reset successfully! Student can now log in on their new device.", "success");
  await loadStudents();
}

/**
 * Generate a secure random student password
 */
function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomCode = '';
  const bytes = new Uint32Array(6);
  if (window.crypto && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 1e9);
  }
  for (let i = 0; i < 6; i++) {
    randomCode += chars.charAt(bytes[i] % chars.length);
  }
  return `KDP-${randomCode}`;
}

/**
 * Open Modal to Generate New Student Credentials
 */
function openCreateStudentModal() {
  const modalEl = document.getElementById('student-modal-body');
  if (!modalEl) return;

  const defaultPassword = generateRandomPassword();

  modalEl.innerHTML = `
    <div style="margin-bottom:1.25rem;">
      <h2 style="font-size:1.35rem; margin-bottom:0.25rem; display:flex; align-items:center; gap:0.5rem;">
        <span class="icon-inline" style="color:var(--accent-yellow);">${ICONS.key}</span>
        Add student
      </h2>
      <p style="color:var(--text-secondary-dark); font-size:0.875rem;">
        Creates a login for someone who paid on Selar. Access is active immediately and locks to the first device they use.
      </p>
    </div>

    <form id="generate-student-form" onsubmit="handleCreateStudentSubmit(event)">
      <div class="form-group">
        <label class="form-label" for="gen-name">Student Full Name</label>
        <input type="text" id="gen-name" class="form-input" placeholder="e.g. Sandra Nabirye" required>
      </div>

      <div class="form-group">
        <label class="form-label" for="gen-email">Student Email (from Selar)</label>
        <input type="email" id="gen-email" class="form-input" placeholder="sandra@example.com" required>
      </div>

      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
          <label class="form-label" for="gen-password" style="margin-bottom:0;">Assigned Password</label>
          <button type="button" onclick="document.getElementById('gen-password').value = generateRandomPassword()" class="btn-text-action">
            Regenerate
          </button>
        </div>
        <input type="text" id="gen-password" class="form-input" value="${defaultPassword}" required>
        <span class="form-help">Locked to only 1 device upon first login.</span>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
        <button type="button" onclick="closeModal('student-detail-modal')" class="btn btn-outline btn-sm">Cancel</button>
        <button type="submit" id="btn-save-gen-student" class="btn btn-primary btn-sm">
          Create login
        </button>
      </div>
    </form>
  `;

  openModal('student-detail-modal');
}

/**
 * Handle Student Creation Submission
 */
async function handleCreateStudentSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('gen-name').value.trim();
  const email = document.getElementById('gen-email').value.trim();
  const password = document.getElementById('gen-password').value.trim();
  const saveBtn = document.getElementById('btn-save-gen-student');

  saveBtn.disabled = true;
  saveBtn.textContent = 'Generating...';

  const client = getSupabase();

  if (client) {
    try {
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      // IMPORTANT: sign the student up on a separate, non-persistent client.
      // Using the main client would replace the admin's own session with the student's.
      const signupClient = supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'kdp-admin-signup-' + Date.now()
        }
      });

      const { data, error } = await signupClient.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name }
        }
      });

      if (error) throw error;

      // Supabase returns a user with no identities when the email already exists
      if (!data.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0)) {
        throw new Error("A student with this email already exists. Search for them in the table and click Activate instead.");
      }

      if (!data.session) {
        // "Confirm email" is ON in Supabase: the student must click the email link before they can log in
        showToast("Account created, but Supabase 'Confirm email' is ON. Turn it OFF (Authentication → Sign In / Providers → Email) so generated logins work immediately.", "error", 9000);
      }
      try { await signupClient.auth.signOut(); } catch (e) {}

      // Activate enrollment (done with the admin's own session)
      const { error: enrollErr } = await client
        .from('enrollments')
        .upsert({
          user_id: data.user.id,
          course_id: APP_CONFIG.COURSE_ID,
          status: 'active',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,course_id' });

      if (enrollErr) {
        console.error("Error activating enrollment:", enrollErr);
        showToast("Account created but activation failed. Click Activate next to the student.", "error", 7000);
      }
    } catch (err) {
      console.error("Error creating student in Supabase:", err);
      showToast(err.message || "Failed to create student in Supabase", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = 'Create login';
      return;
    }
  } else {
    // Demo Mode Storage
    const students = getDemoStudents();
    if (students.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      showToast("A student with this email already exists.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = 'Create login';
      return;
    }
    const newStudent = {
      id: "student-" + Date.now(),
      full_name: name,
      email: email,
      password: password,
      is_admin: false,
      enrollment_status: "active",
      device_id: null, // Ready for first login on 1 device
      created_at: new Date().toISOString()
    };
    students.unshift(newStudent);
    saveDemoStudents(students);
  }

  showToast(`Credentials generated for ${name}!`, "success");
  await loadStudents();

  // Show Pre-formatted WhatsApp Message Modal to send to the student
  showStudentWelcomeMessageModal(name, email, password);
}

/**
 * Show Copyable WhatsApp Message for the newly generated student
 */
function showStudentWelcomeMessageModal(name, email, password) {
  const modalEl = document.getElementById('student-modal-body');
  if (!modalEl) return;

  const loginUrl = new URL('index.html', window.location.href).href;
  const whatsappMsg = `Hello ${name}, welcome to Amazon KDP Simplified! 🎓

Here are your exclusive course access details:
🌐 Course Portal: ${loginUrl}
📧 Email: ${email}
🔑 Password: ${password}

⚠️ IMPORTANT: Your account is locked to 1 device. Please log in on the laptop or computer you will use for studying.

Let me know once you log in successfully!`;

  modalEl.innerHTML = `
    <div style="margin-bottom:1.25rem;">
      <h2 style="font-size:1.35rem; color:#6EE7B7; margin-bottom:0.25rem; display:flex; align-items:center; gap:0.5rem;">
        <span class="icon-inline">${ICONS.checkCircle}</span>
        Credentials Created Successfully!
      </h2>
      <p style="color:var(--text-secondary-dark); font-size:0.875rem;">
        Copy the student's access details below or send directly via WhatsApp.
      </p>
    </div>

    <div style="background:#141414; border:1px solid #2B2B2B; border-radius:8px; padding:1.25rem; margin-bottom:1.25rem;">
      <div style="margin-bottom:0.5rem; font-size:0.9rem;">
        <strong>Student:</strong> ${escapeHtml(name)}
      </div>
      <div style="margin-bottom:0.5rem; font-size:0.9rem;">
        <strong>Email:</strong> <code>${escapeHtml(email)}</code>
      </div>
      <div style="margin-bottom:0.5rem; font-size:0.9rem;">
        <strong>Password:</strong> <code style="color:var(--accent-yellow); font-weight:700;">${escapeHtml(password)}</code>
      </div>
      <div style="font-size:0.8rem; color:#A3A3A3; margin-top:0.5rem;">
        🔒 Device Lock: Active (Will lock to their first computer upon login)
      </div>
    </div>

    <div style="margin-bottom:1.5rem;">
      <label class="form-label">Pre-formatted Student Message:</label>
      <textarea id="whatsapp-copy-box" class="form-input" rows="7" readonly style="font-family:monospace; font-size:0.8125rem;">${escapeHtml(whatsappMsg)}</textarea>
    </div>

    <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
      <button onclick="copyStudentMessage()" class="btn btn-secondary btn-sm" id="btn-copy-msg">
        <span class="icon-inline">${ICONS.copy}</span> Copy Message
      </button>
      <a href="https://wa.me/?text=${encodeURIComponent(whatsappMsg)}" target="_blank" class="btn btn-whatsapp btn-sm">
        <span class="icon-inline">${ICONS.whatsapp}</span> Send on WhatsApp
      </a>
      <button onclick="closeModal('student-detail-modal')" class="btn btn-outline btn-sm">Close</button>
    </div>
  `;

  openModal('student-detail-modal');
}

function copyStudentMessage() {
  const box = document.getElementById('whatsapp-copy-box');
  if (box) {
    box.select();
    const done = () => showToast("Message copied to clipboard!", "success");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(box.value).then(done).catch(() => { document.execCommand('copy'); done(); });
    } else {
      document.execCommand('copy');
      done();
    }
    const copyBtn = document.getElementById('btn-copy-msg');
    if (copyBtn) copyBtn.textContent = "Copied! ✓";
  }
}

/**
 * View Student Details & Progress
 */
function viewStudentDetails(studentId) {
  const student = allStudents.find(s => s.id === studentId);
  if (!student) return;
  const totalLessons = APP_CONFIG.LESSONS_DATA.length;
  const percent = Math.round((student.completed_lessons / totalLessons) * 100);
  const isActive = student.status === 'active';

  const modalEl = document.getElementById('student-modal-body');
  if (!modalEl) return;
  modalEl.innerHTML = `
    <div class="admin-modal-head">
      <span class="admin-student-avatar lg">${escapeHtml(getInitials(student.full_name || student.email))}</span>
      <div>
        <h2>${escapeHtml(student.full_name || 'Student')}</h2>
        <div class="admin-muted">${escapeHtml(student.email)}</div>
      </div>
    </div>

    <dl class="admin-detail-grid">
      <div><dt>Access</dt><dd><span class="admin-status ${isActive ? 'is-active' : 'is-inactive'}">${isActive ? 'Active' : 'Inactive'}</span></dd></div>
      <div><dt>Device</dt><dd>${student.device_id ? 'Locked to 1 device' : 'Not used yet'}</dd></div>
      <div><dt>Progress</dt><dd>${student.completed_lessons} of ${totalLessons} lessons (${percent}%)</dd></div>
      <div><dt>Joined</dt><dd>${new Date(student.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
    </dl>

    <div class="admin-modal-actions">
      ${student.device_id ? `
        <button onclick="closeModal('student-detail-modal'); resetStudentDeviceLock('${student.id}');" class="btn btn-outline btn-sm">
          <span class="icon-inline">${ICONS.refresh}</span> Reset device
        </button>` : ''}
      ${isActive
        ? `<button onclick="closeModal('student-detail-modal'); toggleEnrollment('${student.id}', 'inactive');" class="btn btn-outline btn-sm admin-danger-outline">Deactivate access</button>`
        : `<button onclick="closeModal('student-detail-modal'); toggleEnrollment('${student.id}', 'active');" class="btn btn-primary btn-sm">Activate access</button>`
      }
    </div>
  `;
  openModal('student-detail-modal');
}

/**
 * Filter & Search Event Listeners
 */
function attachAdminEventListeners() {
  const overlay = document.getElementById('student-detail-modal');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal('student-detail-modal');
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal('student-detail-modal');
  });

  const searchInput = document.getElementById('admin-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderStudentTable();
    });
  }

  const pills = document.querySelectorAll('.admin-pills .pill-btn');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.getAttribute('data-filter') || 'all';
      renderStudentTable();
    });
  });
}


// =============================================================================
// LESSONS TAB: edit video + details for each lesson
// =============================================================================

async function loadAdminLessons() {
  await loadCourseLessons(true);
  renderAdminLessons();
}

function renderAdminLessons() {
  const list = document.getElementById('admin-lessons-list');
  if (!list) return;
  const lessons = APP_CONFIG.LESSONS_DATA;
  const withVideo = lessons.filter(l => isRealVideoId(l.wistiaId)).length;

  const summary = document.getElementById('lessons-video-summary');
  if (summary) {
    summary.textContent = `${withVideo} of ${lessons.length} videos added`;
    summary.classList.toggle('is-complete', withVideo === lessons.length);
  }

  list.innerHTML = '';
  lessons.forEach(lesson => {
    const hasVideo = isRealVideoId(lesson.wistiaId);
    const row = document.createElement('div');
    row.className = 'admin-lesson-row';
    row.innerHTML = `
      <div class="admin-lesson-thumb ${hasVideo ? 'has-video' : ''}">
        ${hasVideo
          ? `<img src="https://fast.wistia.com/embed/medias/${encodeURIComponent(lesson.wistiaId)}/swatch" alt="" loading="lazy" onerror="this.remove()">
             <span class="admin-lesson-play"><svg viewBox="0 0 24 24"><polygon points="7 4 20 12 7 20 7 4"></polygon></svg></span>`
          : `<span class="admin-lesson-num">${String(lesson.number).padStart(2, '0')}</span>`}
      </div>
      <div class="admin-lesson-info">
        <div class="admin-lesson-title">
          <span class="admin-muted">Lesson ${lesson.number}</span>
          <strong>${escapeHtml(lesson.title)}</strong>
        </div>
        <div class="admin-lesson-meta">
          <span>${escapeHtml(lesson.duration)}</span>
          ${hasVideo
            ? `<span class="admin-video-tag is-set"><i class="dot dot-green"></i>Video added</span>`
            : `<span class="admin-video-tag"><i class="dot dot-amber"></i>No video yet</span>`}
        </div>
      </div>
      <button class="${hasVideo ? 'admin-btn-ghost' : 'admin-btn-solid'}" onclick="openLessonEditor(${lesson.number})">
        ${hasVideo ? 'Edit' : 'Add video'}
      </button>
    `;
    list.appendChild(row);
  });
}

function openLessonEditor(lessonNumber) {
  const lesson = APP_CONFIG.LESSONS_DATA.find(l => l.number === lessonNumber);
  const modalEl = document.getElementById('student-modal-body');
  if (!lesson || !modalEl) return;
  const currentId = isRealVideoId(lesson.wistiaId) ? lesson.wistiaId : '';

  modalEl.innerHTML = `
    <div class="admin-modal-title">
      <span class="admin-muted">Lesson ${lesson.number}</span>
      <h2>Edit lesson</h2>
    </div>

    <form id="lesson-edit-form" class="admin-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="le-video">Wistia video</label>
        <input type="text" id="le-video" class="form-input" placeholder="Paste the Wistia link, embed code or video ID" value="${escapeHtml(currentId)}" autocomplete="off" spellcheck="false">
        <span class="form-help" id="le-video-help">In Wistia open the video, click <strong>Share</strong> and copy the link. A link, embed code or 10-character ID all work.</span>
      </div>

      <div class="admin-video-preview" id="le-preview"></div>

      <div class="admin-form-row">
        <div class="form-group">
          <label class="form-label" for="le-title">Title</label>
          <input type="text" id="le-title" class="form-input" value="${escapeHtml(lesson.title)}" required maxlength="140">
        </div>
        <div class="form-group admin-form-narrow">
          <label class="form-label" for="le-duration">Duration</label>
          <input type="text" id="le-duration" class="form-input" value="${escapeHtml(lesson.duration)}" placeholder="e.g. 25 mins" maxlength="20">
        </div>
      </div>

      <details class="admin-more">
        <summary>Description &amp; notes</summary>
        <div class="form-group">
          <label class="form-label" for="le-desc">Short description</label>
          <textarea id="le-desc" class="form-input" rows="3" maxlength="600">${escapeHtml(lesson.description)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="le-notes">Notes &amp; action steps</label>
          <textarea id="le-notes" class="form-input" rows="8">${escapeHtml(lesson.notes)}</textarea>
          <span class="form-help">Start a line with • to make it a bullet. A line starting with "• Action Step:" is highlighted.</span>
        </div>
      </details>

      <div class="admin-modal-actions">
        ${currentId ? `<button type="button" class="btn btn-outline btn-sm admin-danger-outline" id="le-remove">Remove video</button>` : ''}
        <span style="flex:1"></span>
        <button type="button" onclick="closeModal('student-detail-modal')" class="btn btn-outline btn-sm">Cancel</button>
        <button type="submit" id="le-save" class="btn btn-primary btn-sm">Save lesson</button>
      </div>
    </form>
  `;

  const videoInput = document.getElementById('le-video');
  const help = document.getElementById('le-video-help');
  const preview = document.getElementById('le-preview');
  const defaultHelp = help.innerHTML;

  const updatePreview = () => {
    const raw = videoInput.value.trim();
    const id = parseWistiaId(raw);
    videoInput.classList.toggle('is-invalid', Boolean(raw) && !id);
    if (raw && !id) {
      help.innerHTML = '<span class="admin-error-text">That doesn\'t look like a Wistia link or ID. Copy the link from Wistia\'s Share button.</span>';
      preview.innerHTML = '';
      return;
    }
    help.innerHTML = id ? `Video ID: <strong>${escapeHtml(id)}</strong>` : defaultHelp;
    if (!id) { preview.innerHTML = ''; return; }
    if (preview.dataset.id === id) return;
    preview.dataset.id = id;
    preview.innerHTML = `<iframe src="https://fast.wistia.net/embed/iframe/${encodeURIComponent(id)}?videoFoam=true" title="Video preview" allow="autoplay; fullscreen" frameborder="0"></iframe>`;
  };
  videoInput.addEventListener('input', updatePreview);
  updatePreview();

  const removeBtn = document.getElementById('le-remove');
  if (removeBtn) {
    removeBtn.onclick = () => {
      videoInput.value = '';
      preview.dataset.id = '';
      updatePreview();
      removeBtn.remove();
    };
  }

  document.getElementById('lesson-edit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveLesson(lessonNumber);
  });

  openModal('student-detail-modal');
  setTimeout(() => videoInput.focus(), 50);
}

async function saveLesson(lessonNumber) {
  const raw = document.getElementById('le-video').value.trim();
  const videoId = raw ? parseWistiaId(raw) : null;
  if (raw && !videoId) {
    showToast("Please paste a valid Wistia link or video ID.", "error");
    return;
  }
  const title = document.getElementById('le-title').value.trim();
  if (!title) {
    showToast("The lesson needs a title.", "error");
    return;
  }

  const fields = {
    title,
    duration: document.getElementById('le-duration').value.trim() || '—',
    description: document.getElementById('le-desc').value.trim() || title,
    notes: document.getElementById('le-notes').value.replace(/\r\n/g, '\n').trim(),
    // The database column is required, so "no video" is stored as the placeholder
    wistia_video_id: videoId || `WISTIA_VIDEO_ID_${lessonNumber}`
  };

  const saveBtn = document.getElementById('le-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const client = getSupabase();
  if (client) {
    const { data, error } = await client
      .from('lessons')
      .update(fields)
      .eq('course_id', APP_CONFIG.COURSE_ID)
      .eq('lesson_number', lessonNumber)
      .select('id');

    if (error || !data || !data.length) {
      console.error("Error saving lesson:", error);
      showToast(error ? `Could not save: ${error.message}` : "Could not save: lesson not found in the database.", "error", 7000);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save lesson';
      return;
    }
  } else {
    saveDemoLessonOverride(lessonNumber, fields);
  }

  closeModal('student-detail-modal');
  showToast(`Lesson ${lessonNumber} saved. Students will see the change right away.`, "success");
  await loadAdminLessons();
}
