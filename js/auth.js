/**
 * Amazon KDP Simplified - Authentication, Device Limit & Session Guards
 * Instructor: Thokerunga Innocent
 */

let supabaseClient = null;

// Initialize Supabase Client
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (typeof supabase !== 'undefined' && isSupabaseConfigured()) {
    try {
      supabaseClient = supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      return supabaseClient;
    } catch (e) {
      console.warn("Failed to initialize Supabase client:", e);
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// DEVICE IDENTIFIER (one per browser)
// -----------------------------------------------------------------------------
function getLocalDeviceId() {
  let deviceId = null;
  try { deviceId = localStorage.getItem('kdp_device_uuid'); } catch (e) {}
  if (!deviceId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = 'dev_' + crypto.randomUUID();
    } else {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    }
    try { localStorage.setItem('kdp_device_uuid', deviceId); } catch (e) {}
  }
  return deviceId;
}

// -----------------------------------------------------------------------------
// DEMO / LOCAL STORAGE FALLBACK (For testing before live keys)
// -----------------------------------------------------------------------------
const DEMO_SESSION_KEY = 'kdp_demo_session';
const DEMO_STUDENTS_KEY = 'kdp_demo_students_db';

function getDemoStudents() {
  const raw = localStorage.getItem(DEMO_STUDENTS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  // Default demo student & admin
  const defaults = [
    {
      id: "demo-student-1",
      email: "student@example.com",
      password: "password123",
      full_name: "Demo Student",
      is_admin: false,
      enrollment_status: "active",
      device_ids: [], // Filled as the student logs in (up to MAX_DEVICES)
      created_at: new Date().toISOString()
    },
    {
      id: "demo-admin",
      email: "admin@example.com",
      password: "adminpassword",
      full_name: "Thokerunga Innocent (Admin)",
      is_admin: true,
      enrollment_status: "active",
      device_ids: [],
      created_at: new Date().toISOString()
    }
  ];
  localStorage.setItem(DEMO_STUDENTS_KEY, JSON.stringify(defaults));
  return defaults;
}

function saveDemoStudents(students) {
  localStorage.setItem(DEMO_STUDENTS_KEY, JSON.stringify(students));
}

function getDemoSession() {
  const raw = localStorage.getItem(DEMO_SESSION_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  return null;
}

function setDemoSession(user) {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
}

function clearDemoSession() {
  localStorage.removeItem(DEMO_SESSION_KEY);
}

// -----------------------------------------------------------------------------
// AUTHENTICATION LOGIC WITH DEVICE LIMIT (max devices per student)
// -----------------------------------------------------------------------------
const DEVICE_LOCK_MESSAGE = `DEVICE LOCK: This account is already being used on ${(typeof APP_CONFIG !== 'undefined' && APP_CONFIG.MAX_DEVICES) || 3} devices, which is the maximum. Please contact the instructor on WhatsApp to reset your devices.`;

/** A student's registered devices (works before and after the 3-device database upgrade) */
function getDeviceList(record) {
  if (!record) return [];
  if (Array.isArray(record.device_ids)) return record.device_ids.filter(Boolean);
  return record.device_id ? [record.device_id] : [];
}

/**
 * Log in student and bind/validate device lock
 */
async function loginUser(email, password) {
  const currentDeviceId = getLocalDeviceId();
  const client = getSupabase();

  if (!client && isSupabaseConfigured()) {
    // Live keys are set but the Supabase library failed to load: never fall back to demo accounts
    throw new Error("The login service could not load. Please check your internet connection and refresh the page.");
  }

  if (client) {
    // 1. Authenticate with Supabase Auth
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;

    const user = data.user;

    // 2. Enforce the device limit on the server (secure RPC, cannot be bypassed
    //    from the browser). Adds new devices until the limit, then rejects extras.
    const { data: lockStatus, error: lockErr } = await client.rpc('bind_device', {
      p_device_id: currentDeviceId
    });

    if (lockErr) {
      await client.auth.signOut();
      console.error("Device lock check failed:", lockErr);
      throw new Error("Could not verify your device. Please try again, or contact the instructor on WhatsApp if this keeps happening.");
    }

    if (lockStatus === 'mismatch') {
      // Device mismatch! Reject login and sign out
      await client.auth.signOut();
      throw new Error(DEVICE_LOCK_MESSAGE);
    }

    return { user, session: data.session, isLive: true };
  } else {
    // Demo Mode Logic
    const students = getDemoStudents();
    const student = students.find(s => s.email.toLowerCase() === email.toLowerCase());

    if (!student) {
      throw new Error("Invalid email or student credentials.");
    }
    if (student.password && student.password !== password) {
      throw new Error("Incorrect password. Please verify.");
    }

    // Enforce device limit for students
    if (!student.is_admin) {
      const devices = getDeviceList(student);
      if (!devices.includes(currentDeviceId)) {
        if (devices.length >= (APP_CONFIG.MAX_DEVICES || 3)) {
          throw new Error(DEVICE_LOCK_MESSAGE);
        }
        student.device_ids = devices.concat(currentDeviceId);
        delete student.device_id;
        saveDemoStudents(students);
      }
    }

    setDemoSession(student);
    return { user: student, session: { user: student }, isLive: false };
  }
}

/**
 * Log out
 */
async function logoutUser() {
  const client = getSupabase();
  if (client) {
    await client.auth.signOut();
  }
  clearDemoSession();
  window.location.href = 'index.html';
}

/**
 * Get current authenticated user
 */
async function getCurrentUser() {
  const client = getSupabase();
  if (!client && isSupabaseConfigured()) return null;

  if (client) {
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session || !session.user) return null;

    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    // Session copied to / still alive on a different device -> kick it out
    const profileDevices = getDeviceList(profile);
    if (profile && !profile.is_admin && profileDevices.length && !profileDevices.includes(getLocalDeviceId())) {
      await client.auth.signOut();
      return null;
    }

    const { data: enrollment } = await client
      .from('enrollments')
      .select('status')
      .eq('user_id', session.user.id)
      .eq('course_id', APP_CONFIG.COURSE_ID)
      .maybeSingle();

    return {
      id: session.user.id,
      email: session.user.email,
      full_name: profile?.full_name || 'Student',
      is_admin: profile?.is_admin || false,
      device_ids: profileDevices,
      enrollment_status: enrollment?.status || 'inactive',
      raw_user: session.user
    };
  } else {
    const demo = getDemoSession();
    if (!demo) return null;
    // Always read the latest record so admin changes (deactivate, device reset) apply immediately
    const fresh = getDemoStudents().find(s => s.id === demo.id);
    if (!fresh) { clearDemoSession(); return null; }
    const freshDevices = getDeviceList(fresh);
    if (!fresh.is_admin && freshDevices.length && !freshDevices.includes(getLocalDeviceId())) {
      clearDemoSession();
      return null;
    }
    return fresh;
  }
}

/**
 * Update student password
 */
async function updatePassword(newPassword) {
  const client = getSupabase();
  if (!client && isSupabaseConfigured()) throw new Error("The login service could not load. Please refresh the page.");
  if (client) {
    const { data, error } = await client.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    return data;
  } else {
    const demo = getDemoSession();
    if (demo) {
      demo.password = newPassword;
      setDemoSession(demo);
      const students = getDemoStudents();
      const match = students.find(s => s.id === demo.id);
      if (match) {
        match.password = newPassword;
        saveDemoStudents(students);
      }
    }
    return { message: "Password updated." };
  }
}

/**
 * Request password reset
 */
async function requestPasswordReset(email) {
  const client = getSupabase();
  if (!client && isSupabaseConfigured()) throw new Error("The login service could not load. Please refresh the page.");
  if (client) {
    const { data, error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/forgot-password.html?type=recovery'
    });
    if (error) throw error;
    return data;
  } else {
    return { message: "Reset email dispatched." };
  }
}

// -----------------------------------------------------------------------------
// ROUTE GUARDS
// -----------------------------------------------------------------------------
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

async function requireCourseAccess() {
  const user = await requireAuth();
  if (!user) return null;

  if (user.is_admin) return user;

  if (user.enrollment_status !== 'active') {
    window.location.href = 'dashboard.html?notice=inactive';
    return null;
  }

  return user;
}

async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return null;

  if (!user.is_admin) {
    window.location.href = 'dashboard.html';
    return null;
  }

  return user;
}

