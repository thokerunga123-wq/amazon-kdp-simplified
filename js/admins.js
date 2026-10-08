/**
 * Amazon KDP Simplified - Admins tab (up to 4 admins)
 * Load on admin.html right AFTER js/admin.js:
 *   <script src="js/admins.js"></script>
 * Needs the Supabase functions from admins-setup.sql.
 */
(function () {
  const MAX_ADMINS = 4;
  let admins = [];
  let myId = null;

  const esc = (v) => (typeof escapeHtml === 'function')
    ? escapeHtml(String(v ?? ''))
    : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const toast = (msg, type) => (typeof showToast === 'function') ? showToast(msg, type) : alert(msg);

  const initials = (name) => (typeof getInitials === 'function')
    ? getInitials(name)
    : String(name || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

  const cleanError = (err) => String(err?.message || err || 'Something went wrong')
    .replace(/^.*?ERROR:\s*/i, '');

  // ---------- Build the tab + panel ----------
  function injectUI() {
    if (document.getElementById('tab-admins')) return;

    const nav = document.querySelector('.admin-tabs');
    const main = document.querySelector('.admin-main');
    if (!nav || !main) return;

    const tab = document.createElement('button');
    tab.className = 'admin-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.dataset.tab = 'admins';
    tab.id = 'tab-admins';
    tab.innerHTML = `
      <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
      <span>Admins</span>`;
    nav.appendChild(tab);

    const panel = document.createElement('section');
    panel.id = 'panel-admins';
    panel.className = 'admin-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'tab-admins');
    panel.hidden = true;
    panel.innerHTML = `
      <div class="admin-page-head">
        <div>
          <h1>Admins</h1>
          <p>Up to ${MAX_ADMINS} people can manage students and lessons. Admins are not limited by the device lock.</p>
        </div>
      </div>

      <div class="admin-stats">
        <div class="admin-stat">
          <span class="admin-stat-label">Admin seats used</span>
          <span class="admin-stat-value" id="metric-admin-seats">–</span>
        </div>
      </div>

      <div class="admin-card" style="margin-bottom:20px;">
        <form id="add-admin-form" class="admin-toolbar" style="gap:12px;flex-wrap:wrap;align-items:center;">
          <div class="admin-search" style="flex:1;min-width:220px;">
            <input type="email" id="add-admin-email" placeholder="Email of the person to make admin" required autocomplete="off">
          </div>
          <button type="submit" class="btn btn-primary" id="add-admin-btn">Make admin</button>
        </form>
        <p id="add-admin-hint" style="margin:0;padding:0 20px 16px;font-size:0.85rem;opacity:0.75;">
          The person needs an account first. If they don't have one, add them on the Students tab, then come back here.
        </p>
      </div>

      <div class="admin-card">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Admin</th><th>Added</th><th>Actions</th></tr></thead>
            <tbody id="admins-table-body">
              <tr><td colspan="3">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>`;
    main.appendChild(panel);

    // Load the list whenever the panel is shown (by this script or by admin.js)
    new MutationObserver(() => { if (!panel.hidden) loadAdmins(); })
      .observe(panel, { attributes: true, attributeFilter: ['hidden'] });

    // Own tab handling, so it works even if admin.js set up tabs before this ran
    document.querySelectorAll('.admin-tab').forEach(t => {
      t.addEventListener('click', () => showPanel(t.dataset.tab));
    });

    document.getElementById('add-admin-form').addEventListener('submit', onAddAdmin);
  }

  function showPanel(name) {
    document.querySelectorAll('.admin-tab').forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.admin-panel').forEach(p => {
      p.hidden = p.id !== `panel-${name}`;
    });
    if (window.location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
  }

  // ---------- Data ----------
  async function loadAdmins() {
    const client = getSupabase();
    try {
      if (!myId) {
        const me = await getCurrentUser();
        myId = me?.id || null;
      }
      if (client) {
        const { data, error } = await client.rpc('list_admins');
        if (error) throw error;
        admins = data || [];
      } else {
        admins = (getDemoStudents() || []).filter(s => s.is_admin);
      }
      render();
    } catch (err) {
      console.error('Error loading admins:', err);
      const body = document.getElementById('admins-table-body');
      const missing = /list_admins|function|schema cache/i.test(cleanError(err));
      body.innerHTML = `<tr><td colspan="3">${missing
        ? 'Admin management is not set up yet. Run admins-setup.sql in Supabase, then refresh.'
        : esc(cleanError(err))}</td></tr>`;
    }
  }

  function render() {
    const body = document.getElementById('admins-table-body');
    const seats = document.getElementById('metric-admin-seats');
    const full = admins.length >= MAX_ADMINS;

    seats.textContent = `${admins.length} / ${MAX_ADMINS}`;
    document.getElementById('add-admin-btn').disabled = full;
    document.getElementById('add-admin-email').disabled = full;
    document.getElementById('add-admin-hint').textContent = full
      ? `All ${MAX_ADMINS} admin seats are used. Remove an admin to add someone new.`
      : "The person needs an account first. If they don't have one, add them on the Students tab, then come back here.";

    if (!admins.length) {
      body.innerHTML = '<tr><td colspan="3">No admins found.</td></tr>';
      return;
    }

    body.innerHTML = admins.map(a => {
      const isMe = a.id === myId;
      const name = (a.full_name || a.email || 'Admin').replace(/\s*\(admin\)\s*/i, '').trim();
      const added = a.created_at ? new Date(a.created_at).toLocaleDateString() : '—';
      const canRemove = !isMe && admins.length > 1;
      return `
        <tr>
          <td>
            <div class="admin-student">
              <span class="admin-student-avatar">${esc(initials(name))}</span>
              <div class="admin-student-text">
                <div class="admin-student-name">${esc(name)}${isMe ? ' <span class="admin-status is-active" style="margin-left:6px;">You</span>' : ''}</div>
                <div class="admin-student-email">${esc(a.email)}</div>
              </div>
            </div>
          </td>
          <td>${esc(added)}</td>
          <td>
            <div class="admin-row-actions">
              ${canRemove
                ? `<button class="admin-btn-ghost is-danger" data-remove-admin="${esc(a.id)}">Remove admin</button>`
                : `<span style="opacity:0.6;font-size:0.85rem;">${isMe ? 'Signed in' : 'Last admin'}</span>`}
            </div>
          </td>
        </tr>`;
    }).join('');

    body.querySelectorAll('[data-remove-admin]').forEach(btn => {
      btn.addEventListener('click', () => onRemoveAdmin(btn.dataset.removeAdmin));
    });
  }

  // ---------- Actions ----------
  async function onAddAdmin(e) {
    e.preventDefault();
    const input = document.getElementById('add-admin-email');
    const btn = document.getElementById('add-admin-btn');
    const email = input.value.trim();
    if (!email) return;

    if (admins.length >= MAX_ADMINS) {
      toast(`You already have ${MAX_ADMINS} admins.`, 'error');
      return;
    }
    if (!confirm(`Give ${email} full admin access? They will be able to manage students, lessons and other admins.`)) return;

    btn.disabled = true;
    try {
      const client = getSupabase();
      if (client) {
        const { error } = await client.rpc('add_admin', { target_email: email });
        if (error) throw error;
      } else {
        const list = getDemoStudents();
        const s = list.find(x => (x.email || '').toLowerCase() === email.toLowerCase());
        if (!s) throw new Error(`No account found for ${email}. Add them as a student first.`);
        if (s.is_admin) throw new Error(`${email} is already an admin.`);
        s.is_admin = true;
        saveDemoStudents(list);
      }
      input.value = '';
      toast(`${email} is now an admin`, 'success');
      await loadAdmins();
      if (typeof loadStudents === 'function') loadStudents();
    } catch (err) {
      console.error('Error adding admin:', err);
      toast(cleanError(err), 'error');
    } finally {
      btn.disabled = admins.length >= MAX_ADMINS;
    }
  }

  async function onRemoveAdmin(userId) {
    const a = admins.find(x => x.id === userId);
    if (!a) return;
    if (!confirm(`Remove admin access for ${a.email}? Their account stays, they just become a regular student.`)) return;

    try {
      const client = getSupabase();
      if (client) {
        const { error } = await client.rpc('remove_admin', { target_user_id: userId });
        if (error) throw error;
      } else {
        const list = getDemoStudents();
        const s = list.find(x => x.id === userId);
        if (s) s.is_admin = false;
        saveDemoStudents(list);
      }
      toast(`${a.email} is no longer an admin`, 'success');
      await loadAdmins();
      if (typeof loadStudents === 'function') loadStudents();
    } catch (err) {
      console.error('Error removing admin:', err);
      toast(cleanError(err), 'error');
    }
  }

  // ---------- Start ----------
  injectUI(); // runs before admin.js wires up its tabs on DOMContentLoaded
})();
