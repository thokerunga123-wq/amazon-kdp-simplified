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

  const adminNameEl = document.getElementById('admin-user-name');
  if (adminNameEl) {
    adminNameEl.textContent = adminUser.full_name || 'Administrator';
  }

  await loadStudents();
  attachAdminEventListeners();
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
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:3rem; color:var(--text-secondary-dark);">
          <div style="font-size:1.1rem; margin-bottom:0.5rem;">No students found.</div>
          <button onclick="openCreateStudentModal()" class="btn btn-primary btn-sm">
            Generate Student Credentials
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = '';

  filtered.forEach(student => {
    const row = document.createElement('tr');
    const percent = Math.round((student.completed_lessons / 10) * 100);
    const dateFormatted = new Date(student.created_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const isDeviceLocked = Boolean(student.device_id);

    row.innerHTML = `
      <td>
        <div style="font-weight:600; color:var(--text-white);">${escapeHtml(student.full_name)}</div>
        <div style="font-family:monospace; font-size:0.8rem; color:#888;">${escapeHtml(student.email)}</div>
      </td>
      <td>
        <span class="status-badge ${student.status}">
          ${student.status}
        </span>
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <div style="flex:1; max-width:70px; height:6px; background:#2A2A2A; border-radius:3px; overflow:hidden;">
            <div style="height:100%; width:${percent}%; background:var(--accent-yellow);"></div>
          </div>
          <span style="font-size:0.8rem; color:#A3A3A3;">${student.completed_lessons}/10</span>
        </div>
      </td>
      <td>
        ${isDeviceLocked
          ? `<div style="display:flex; align-items:center; gap:0.35rem; color:#6EE7B7; font-size:0.8rem;">
               <span class="icon-inline">${ICONS.lock}</span>
               <span>Locked to 1 Device</span>
             </div>
             <button onclick="resetStudentDeviceLock('${student.id}')" class="btn-text-action" title="Clear device lock so student can log in on a new device">
               Reset Device
             </button>`
          : `<div style="display:flex; align-items:center; gap:0.35rem; color:#FBBF24; font-size:0.8rem;">
               <span class="icon-inline">${ICONS.device}</span>
               <span>Unbound (Awaiting 1st login)</span>
             </div>`
        }
      </td>
      <td style="color:var(--text-muted-dark); font-size:0.8rem;">
        ${dateFormatted}
      </td>
      <td>
        <div style="display:flex; gap:0.4rem; justify-content:flex-end; flex-wrap:wrap;">
          ${student.status === 'active' 
            ? `<button onclick="toggleEnrollment('${student.id}', 'inactive')" class="btn btn-outline btn-sm" style="color:var(--status-error); border-color:var(--status-error-bg);">Deactivate</button>` 
            : `<button onclick="toggleEnrollment('${student.id}', 'active')" class="btn btn-primary btn-sm">Activate</button>`
          }
          <button onclick="viewStudentDetails('${student.id}')" class="btn btn-secondary btn-sm">Details</button>
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
  for (let i = 0; i < 6; i++) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
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
        Generate Student Credentials
      </h2>
      <p style="color:var(--text-secondary-dark); font-size:0.875rem;">
        Create unique login credentials for a student who paid on Selar. Their account will be locked to their first device.
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
          Save & Generate Access
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
      saveBtn.textContent = 'Save & Generate Access';
      return;
    }
  } else {
    // Demo Mode Storage
    const students = getDemoStudents();
    if (students.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      showToast("A student with this email already exists.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save & Generate Access';
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

  const modalEl = document.getElementById('student-modal-body');
  if (modalEl) {
    modalEl.innerHTML = `
      <div style="margin-bottom:1.5rem;">
        <h2 style="font-size:1.35rem; margin-bottom:0.25rem;">${escapeHtml(student.full_name)}</h2>
        <div style="color:var(--text-secondary-dark); font-size:0.9rem;">${escapeHtml(student.email)}</div>
        <div style="margin-top:0.5rem; display:flex; gap:0.5rem; align-items:center;">
          <span class="status-badge ${student.status}">${student.status}</span>
          ${student.device_id 
            ? '<span style="font-size:0.75rem; color:#6EE7B7;">🔒 Locked to 1 Device</span>' 
            : '<span style="font-size:0.75rem; color:#FBBF24;">📱 Unbound (Awaiting 1st login)</span>'
          }
        </div>
      </div>

      <div style="background:#141414; border:1px solid #2B2B2B; border-radius:8px; padding:1.25rem; margin-bottom:1.5rem;">
        <div style="font-weight:600; margin-bottom:0.5rem; color:var(--accent-yellow);">Course Completion:</div>
        <div style="font-size:1.2rem; font-weight:700; margin-bottom:0.35rem;">${student.completed_lessons} of 10 Lessons (${Math.round((student.completed_lessons/10)*100)}%)</div>
        <div style="font-size:0.8rem; color:#888;">Registered on: ${new Date(student.created_at).toLocaleString()}</div>
      </div>

      <div style="display:flex; justify-content:space-between; gap:0.75rem; flex-wrap:wrap;">
        ${student.device_id ? `
          <button onclick="resetStudentDeviceLock('${student.id}'); closeModal('student-detail-modal');" class="btn btn-outline btn-sm">
            <span class="icon-inline">${ICONS.refresh}</span> Reset Device Lock
          </button>
        ` : ''}

        ${student.status === 'active'
          ? `<button onclick="toggleEnrollment('${student.id}', 'inactive'); closeModal('student-detail-modal');" class="btn btn-outline btn-sm" style="color:var(--status-error);">Deactivate Access</button>`
          : `<button onclick="toggleEnrollment('${student.id}', 'active'); closeModal('student-detail-modal');" class="btn btn-primary btn-sm">Activate Access</button>`
        }
      </div>
    `;
    openModal('student-detail-modal');
  }
}

/**
 * Filter & Search Event Listeners
 */
function attachAdminEventListeners() {
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

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