// -----------------------------------------------------------------------------
// DYNAMIC NAVIGATION BAR
// -----------------------------------------------------------------------------
async function updateNavAuthUI() {
  const user = await getCurrentUser();
  const containers = document.querySelectorAll('.nav-actions, .mobile-nav-actions');

  containers.forEach(container => {
    if (!container) return;

    if (user) {
      const shieldIcon = typeof ICONS !== 'undefined' ? ICONS.shield : '';
      const bookIcon = typeof ICONS !== 'undefined' ? ICONS.book : '';
      const userIcon = typeof ICONS !== 'undefined' ? ICONS.user : '';

      container.innerHTML = `
        ${user.is_admin ? `<a href="admin.html" class="nav-link" style="color:var(--accent-yellow); font-weight:700;"><span class="icon-inline">${shieldIcon}</span> Admin Panel</a>` : ''}
        <a href="dashboard.html" class="nav-link"><span class="icon-inline">${bookIcon}</span> Dashboard</a>
        <a href="profile.html" class="btn btn-outline btn-sm"><span class="icon-inline">${userIcon}</span> Profile</a>
        <button onclick="logoutUser()" class="btn btn-secondary btn-sm">Log Out</button>
      `;
    } else {
      // Clean guest actions: Just Enroll on Selar
      container.innerHTML = `
        <a href="${APP_CONFIG.SELAR_CHECKOUT_URL}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm btn-enroll">
          Enroll on Selar
        </a>
      `;
    }
  });
}

/**
 * Visible warning while Supabase keys are not set. In Demo Mode accounts only
 * exist inside the current browser, so students cannot log in from their own devices.
 */
function showDemoModeBanner() {
  if (document.getElementById('demo-mode-banner')) return;
  if (isSupabaseConfigured()) {
    if (typeof supabase === 'undefined') {
      const warn = document.createElement('div');
      warn.id = 'demo-mode-banner';
      warn.className = 'demo-mode-banner';
      warn.innerHTML = '<strong>Connection problem:</strong> The login service could not load. Please check your internet connection and refresh the page.';
      document.body.prepend(warn);
    }
    return;
  }
  const banner = document.createElement('div');
  banner.id = 'demo-mode-banner';
  banner.className = 'demo-mode-banner';
  banner.innerHTML = '<strong>Demo Mode:</strong> Supabase is not connected yet. Logins and students only exist in this browser. Add your Supabase URL and anon key in <code>js/config.js</code> to go live.';
  document.body.prepend(banner);
}

document.addEventListener('DOMContentLoaded', () => {
  showDemoModeBanner();
  updateNavAuthUI();
});
