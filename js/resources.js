/**
 * Amazon KDP Simplified - Course resources
 * Book Formatter Pro download that always points to the newest app release
 * on GitHub (tags starting with "app-v" that include a *-setup.exe file).
 * Publish a new release on GitHub and students get it automatically.
 */
(function () {
  const REPO = 'thokerunga123-wq/bookformatterpro-plugins';
  const FALLBACK_URL = `https://github.com/${REPO}/releases?q=app-v&expanded=true`;
  const CACHE_KEY = 'kdp_bfp_latest_v1';
  const CACHE_MS = 10 * 60 * 1000; // re-check GitHub every 10 minutes

  function formatSize(bytes) {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  async function fetchLatest() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
    } catch (e) {}

    // The repo also has plugin releases, so look through up to 3 pages for the newest app release
    for (let page = 1; page <= 3; page++) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const releases = await res.json();
    if (!Array.isArray(releases) || !releases.length) break;

    for (const rel of releases) {
      if (rel.draft || rel.prerelease || !/^app-v/i.test(rel.tag_name || '')) continue;
      const asset = (rel.assets || []).find(a => /-setup\.exe$/i.test(a.name));
      if (!asset) continue;
      const data = {
        version: String(rel.tag_name).replace(/^app-v/i, ''),
        url: asset.browser_download_url,
        name: asset.name,
        size: asset.size,
        date: rel.published_at
      };
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data })); } catch (e) {}
      return data;
    }
    if (releases.length < 100) break;
    }
    throw new Error('No setup file found');
  }

  async function renderBookFormatterResources() {
    const cards = document.querySelectorAll('[data-resource="bookformatter"]');
    if (!cards.length) return;

    let info = null;
    try { info = await fetchLatest(); } catch (e) { console.warn('Book Formatter Pro release lookup failed:', e); }

    cards.forEach(card => {
      const meta = card.querySelector('[data-res-meta]');
      const btn = card.querySelector('[data-res-download]');
      if (info) {
        btn.href = info.url;
        btn.setAttribute('download', info.name);
        btn.removeAttribute('target');
        btn.querySelector('[data-res-label]').textContent = `Download v${info.version}`;
        meta.textContent = ['Version ' + info.version, 'Windows', formatSize(info.size), info.date ? 'Updated ' + formatDate(info.date) : '']
          .filter(Boolean).join(' \u00B7 ');
      } else {
        btn.href = FALLBACK_URL;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.querySelector('[data-res-label]').textContent = 'Download';
        meta.textContent = 'Windows \u00B7 Latest version';
      }
      btn.classList.remove('is-loading');
    });
  }

  window.renderBookFormatterResources = renderBookFormatterResources;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderBookFormatterResources);
  } else {
    renderBookFormatterResources();
  }
})();
