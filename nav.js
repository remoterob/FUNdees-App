// nav.js — shared navigation component for all pages
// Include this script on every page AFTER supabase is loaded.
// Usage: <script src="/nav.js"></script>
// The script injects the nav HTML, mobile menu, and shared CSS,
// then renders auth-aware items based on the current user.

(function() {

const SUPABASE_URL  = 'https://ldlvzkjdbsabwyubdtly.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbHZ6a2pkYnNhYnd5dWJkdGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzI2OTgsImV4cCI6MjA5MDY0ODY5OH0.s3WFwMZRoSzeKVLQwPGnJCU4VtaSJ3KWUJfpo0i6m8c';

// ── CSS ───────────────────────────────────────────────────────────────────
const css = `
  #fundees-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 200;
    height: 64px; background: rgba(10,22,40,0.97);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center;
    padding: 0 1.5rem; gap: 0;
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
  #fundees-nav .fn-brand-text span {
    display: block; font-size: 0.5rem; letter-spacing: 0.2em; color: #00CFAD;
  }
  #fundees-nav .fn-links {
    display: flex; align-items: center; gap: 1.1rem;
    list-style: none; margin: 0; padding: 0; flex: 1;
  }
  #fundees-nav .fn-links a {
    color: rgba(240,237,230,0.55); text-decoration: none;
    font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase;
    font-weight: 500; font-family: 'Barlow Condensed', sans-serif;
    transition: color 0.15s; white-space: nowrap;
  }
  #fundees-nav .fn-links a:hover { color: #00CFAD; }
  #fundees-nav .fn-links a.fn-active { color: #F0EDE6; }
  #fundees-nav .fn-cta {
    background: #00CFAD !important; color: #0A1628 !important;
    padding: 0.4rem 1rem; border-radius: 2px; font-weight: 700 !important;
  }
  #fundees-nav .fn-cta:hover { background: #00e8c0 !important; }
  #fundees-nav .fn-logout {
    background: #FF5C3A !important; color: white !important;
    padding: 0.4rem 1rem; border-radius: 2px; font-weight: 700 !important;
    cursor: pointer; border: none;
    font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase;
    font-family: 'Barlow Condensed', sans-serif;
  }
  #fundees-nav .fn-hb {
    display: none; flex-direction: column; gap: 5px;
    cursor: pointer; padding: 0.5rem; margin-left: 0.5rem;
    background: none; border: none;
  }
  #fundees-nav .fn-hb span {
    display: block; width: 22px; height: 2px;
    background: rgba(240,237,230,0.7); border-radius: 1px;
    transition: all 0.25s;
  }
  #fundees-mob-menu {
    display: none; position: fixed; top: 64px; left: 0; right: 0;
    background: rgba(7,16,30,0.99); border-bottom: 1px solid rgba(255,255,255,0.07);
    z-index: 199; flex-direction: column; padding: 0.5rem 0 1rem;
    max-height: calc(100vh - 64px); overflow-y: auto;
  }
  #fundees-mob-menu.open { display: flex; }
  #fundees-mob-menu a, #fundees-mob-menu button {
    display: block; padding: 0.9rem 1.5rem;
    color: rgba(240,237,230,0.7); text-decoration: none;
    font-size: 1rem; font-family: 'Barlow', sans-serif;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: none; border-left: none; border-right: none; border-top: none;
    text-align: left; cursor: pointer; width: 100%;
  }
  #fundees-mob-menu a:active, #fundees-mob-menu button:active {
    background: rgba(0,207,173,0.08);
  }
  #fundees-mob-menu .fn-mob-cta {
    margin: 0.75rem 1.5rem 0; background: #00CFAD; color: #0A1628 !important;
    text-align: center; padding: 0.85rem !important; border-radius: 2px;
    font-weight: 600; border: none; display: block; width: calc(100% - 3rem);
  }
  #fundees-mob-menu .fn-mob-logout {
    margin: 0.5rem 1.5rem 0; background: #FF5C3A; color: white !important;
    text-align: center; padding: 0.85rem !important; border-radius: 2px;
    font-weight: 600; border: none; display: block; width: calc(100% - 3rem);
  }
  @media (max-width: 768px) {
    #fundees-nav .fn-links { display: none; }
    #fundees-nav .fn-hb { display: flex; margin-left: auto; }
  }
  @media (min-width: 769px) {
    #fundees-nav .fn-hb { display: none; }
  }
`;

// ── INJECT CSS ─────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

// ── INJECT HTML ────────────────────────────────────────────────────────────
// Detect current page for active link highlighting
const path = window.location.pathname;

function isActive(href) {
  if (href === '/' || href === '/index.html') return path === '/' || path === '/index.html' ? 'fn-active' : '';
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
    <li><a href="/?page=courses" class="${path==='/'&&location.search.includes('page=courses')?'fn-active':''}">Courses</a></li>
    <li><a href="/articles.html" class="${isActive('/articles')}">Articles</a></li>
    <li class="fn-my-sessions" style="display:none"><a href="/?page=my-sessions">My Sessions</a></li>
    <li><a href="https://fishbingo.netlify.app/" target="_blank">Fish Bingo</a></li>
    <li class="fn-guest"><a href="/auth.html" class="${isActive('/auth')}">Sign In</a></li>
    <li class="fn-guest"><a href="/auth.html?tab=signup" class="fn-cta">Join Now</a></li>
    <li class="fn-user" style="display:none"><a href="/portal.html" class="${isActive('/portal')}">My Account</a></li>
    <li class="fn-admin" style="display:none"><a href="/admin.html" class="${isActive('/admin')}">Admin</a></li>
    <li class="fn-lead" style="display:none"><a href="/session-plan.html" class="${isActive('/session-plan')}">Session Plans</a></li>
    <li class="fn-user" style="display:none"><button class="fn-logout" onclick="fnLogout()">Log Out</button></li>
  </ul>
  <button class="fn-hb" id="fn-hb" onclick="fnToggleMenu()" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
`;
document.body.insertBefore(navEl, document.body.firstChild);

// Mobile menu
const mobEl = document.createElement('div');
mobEl.id = 'fundees-mob-menu';
mobEl.innerHTML = `
  <a href="/">Home</a>
  <a href="/sessions.html">Enrol</a>
  <a href="/?page=courses">Courses</a>
  <a href="/articles.html">Articles</a>
  <a class="fn-mob-my-sessions" href="/?page=my-sessions" style="display:none">My Sessions</a>
  <a href="https://fishbingo.netlify.app/" target="_blank">Fish Bingo</a>
  <a class="fn-mob-guest" href="/auth.html">Sign In</a>
  <a class="fn-mob-guest fn-mob-cta" href="/auth.html?tab=signup">Join Now</a>
  <a class="fn-mob-user" href="/portal.html" style="display:none">My Account</a>
  <a class="fn-mob-admin" href="/admin.html" style="display:none">Admin</a>
  <a class="fn-mob-lead" href="/session-plan.html" style="display:none">Session Plans</a>
  <button class="fn-mob-user fn-mob-logout" onclick="fnLogout()" style="display:none">Log Out</button>
`;
document.body.insertBefore(mobEl, navEl.nextSibling);

// ── HAMBURGER ──────────────────────────────────────────────────────────────
window.fnToggleMenu = function() {
  mobEl.classList.toggle('open');
};

// Close menu on outside click
document.addEventListener('click', function(e) {
  if (!navEl.contains(e.target) && !mobEl.contains(e.target)) {
    mobEl.classList.remove('open');
  }
});

// ── AUTH RENDERING ─────────────────────────────────────────────────────────
async function fnRenderAuth(member) {
  const loggedIn = !!member;
  const isAdmin  = !!member?.is_admin;
  const isLead   = isAdmin || !!member?.is_qualified_lead;

  // Desktop
  document.querySelectorAll('#fn-links .fn-guest').forEach(el => el.style.display = loggedIn ? 'none' : 'flex');
  document.querySelectorAll('#fn-links .fn-user').forEach(el  => el.style.display = loggedIn ? 'flex' : 'none');
  document.querySelectorAll('#fn-links .fn-admin').forEach(el => el.style.display = isAdmin  ? 'flex' : 'none');
  document.querySelectorAll('#fn-links .fn-lead').forEach(el  => el.style.display = isLead   ? 'flex' : 'none');

  // Mobile
  document.querySelectorAll('.fn-mob-guest').forEach(el  => el.style.display = loggedIn ? 'none'  : 'block');
  document.querySelectorAll('.fn-mob-user').forEach(el   => el.style.display = loggedIn ? 'block' : 'none');
  document.querySelectorAll('.fn-mob-admin').forEach(el  => el.style.display = isAdmin  ? 'block' : 'none');
  document.querySelectorAll('.fn-mob-lead').forEach(el   => el.style.display = isLead   ? 'block' : 'none');

  // My Sessions — only if enrolled
  if (member) {
    const sb2 = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data: enrs } = await sb2.from('enrolments')
      .select('id').eq('member_id', member.id)
      .in('status', ['enrolled','pending_payment']).limit(1);
    const hasSessions = !!(enrs && enrs.length);
    document.querySelectorAll('.fn-my-sessions').forEach(el  => el.style.display = hasSessions ? 'flex'  : 'none');
    document.querySelectorAll('.fn-mob-my-sessions').forEach(el => el.style.display = hasSessions ? 'block' : 'none');
  }
}

// ── LOGOUT ────────────────────────────────────────────────────────────────
window.fnLogout = async function() {
  const sb2 = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  await sb2.auth.signOut();
  window.location.href = '/';
};

// ── INIT ──────────────────────────────────────────────────────────────────
async function fnInit() {
  // Wait for supabase to be available
  if (typeof supabase === 'undefined') {
    setTimeout(fnInit, 50); return;
  }
  const sb2 = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data: { session } } = await sb2.auth.getSession();

  let member = null;
  if (session?.user) {
    const { data } = await sb2.from('members').select('*')
      .eq('auth_user_id', session.user.id).maybeSingle();
    member = data || null;
  }

  fnRenderAuth(member);

  sb2.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      fnRenderAuth(null);
    } else if (event === 'SIGNED_IN' && session?.user) {
      const { data } = await sb2.from('members').select('*')
        .eq('auth_user_id', session.user.id).maybeSingle();
      fnRenderAuth(data || null);
    }
  });
}

// Run after DOM + supabase are ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fnInit);
} else {
  fnInit();
}

})();
