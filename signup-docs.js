// signup-docs.js — shows a session's sign-up document and collects a signature.
//
// Two ways in, one modal:
//  • On page load, anyone enrolled in a current session whose document they
//    haven't signed gets a popup they can't close: they sign or log out.
//  • sessions.html calls window.fnRequireSignupDoc(session) before checkout.
//
// Load this after supabase-js and let the page's own script define `sb`.
// Not loaded on auth.html / reset-password.html, so it can't get in the way of
// signing in or resetting a password. The check is skipped on any lookup error:
// a database problem shouldn't lock members out of the whole app, and
// create-enrolment-checkout enforces the signature for new enrolments anyway.

(function() {

const BUCKET = 'Fundees';
const PDFJS  = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build';

const style = document.createElement('style');
style.textContent = `
  #sd-overlay { position: fixed; inset: 0; z-index: 10000; display: none; overflow-y: auto; -webkit-overflow-scrolling: touch; background: rgba(4,10,20,0.9); padding: 1.25rem 0.75rem 3rem; }
  #sd-overlay.sd-open { display: block; }
  body.sd-locked { overflow: hidden; }
  .sd-modal { max-width: 760px; margin: 0 auto; background: #0D2D4A; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 1.5rem; color: #F0EDE6; font-family: 'Barlow', sans-serif; font-weight: 300; }
  .sd-eyebrow { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 0.75rem; letter-spacing: 0.14em; text-transform: uppercase; color: #00CFAD; }
  .sd-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.9rem; line-height: 1.1; margin-top: 0.35rem; overflow-wrap: anywhere; }
  .sd-sub { font-size: 0.85rem; color: rgba(240,237,230,0.6); margin-top: 0.3rem; }
  .sd-doc { margin-top: 1.25rem; background: #07101e; border-radius: 3px; }
  .sd-doc canvas { display: block; width: 100%; height: auto; background: white; margin-bottom: 0.5rem; }
  .sd-doc canvas:last-child { margin-bottom: 0; }
  .sd-doc-msg { padding: 2rem 1rem; text-align: center; font-size: 0.85rem; color: rgba(240,237,230,0.6); }
  .sd-open-link { display: inline-block; margin-top: 0.6rem; font-size: 0.8rem; color: #00CFAD; }
  .sd-sign { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.1); }
  .sd-confirm { font-size: 0.9rem; line-height: 1.5; }
  .sd-fields { display: grid; grid-template-columns: 2fr 1fr; gap: 0.85rem; margin-top: 1rem; }
  .sd-fields label { display: block; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(240,237,230,0.6); font-weight: 500; margin-bottom: 0.3rem; }
  .sd-fields input { width: 100%; box-sizing: border-box; background: rgba(10,22,40,0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; padding: 0.65rem 0.8rem; color: #F0EDE6; color-scheme: dark; font-family: 'Barlow', sans-serif; font-size: 16px; outline: none; }
  .sd-fields input:focus { border-color: #00CFAD; }
  .sd-err { display: none; margin-top: 0.75rem; font-size: 0.82rem; color: #FF5C3A; }
  .sd-actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; align-items: center; }
  .sd-btn { flex: 1; background: #00CFAD; color: #0A1628; border: none; border-radius: 3px; padding: 0.8rem; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 0.95rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
  .sd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .sd-secondary { background: none; border: 1px solid rgba(255,255,255,0.2); color: #F0EDE6; border-radius: 3px; padding: 0.8rem 1.1rem; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 0.95rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
  @media (max-width: 560px) { .sd-modal { padding: 1.1rem; } .sd-fields { grid-template-columns: 1fr; } }
`;
document.head.appendChild(style);

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── PDF ───────────────────────────────────────────────────────────────────
// Drawn with pdf.js rather than an iframe: iOS shows only the first page of an
// embedded PDF and Android Chrome shows nothing at all, and most members are
// on their phones.
let pdfjsReady = null;
function loadPdfJs() {
  if (!pdfjsReady) {
    pdfjsReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${PDFJS}/pdf.min.js`;
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`;
        resolve(window.pdfjsLib);
      };
      s.onerror = () => { pdfjsReady = null; reject(new Error('Could not load the PDF viewer')); };
      document.head.appendChild(s);
    });
  }
  return pdfjsReady;
}

async function renderPdf(url, container) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument(url).promise;
  container.textContent = '';
  const cssWidth = container.clientWidth || 700;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const scale = (cssWidth * pixelRatio) / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.setAttribute('aria-label', `Page ${n} of ${pdf.numPages}`);
    container.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  }
}

// ── MODAL ─────────────────────────────────────────────────────────────────
let modalOpen = false;

