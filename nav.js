// nav.js — shared navigation component
// IMPORTANT: nav.js never manages auth on pages that have their own auth.
// Pages call window.fnSetAuth(member, hasSessions) after their own auth resolves.
// On non-auth pages (sessions, articles) a single passive check runs — no listeners.

(function() {

const SUPABASE_URL  = 'https://ldlvzkjdbsabwyubdtly.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbHZ6a2pkYnNhYnd5dWJkdGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzI2OTgsImV4cCI6MjA5MDY0ODY5OH0.s3WFwMZRoSzeKVLQwPGnJCU4VtaSJ3KWUJfpo0i6m8c';

// Pages that manage auth themselves — nav.js stays completely passive here
const SELF_AUTH_PAGES = ['/', '/index.html', '/portal.html', '/auth.html', '/reset-password.html'];
const isSelfAuthPage = SELF_AUTH_PAGES.includes(window.location.pathname);

// ── CSS ───────────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  #fundees-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 200;
    height: 64px; background: rgba(10,22,40,0.97);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; padding: 0 1.5rem; gap: 0;
  }
  #fundees-nav .fn-brand {
    display: flex; align-items: center; gap: 0.65rem;
    text-decoration: none; flex-shrink: 0; margin-right: 1.5rem;
  }
  #fundees-nav .fn-brand img { height: 34px; opacity: 0.9; }
  #fundees-nav .fn-brand-text {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 700;
    font-size: 0.9rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: #F0EDE6; line-height: 1.1;
  }
  #fundees-nav .fn-brand-text span { display: block; font-size: 0.5rem; letter-spacing: 0.2em; color: #00CFAD; }
  #fundees-nav .fn-links {
    display: flex; align-items: center; gap: 1.1rem;
    list-style: none; margin: 0; padding: 0; flex: 1;
  }
  #fundees-nav .fn-links li { display: list-item; }
  #fundees-nav .fn-links a, #fundees-nav .fn-links button {
    color: rgba(240,237,230,0.55); text-decoration: none;
    font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase;
    font-weight: 500; font-family: 'Barlow Condensed', sans-serif;
    transition: color 0.15s; white-space: nowrap; background: none; border: none; cursor: pointer; padding: 0;
  }
  #fundees-nav .fn-links a:hover, #fundees-nav .fn-links button:hover { color: #00CFAD; }
  #fundees-nav .fn-links a.fn-active { color: #F0EDE6; }
  #fundees-nav .fn-cta { background: #00CFAD !important; color: #0A1628 !important; padding: 0.4rem 1rem; border-radius: 2px; font-weight: 700 !important; }
  #fundees-nav .fn-cta:hover { background: #00e8c0 !important; color: #0A1628 !important; }
  #fundees-nav .fn-logout-btn { background: #FF5C3A !important; color: white !important; padding: 0.4rem 1rem; border-radius: 2px; font-weight: 700 !important; }
  #fundees-nav .fn-hb { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 0.5rem; margin-left: auto; background: none; border: none; flex-shrink: 0; }
  #fundees-nav .fn-hb span { display: block; width: 22px; height: 2px; background: rgba(240,237,230,0.7); border-radius: 1px; transition: all 0.25s; }
  #fundees-mob-menu { display: none; position: fixed; top: 64px; left: 0; right: 0; background: rgba(7,16,30,0.99); border-bottom: 1px solid rgba(255,255,255,0.07); z-index: 199; flex-direction: column; padding: 0.5rem 0 1rem; max-height: calc(100vh - 64px); overflow-y: auto; }
  #fundees-mob-menu.fn-open { display: flex; }
  #fundees-mob-menu a, #fundees-mob-menu button { display: block; padding: 0.9rem 1.5rem; color: rgba(240,237,230,0.7); text-decoration: none; font-size: 1rem; font-family: 'Barlow', sans-serif; border: none; border-bottom: 1px solid rgba(255,255,255,0.05); background: none; text-align: left; cursor: pointer; width: 100%; }
  #fundees-mob-menu a:active, #fundees-mob-menu button:active { background: rgba(0,207,173,0.08); }
  #fundees-mob-menu .fn-mob-cta { margin: 0.75rem 1.5rem 0; background: #00CFAD !important; color: #0A1628 !important; text-align: center; padding: 0.85rem !important; border-radius: 2px; font-weight: 600; border: none !important; display: block; width: calc(100% - 3rem); }
  #fundees-mob-menu .fn-mob-logout { margin: 0.5rem 1.5rem 0; background: #FF5C3A !important; color: white !important; text-align: center; padding: 0.85rem !important; border-radius: 2px; font-weight: 600; display: block; width: calc(100% - 3rem); border: none !important; }
  @media (max-width: 900px) { #fundees-nav .fn-links { display: none !important; } #fundees-nav .fn-hb { display: flex; } }
  @media (min-width: 901px) { #fundees-nav .fn-hb { display: none !important; } }
`;
document.head.appendChild(style);

// ── HTML ──────────────────────────────────────────────────────────────────
const path = window.location.pathname;
function isActive(href) {
  if (href === '/' || href === '/index.html') return (path === '/' || path === '/index.html') ? 'fn-active' : '';
  return path.startsWith(href) ? 'fn-active' : '';
}

const navEl = document.createElement('nav');
navEl.id = 'fundees-nav';
navEl.innerHTML = `
  <a href="/" class="fn-brand">
    <img src="/logo-white.png" alt="Spearfishing FUNdamentals">
    <div class="fn-brand-text">Spearfishing<span>FUNdamentals</span></div>
  </a>
  <ul class="fn-links" id="fn-links">
    <li><a href="/" class="${isActive('/')}">Home</a></li>
    <li><a href="/sessions.html" class="${isActive('/sessions')}">Enrol</a></li>
    <li><a href="/?page=courses">Courses</a></li>
    <li><a href="/?page=inspiration">Inspiration</a></li>
    <li><a href="/articles.html" class="${isActive('/articles')}">Articles</a></li>
    <li class="fn-my-sessions" style="display:none"><a href="/?page=my-sessions">My Sessions</a></li>
    <li class="fn-guest"><a href="/auth.html" class="${isActive('/auth')}">Sign In</a></li>
    <li class="fn-guest"><a href="/auth.html?tab=signup" class="fn-cta">Join Now</a></li>
    <li class="fn-user" style="display:none"><a href="/portal.html" class="${isActive('/portal')}">My Account</a></li>
    <li class="fn-admin" style="display:none"><a href="/admin.html" class="${isActive('/admin')}">Admin</a></li>
    <li class="fn-lead" style="display:none"><a href="/session-plan.html" class="${isActive('/session-plan')}">Session Plans</a></li>
    <li class="fn-user" style="display:none"><button class="fn-logout-btn" onclick="fnLogout()">Log Out</button></li>
  </ul>
  <button class="fn-hb" id="fn-hb" onclick="fnToggleMenu()" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
`;
document.body.insertBefore(navEl, document.body.firstChild);

const mobEl = document.createElement('div');
mobEl.id = 'fundees-mob-menu';
mobEl.innerHTML = `
  <a href="/">Home</a>
  <a href="/sessions.html">Enrol</a>
  <a href="/?page=courses">Courses</a>
  <a href="/?page=inspiration">Inspiration</a>
  <a href="/articles.html">Articles</a>
  <a class="fn-mob-my-sessions" href="/?page=my-sessions" style="display:none">My Sessions</a>
  <a class="fn-mob-guest" href="/auth.html">Sign In</a>
  <a class="fn-mob-guest fn-mob-cta" href="/auth.html?tab=signup">Join Now</a>
  <a class="fn-mob-user" href="/portal.html" style="display:none">My Account</a>
  <a class="fn-mob-admin" href="/admin.html" style="display:none">Admin</a>
  <a class="fn-mob-lead" href="/session-plan.html" style="display:none">Session Plans</a>
  <button class="fn-mob-user fn-mob-logout" onclick="fnLogout()" style="display:none">Log Out</button>
`;
document.body.insertBefore(mobEl, navEl.nextSibling);

// ── HAMBURGER ─────────────────────────────────────────────────────────────
window.fnToggleMenu = function() { mobEl.classList.toggle('fn-open'); };
document.addEventListener('click', function(e) {
  if (!navEl.contains(e.target) && !mobEl.contains(e.target)) mobEl.classList.remove('fn-open');
});

// ── PUBLIC: pages call this after their own auth resolves ─────────────────
window.fnSetAuth = function(member, hasSessions) {
  const loggedIn = !!member;
  const isAdmin  = !!member?.is_admin;
  const isLead   = isAdmin || !!member?.is_qualified_lead;

  document.querySelectorAll('#fn-links .fn-guest').forEach(el    => el.style.display = loggedIn    ? 'none' : 'list-item');
  document.querySelectorAll('#fn-links .fn-user').forEach(el     => el.style.display = loggedIn    ? 'list-item' : 'none');
  document.querySelectorAll('#fn-links .fn-admin').forEach(el    => el.style.display = isAdmin     ? 'list-item' : 'none');
  document.querySelectorAll('#fn-links .fn-lead').forEach(el     => el.style.display = isLead      ? 'list-item' : 'none');
  document.querySelectorAll('#fn-links .fn-my-sessions').forEach(el => el.style.display = hasSessions ? 'list-item' : 'none');
  document.querySelectorAll('.fn-mob-guest').forEach(el          => el.style.display = loggedIn    ? 'none'  : 'block');
  document.querySelectorAll('.fn-mob-user').forEach(el           => el.style.display = loggedIn    ? 'block' : 'none');
  document.querySelectorAll('.fn-mob-admin').forEach(el          => el.style.display = isAdmin     ? 'block' : 'none');
  document.querySelectorAll('.fn-mob-lead').forEach(el           => el.style.display = isLead      ? 'block' : 'none');
  document.querySelectorAll('.fn-mob-my-sessions').forEach(el    => el.style.display = hasSessions ? 'block' : 'none');
};

// ── LOGOUT — use page's own sb if available ───────────────────────────────
window.fnLogout = async function() {
  const client = window.sb || supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  await client.auth.signOut();
  window.location.href = '/';
};

// ── PASSIVE CHECK — only on pages without their own auth ──────────────────
if (!isSelfAuthPage) {
  async function fnPassiveAuth() {
    if (typeof supabase === 'undefined') { setTimeout(fnPassiveAuth, 50); return; }
    try {
      const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user) { window.fnSetAuth(null, false); return; }
      const { data: member } = await client.from('members').select('*').eq('auth_user_id', session.user.id).maybeSingle();
      let hasSessions = false;
      if (member?.id) {
        const { data: enrs } = await client.from('enrolments').select('id').eq('member_id', member.id).in('status', ['enrolled','pending_payment']).limit(1);
        hasSessions = !!(enrs?.length);
      }
      window.fnSetAuth(member || null, hasSessions);
    } catch(e) { console.warn('[nav.js] passive auth failed:', e.message); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fnPassiveAuth);
  else fnPassiveAuth();
}

})();