// doc: { sessionId, sessionTitle, path, name }
// Resolves true once signed, false if the member backs out (enrol flow only).
function showSignModal(doc, { mandatory }) {
  modalOpen = true;
  const url = sb.storage.from(BUCKET).getPublicUrl(doc.path).data.publicUrl;

  const overlay = document.createElement('div');
  overlay.id = 'sd-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="sd-modal">
      <div class="sd-eyebrow">Please read and sign</div>
      <div class="sd-title"></div>
      <div class="sd-sub"></div>
      <div class="sd-doc"><div class="sd-doc-msg">Loading document...</div></div>
      <a class="sd-open-link" target="_blank" rel="noopener">Open the document in a new tab</a>
      <form class="sd-sign">
        <div class="sd-confirm">By signing below, I confirm I have read this document and agree to follow it.</div>
        <div class="sd-fields">
          <div><label for="sd-name">Full name</label><input id="sd-name" type="text" autocomplete="name" maxlength="120" required></div>
          <div><label for="sd-date">Date</label><input id="sd-date" type="date" required></div>
        </div>
        <div class="sd-err" role="alert"></div>
        <div class="sd-actions">
          <button type="button" class="sd-secondary">${mandatory ? 'Log Out' : 'Cancel'}</button>
          <button type="submit" class="sd-btn">Sign</button>
        </div>
      </form>
    </div>`;

  overlay.querySelector('.sd-title').textContent = doc.name;
  overlay.querySelector('.sd-sub').textContent = doc.sessionTitle;
  overlay.querySelector('.sd-open-link').href = url;
  overlay.querySelector('#sd-date').value = localToday();

  document.body.appendChild(overlay);
  document.body.classList.add('sd-locked');
  overlay.classList.add('sd-open');

  const docEl = overlay.querySelector('.sd-doc');
  renderPdf(url, docEl).catch(err => {
    console.warn('[signup-docs] PDF render failed:', err);
    const msg = document.createElement('div');
    msg.className = 'sd-doc-msg';
    msg.textContent = "This document can't be shown here. Please open it using the link below before signing.";
    docEl.replaceChildren(msg);
  });

  return new Promise(resolve => {
    const close = (result) => {
      overlay.remove();
      document.body.classList.remove('sd-locked');
      modalOpen = false;
      resolve(result);
    };

    overlay.querySelector('.sd-secondary').onclick = async () => {
      if (!mandatory) { close(false); return; }
      await sb.auth.signOut();
      window.location.href = '/';
    };

    overlay.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const errEl = overlay.querySelector('.sd-err');
      const btn   = overlay.querySelector('.sd-btn');
      errEl.style.display = 'none';
      btn.disabled = true; btn.textContent = 'Saving...';

      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) { window.location.href = '/auth.html'; return; }

        const res = await fetch('/.netlify/functions/sign-session-doc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
          body: JSON.stringify({
            sessionId:  doc.sessionId,
            signedName: overlay.querySelector('#sd-name').value,
            signedDate: overlay.querySelector('#sd-date').value
          })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Could not save your signature. Please try again.');
        close(true);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Sign';
      }
    };
  });
}

function toDoc(session) {
  return {
    sessionId: session.id,
    sessionTitle: session.title,
    path: session.signup_doc_path,
    name: session.signup_doc_name || 'Sign-up document'
  };
}

// ── ON PAGE LOAD: catch people already enrolled ───────────────────────────
async function currentMemberId() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return null;
  const { data, error } = await sb.from('members').select('id').eq('auth_user_id', session.user.id).maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function unsignedDocs(memberId) {
  const { data: enrolments, error } = await sb
    .from('enrolments')
    .select('sessions(id, title, date_end, signup_doc_path, signup_doc_name)')
    .eq('member_id', memberId)
    .eq('status', 'enrolled');
  if (error) throw error;

  const today = localToday();
  const sessions = (enrolments || [])
    .map(e => e.sessions)
    .filter(s => s?.signup_doc_path && s.date_end >= today);
  if (!sessions.length) return [];

  const { data: signatures, error: sigErr } = await sb
    .from('session_doc_signatures')
    .select('session_id, doc_path')
    .eq('member_id', memberId)
    .in('session_id', sessions.map(s => s.id));
  if (sigErr) throw sigErr;

  const isSigned = s => (signatures || []).some(x => x.session_id === s.id && x.doc_path === s.signup_doc_path);
  return sessions.filter(s => !isSigned(s)).map(toDoc);
}

async function checkOnLoad() {
  try {
    const memberId = await currentMemberId();
    if (!memberId) return;
    for (const doc of await unsignedDocs(memberId)) {
      if (modalOpen) return;
      await showSignModal(doc, { mandatory: true });
    }
  } catch (err) {
    console.warn('[signup-docs] check skipped:', err.message || err);
  }
}

// ── ENROL FLOW ────────────────────────────────────────────────────────────
// Resolves true if the member may carry on to checkout.
window.fnRequireSignupDoc = async function(session) {
  if (!session?.signup_doc_path) return true;

  const memberId = await currentMemberId();
  const { data, error } = await sb
    .from('session_doc_signatures')
    .select('id')
    .eq('session_id', session.id)
    .eq('member_id', memberId)
    .eq('doc_path', session.signup_doc_path)
    .maybeSingle();
  if (!error && data) return true;

  return showSignModal(toDoc(session), { mandatory: false });
};

if (document.readyState === 'complete') checkOnLoad();
else window.addEventListener('load', checkOnLoad);

})();
