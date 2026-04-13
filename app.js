// ── Date format helpers (display: dd/mm/yyyy, internal: yyyy-mm-dd) ──
function isoToDisplay(iso) {
  if (!iso || iso.length !== 10) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function displayToIso(disp) {
  if (!disp || disp.length !== 10) return '';
  const [d, m, y] = disp.split('/');
  if (!d || !m || !y || y.length !== 4) return '';
  return `${y}-${m}-${d}`;
}
function autoFormatDateInput(el) {
  el.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 4) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
    else if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    this.value = v;
  });
}

// Constants
const TEACHERS = [
  "TGT Computer Science", "Librarian", "PET F", "PET M",
  "PGT Biology", "PGT Chemistry", "PGT Economics", "PGT English",
  "PGT Geography", "PGT Hindi", "PGT History", "PGT Computer Sc.",
  "PGT Mathematics", "PGT Physics", "TGT Art", "TGT Eng-1",
  "TGT Eng-2", "TGT Hindi-1", "TGT Hindi-2", "TGT Punjabi-1",
  "TGT Punjabi-2", "TGT Math-1", "TGT Math-2", "TGT Music",
  "TGT Science", "TGT Social Science", "Automotive Teacher"
];
const SUBJECTS = [
  "Art", "Biology", "Chemistry", "Computer", "Economics", "English",
  "Geography", "Hindi", "History", "Library", "Hindi/Punjabi",
  "Mathematics", "Music", "Physical Education", "Physics", "Science",
  "Social Science", "SUPW", "3rd Language", "G.S. / G.F.C",
  "SEWA / WE", "ICT (Comp. Lab)", "Vocational Education", "Hindi/CS",
  "IT/Automotive", "Computer Science", "Math/Biology",
  "Art Education (Music)", "Art Education (Drawing)", "Automotive"
];
const CLASSES = [
  "VI-A", "VI-B", "VII-A", "VII-B", "VIII-A", "VIII-B",
  "IX-A", "IX-B", "X-A", "X-B", "XI-Sci", "XI-Hum", "XII-Sci", "XII-Hum"
];
const PERIODS = ["1", "2", "3", "4", "5", "6", "7", "8"];

// Period chip colors (matching CSS)
const PERIOD_COLORS = {
  '1': '#6366F1', '2': '#06B6D4', '3': '#10B981', '4': '#F59E0B',
  '5': '#F97316', '6': '#EC4899', '7': '#8B5CF6', '8': '#14B8A6'
};

// Screens
const ST = {
  loading:     document.getElementById('screen-loading'),
  auth:        document.getElementById('screen-auth'),
  wait:        document.getElementById('screen-wait'),
  main:        document.getElementById('screen-main'),
  success:     document.getElementById('screen-success'),
  forceReset:  document.getElementById('screen-force-reset'),
  myActivity:  document.getElementById('screen-my-activity')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  if (window._log) window._log('DOMContentLoaded fired');

  // Verify critical elements exist
  if (window._log) {
    window._log('ST.loading=' + (ST.loading ? 'OK' : 'NULL!'));
    window._log('ST.auth='   + (ST.auth    ? 'OK' : 'NULL!'));
    window._log('ST.main='   + (ST.main    ? 'OK' : 'NULL!'));
    window._log('ST.myActivity=' + (ST.myActivity ? 'OK' : 'NULL!'));
    window._log('appAuth exists=' + (typeof appAuth !== 'undefined'));
  }

  try {
    if (window._log) window._log('populateDropdowns() starting...');
    populateDropdowns();
    if (window._log) window._log('populateDropdowns() OK');
  } catch(e) {
    if (window._err) window._err('populateDropdowns CRASH: ' + e.message);
  }

  try {
    if (window._log) window._log('setupEventListeners() starting...');
    setupEventListeners();
    if (window._log) window._log('setupEventListeners() OK');
  } catch(e) {
    if (window._err) window._err('setupEventListeners CRASH: ' + e.message);
  }

  appAuth.onStateChange((user, profile) => {
    if (window._log) window._log('onStateChange CB fired. user=' + (user ? user.email : 'null'));
    ST.loading.classList.add('fade-out');
    setTimeout(() => ST.loading.classList.add('hidden'), 300);

    if (!user) {
      const btnLogin = document.getElementById('btn-login');
      if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = 'Sign In'; }
      showScreen('auth');
    } else if (!profile) {
      document.getElementById('wait-name').textContent = 'Profile Data Missing';
      const p = document.querySelector('#screen-wait p');
      if (p) p.innerHTML = 'Your profile data could not be found. <b>If the database tables were deleted</b>, please run your SQL script again in Supabase.';
      showScreen('wait');
    } else if (!profile.approved) {
      document.getElementById('wait-name').textContent = profile.name;
      showScreen('wait');
    } else if (profile.force_password_reset || appAuth.recoveryMode) {
      document.getElementById('force-reset-name').textContent = profile.name;
      showScreen('forceReset');
    } else {
      setupTeacherForm(profile);
      showScreen('main');
    }
    if (window._log) window._log('onStateChange CB done.');
  });

  if (window._log) window._log('Calling appAuth.init()...');
  appAuth.init();
  if (window._log) window._log('appAuth.init() call returned (async, still running).');

  // Safety net: force-show auth screen if spinner still shows after 6s
  setTimeout(() => {
    if (ST.loading && !ST.loading.classList.contains('hidden')) {
      if (window._log) window._log('TIMEOUT: loading still visible after 6s — forcing auth.');
      ST.loading.classList.add('hidden');
      showScreen('auth');
    }
  }, 6000);

  // Inject the floating debug button only in debug mode
  if (window._debugOn) {
    setTimeout(() => {
      const dbgBtn = document.createElement('button');
      dbgBtn.id = 'dbg-btn';
      dbgBtn.textContent = '🪲 Debug Log';
      dbgBtn.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:99999;padding:8px 14px;background:#1e1b4b;color:#a5b4fc;border:1px solid #6366F1;border-radius:20px;font-size:0.78rem;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(99,102,241,0.5);';
      dbgBtn.onclick = showDebugLog;
      document.body.appendChild(dbgBtn);
    }, 1000);
  }
});

// Show debug overlay with full log
function showDebugLog() {
  const logs = (window._DBG || []).concat(
    (localStorage.getItem('jnv_dbg') || '').split('\n').filter(Boolean)
  );
  const unique = [...new Set(logs)];
  const text = unique.join('\n') || 'No log entries captured yet.';

  let overlay = document.getElementById('dbg-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dbg-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#050508;color:#a5b4fc;font-family:monospace;font-size:0.72rem;padding:16px;overflow:auto;white-space:pre-wrap;line-height:1.6;';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML =
    '<div style="display:flex;gap:10px;margin-bottom:12px;position:sticky;top:0;background:#050508;padding-bottom:8px;">' +
    '<button onclick="this.closest(\'#dbg-overlay\').remove()" style="padding:6px 14px;background:#6366F1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">✕ Close</button>' +
    '<button onclick="navigator.clipboard.writeText(document.getElementById(\'dbg-text\').textContent)" style="padding:6px 14px;background:#10B981;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">📋 Copy All</button>' +
    '<button onclick="localStorage.removeItem(\'jnv_dbg\');document.getElementById(\'dbg-overlay\').remove();" style="padding:6px 14px;background:#EF4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;">🗑 Clear</button>' +
    '</div>' +
    '<pre id="dbg-text" style="margin:0;">' + text + '</pre>';
  overlay.style.display = 'block';
}

// --- NAVIGATION ---
function showScreen(screenKey) {
  if (window._log) window._log('showScreen(' + screenKey + ')');
  Object.keys(ST).forEach(k => {
    if (ST[k] && k !== 'loading') ST[k].classList.add('hidden');
  });
  if (ST[screenKey]) ST[screenKey].classList.remove('hidden');
  else if (window._err) window._err('showScreen: ST.' + screenKey + ' is NULL!');
}

function switchAuthTab(type) {
  document.getElementById('tab-login').classList.toggle('active', type === 'login');
  document.getElementById('tab-register').classList.toggle('active', type === 'register');
  
  const frmLogin = document.getElementById('form-login');
  const frmReg = document.getElementById('form-register');
  const frmForgot = document.getElementById('form-forgot');
  
  if (frmLogin) frmLogin.classList.toggle('hidden', type !== 'login');
  if (frmReg) frmReg.classList.toggle('hidden', type !== 'register');
  if (frmForgot) frmForgot.classList.toggle('hidden', type !== 'forgot');
  
  if (type === 'forgot') {
    document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
  }

  const errL = document.getElementById('err-login');
  const errR = document.getElementById('err-register');
  const errF = document.getElementById('err-forgot');
  if (errL) errL.classList.add('hidden');
  if (errR) errR.classList.add('hidden');
  if (errF) errF.classList.add('hidden');
}

// --- POPULATE DROPDOWNS ---
function populateDropdowns() {
  const regName = document.getElementById('reg-designation');
  TEACHERS.forEach(t => regName.add(new Option(t, t)));

  const buildChips = (containerId, items) => {
    const box = document.getElementById(containerId);
    items.forEach(val => {
      box.innerHTML += `
        <div class="chip">
          <input type="checkbox" id="chk-${val.replace(/\s+/g,'_')}" value="${val}">
          <label for="chk-${val.replace(/\s+/g,'_')}">${val}</label>
        </div>`;
    });
  };

  buildChips('reg-classes', CLASSES);
  buildChips('reg-subjects', SUBJECTS);

  // Build period chips with data-p for coloring
  const pBox = document.getElementById('period-chips');
  PERIODS.forEach(p => {
    pBox.innerHTML += `
      <div class="chip" data-p="${p}">
        <input type="radio" name="period" id="p${p}" value="${p}" required>
        <label for="p${p}">P${p}</label>
      </div>`;
  });
}

function setupTeacherForm(profile) {
  document.getElementById('teacher-name-display').textContent = profile.name;
  const desigEl = document.getElementById('teacher-designation-display');
  if (desigEl) desigEl.textContent = profile.designation || '';

  const clsSel = document.getElementById('form-class');
  clsSel.innerHTML = '<option value="">— Select class —</option>';
  (profile.classes || []).forEach(c => clsSel.add(new Option(c, c)));

  const subSel = document.getElementById('form-subject');
  subSel.innerHTML = '<option value="">— Select subject —</option>';
  (profile.subjects || []).forEach(s => subSel.add(new Option(s, s)));

  document.getElementById('attendance-form').reset();
  toggleCounts(true);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Date inputs are now native type="date" — no auto-formatting needed

  // Theme Toggle
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('nova-theme', next);
      document.querySelectorAll('.theme-toggle').forEach(b => b.textContent = next === 'dark' ? '☀' : '🌙');
    });
  });

  // Logout — force-clear session even if Supabase signOut silently fails
  document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      ST.loading.classList.remove('fade-out', 'hidden');
      try {
        await appAuth.logout();
      } catch (e) {
        console.warn('signOut error:', e);
      }
      // Force clear state and redirect to auth screen regardless
      appAuth.user = null;
      appAuth.profile = null;
      appAuth.recoveryMode = false;
      showScreen('auth');
      ST.loading.classList.add('fade-out');
      setTimeout(() => ST.loading.classList.add('hidden'), 300);
      btn.disabled = false;
    });
  });

  // Refresh status
  document.getElementById('btn-refresh-status')?.addEventListener('click', async () => {
    ST.loading.classList.remove('fade-out');
    await appAuth.db.auth.refreshSession();
    appAuth.init();
  });

  // Login Form
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('log-email').value.trim();
    const pwd   = document.getElementById('log-pwd').value;
    const btn   = document.getElementById('btn-login');
    const err   = document.getElementById('err-login');

    err.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Signing In…';

    const { error } = await appAuth.login(email, pwd);
    if (error) {
      err.textContent = error.message;
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // Forgot Password Form
  document.getElementById('form-forgot')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn   = document.getElementById('btn-forgot');
    const err   = document.getElementById('err-forgot');
    const succ  = document.getElementById('succ-forgot');

    err.classList.add('hidden');
    succ.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Sending Link…';

    const { error } = await appAuth.resetPassword(email);
    if (error) {
      err.textContent = error.message;
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Send Reset Link →';
    } else {
      succ.textContent = 'Reset link sent! Check your email inbox (and spam folder).';
      succ.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Send Reset Link →';
      document.getElementById('forgot-email').value = '';
    }
  });

  // Register Form
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const teacherName  = document.getElementById('reg-teacher-name').value.trim();
    const designation  = document.getElementById('reg-designation').value;
    const email        = document.getElementById('reg-email').value.trim();
    const pwd          = document.getElementById('reg-pwd').value;
    const pwdConfirm   = document.getElementById('reg-pwd-confirm').value;
    const classes      = [...document.querySelectorAll('#reg-classes input:checked')].map(i => i.value);
    const subjects     = [...document.querySelectorAll('#reg-subjects input:checked')].map(i => i.value);
    const btn          = document.getElementById('btn-register');
    const err          = document.getElementById('err-register');
    err.classList.add('hidden');

    if (!teacherName)        return showError(err, 'Please enter your full name');
    if (!designation)        return showError(err, 'Please select a designation');
    if (pwd !== pwdConfirm)  return showError(err, 'Passwords do not match');
    if (classes.length  < 1) return showError(err, 'Select at least one class');
    if (subjects.length < 1) return showError(err, 'Select at least one subject');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Creating Account…';

    const { error } = await appAuth.register(email, pwd, teacherName, designation, classes, subjects);
    if (error) {
      showError(err, error.message);
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });

  // Taken toggle
  document.querySelectorAll('input[name="taken"]').forEach(r => {
    r.addEventListener('change', () => toggleCounts(r.value === 'Yes'));
  });

  // Math auto update
  ['tot','pre','abs','lea','od','tca','nr','sick'].forEach(id => {
    const el = document.getElementById(`count-${id}`);
    if (el) el.addEventListener('input', updateMath);
  });

  // Main Form Submit
  document.getElementById('attendance-form').addEventListener('submit', handleAttendanceSubmit);

  // Force Reset Form Submit
  document.getElementById('form-force-reset')?.addEventListener('submit', handleForceReset);

  // Change Password Form Submit
  document.getElementById('form-change-pwd')?.addEventListener('submit', handleChangePwd);

  // Password strength on force reset
  document.getElementById('fr-new-pwd')?.addEventListener('input', (e) => {
    updatePwdStrength(e.target.value, 'fr-strength-fill', 'fr-strength-label');
  });

  // Password strength on change pwd modal
  document.getElementById('cp-new-pwd')?.addEventListener('input', (e) => {
    updatePwdStrength(e.target.value, 'cp-strength-fill', 'cp-strength-label');
  });
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function toggleCounts(isTaken) {
  document.getElementById('counts-section').classList.toggle('hidden', !isTaken);
  document.getElementById('reason-section').classList.toggle('hidden', isTaken);
}

function getN(id) {
  return parseInt(document.getElementById(`count-${id}`)?.value) || 0;
}

function updateMath() {
  const tot = getN('tot');
  const sum = getN('pre') + getN('abs') + getN('lea') + getN('od') + getN('tca') + getN('nr') + getN('sick');
  const checkCard = document.getElementById('math-checker');
  if (!tot && !sum) {
    checkCard.className = 'math-checker';
    checkCard.style.cssText = '';
    checkCard.innerHTML = '⊞ Fill counts — the sum must equal Total Students';
  } else if (sum === tot) {
    checkCard.className = 'math-checker';
    checkCard.style.backgroundColor = 'var(--emerald-sub)';
    checkCard.style.color = 'var(--emerald-lt)';
    checkCard.style.border = '1px solid var(--emerald-border)';
    checkCard.innerHTML = `✅ Sum (${sum}) = Total (${tot}) — Correct!`;
  } else {
    checkCard.className = 'math-checker alert-danger';
    checkCard.style.backgroundColor = 'var(--rose-sub)';
    checkCard.style.color = 'var(--rose-lt)';
    checkCard.style.border = '1px solid var(--rose-border)';
    const diff = sum - tot;
    checkCard.innerHTML = `❌ Sum (${sum}) ≠ Total (${tot}) — Diff: ${diff > 0 ? '+' : ''}${diff}`;
  }
}

function showToast(msg) {
  const t = document.getElementById('global-toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// Password strength helper
function updatePwdStrength(pwd, fillId, labelId) {
  const fill  = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if (!fill || !label) return;

  let score = 0;
  if (pwd.length >= 8)                       score++;
  if (/[A-Z]/.test(pwd))                     score++;
  if (/[0-9]/.test(pwd))                     score++;
  if (/[^A-Za-z0-9]/.test(pwd))             score++;

  const levels = [
    { pct: '0%',   color: 'transparent', text: '' },
    { pct: '25%',  color: 'var(--rose)',   text: 'Weak' },
    { pct: '50%',  color: 'var(--amber)',  text: 'Fair' },
    { pct: '75%',  color: 'var(--cyan)',   text: 'Good' },
    { pct: '100%', color: 'var(--emerald)', text: 'Strong ✓' },
  ];
  const lv = levels[score];
  fill.style.width      = lv.pct;
  fill.style.background = lv.color;
  label.textContent     = lv.text;
  label.style.color     = lv.color;
}

// --- FORCE RESET FLOW ---
async function handleForceReset(e) {
  e.preventDefault();
  const newPwd  = document.getElementById('fr-new-pwd').value;
  const confirm = document.getElementById('fr-confirm-pwd').value;
  const err     = document.getElementById('fr-err');
  const btn     = document.getElementById('btn-force-reset');

  err.classList.add('hidden');

  if (newPwd.length < 8)   return showError(err, 'Password must be at least 8 characters');
  if (newPwd !== confirm)  return showError(err, 'Passwords do not match');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span> Saving…';

  try {
    // Update Supabase Auth password
    const { error: pwdErr } = await appAuth.db.auth.updateUser({ password: newPwd });
    if (pwdErr) throw pwdErr;

    // Clear the force_password_reset flag
    const { error: dbErr } = await appAuth.db
      .from('teacher_profiles')
      .update({ force_password_reset: false })
      .eq('id', appAuth.user.id);
    if (dbErr) throw dbErr;

    // Update local profile cache and go to main
    if (appAuth.profile) appAuth.profile.force_password_reset = false;
    appAuth.recoveryMode = false;
    showToast('✅ Password updated successfully!');
    setupTeacherForm(appAuth.profile);
    showScreen('main');
  } catch (ex) {
    showError(err, ex.message);
  }

  btn.disabled = false;
  btn.textContent = 'Set New Password →';
}

// --- CHANGE PASSWORD MODAL ---
function openChangePwdModal() {
  document.getElementById('cp-new-pwd').value     = '';
  document.getElementById('cp-confirm-pwd').value = '';
  const fill = document.getElementById('cp-strength-fill');
  const lbl  = document.getElementById('cp-strength-label');
  if (fill) { fill.style.width = '0%'; }
  if (lbl)  { lbl.textContent = ''; }
  document.getElementById('cp-err').classList.add('hidden');
  document.getElementById('cp-success').classList.add('hidden');
  document.getElementById('modal-change-pwd').style.display = 'flex';
}

function closeChangePwdModal() {
  document.getElementById('modal-change-pwd').style.display = 'none';
}

async function handleChangePwd(e) {
  e.preventDefault();
  const newPwd  = document.getElementById('cp-new-pwd').value;
  const confirm = document.getElementById('cp-confirm-pwd').value;
  const err     = document.getElementById('cp-err');
  const success = document.getElementById('cp-success');
  const btn     = document.getElementById('btn-change-pwd');

  err.classList.add('hidden');
  success.classList.add('hidden');

  if (newPwd.length < 8)  return showError(err, 'Password must be at least 8 characters');
  if (newPwd !== confirm)  return showError(err, 'Passwords do not match');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span> Updating…';

  try {
    const { error } = await appAuth.db.auth.updateUser({ password: newPwd });
    if (error) throw error;
    success.textContent = '✅ Password changed successfully!';
    success.classList.remove('hidden');
    document.getElementById('cp-new-pwd').value     = '';
    document.getElementById('cp-confirm-pwd').value = '';
    setTimeout(closeChangePwdModal, 2000);
  } catch (ex) {
    showError(err, ex.message);
  }

  btn.disabled = false;
  btn.textContent = '🔒 Update Password';
}

// --- ATTENDANCE FORM ---
async function handleAttendanceSubmit(e) {
  e.preventDefault();

  const period  = document.querySelector('input[name="period"]:checked')?.value;
  const cls     = document.getElementById('form-class').value;
  const subject = document.getElementById('form-subject').value;
  const taken   = document.querySelector('input[name="taken"]:checked')?.value;

  if (!period || !cls || !subject || !taken)
    return showToast('⚠️ Please fill out all required fields.');

  if (taken === 'Yes') {
    const tot = getN('tot');
    const sum = getN('pre') + getN('abs') + getN('lea') + getN('od') + getN('tca') + getN('nr') + getN('sick');
    if (!tot) return showToast('⚠️ Please enter Total Students');
    if (sum !== tot) return showToast(`❌ Math error: Sum (${sum}) ≠ Total (${tot})`);
  }

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span> Submitting…';

  const payload = {
    teacher:      appAuth.profile.name,
    period,
    class:        cls,
    subject,
    taken,
    total:        taken === 'Yes' ? getN('tot') : 0,
    present:      taken === 'Yes' ? getN('pre') : 0,
    leave_count:  taken === 'Yes' ? getN('lea') : 0,
    od:           taken === 'Yes' ? getN('od')  : 0,
    absent:       taken === 'Yes' ? getN('abs') : 0,
    tca:          taken === 'Yes' ? getN('tca') : 0,
    nr:           taken === 'Yes' ? getN('nr')  : 0,
    sick:         taken === 'Yes' ? getN('sick'): 0,
    reason:       document.getElementById('form-reason').value,
    remarks:      document.getElementById('form-remarks').value.trim()
  };

  const { error } = await appAuth.db.from('attendance').insert([payload]);

  btn.disabled = false;
  btn.innerHTML = 'Submit Attendance &rarr;';

  if (error) {
    showToast('❌ Error submitting: ' + error.message);
  } else {
    const rows = [
      ['Teacher', payload.teacher],
      ['Period',  'Period ' + period],
      ['Class',   cls],
      ['Subject', subject],
      ['Status',  taken === 'Yes'
        ? '<span class="badge badge-success">✅ Class Taken</span>'
        : '<span class="badge badge-danger">❌ Not Taken</span>']
    ];
    if (payload.reason) rows.push(['Reason', payload.reason]);

    const html = rows.map(([l,v]) =>
      `<div class="detail-row-item"><div class="detail-label">${l}</div><div class="detail-val">${v}</div></div>`
    ).join('');

    document.getElementById('suc-details').innerHTML = html;
    showScreen('success');
    window.scrollTo(0, 0);
  }
}

function submitAnother() {
  document.getElementById('attendance-form').reset();
  document.querySelectorAll('input[name="period"]').forEach(r => r.checked = false);
  toggleCounts(true);
  showScreen('main');
  window.scrollTo(0, 0);
}

// ═══════════════════════════════════════════════════════════
//  MY REPORTS — Teacher Personal Dashboard
// ═══════════════════════════════════════════════════════════

let _myRecordsCache = [];

function todayStr() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0];
}

function openMyReports() {
  // Default to "This Week" on open
  setMyRange('week', document.querySelector('.my-quick-btn'));
  showScreen('myActivity');
  window.scrollTo(0, 0);
}

function setMyRange(type, btn) {
  document.querySelectorAll('.my-quick-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const today = todayStr();
  let from = today, to = today;

  if (type === 'week') {
    const d = new Date(today);
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    from = d.toISOString().split('T')[0];
  } else if (type === 'month') {
    from = today.slice(0, 7) + '-01';
  } else if (type === '30') {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    from = d.toISOString().split('T')[0];
  } else if (type === 'all') {
    from = '2024-01-01';
  }

  document.getElementById('my-from').value = from;
  document.getElementById('my-to').value = to;
  loadMyActivity();
}

async function loadMyActivity() {
  const from = document.getElementById('my-from').value;
  const to   = document.getElementById('my-to').value;
  if (!from || !to) return;

  const kpiGrid = document.getElementById('my-kpi-grid');
  const tableEl = document.getElementById('my-records-body');
  kpiGrid.innerHTML = '<div style="color:var(--t3);font-size:0.85rem;">Loading…</div>';
  tableEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--t3);">⏳ Fetching your records…</div>';

  try {
    const { data, error } = await appAuth.db
      .from('attendance')
      .select('*')
      .eq('teacher', appAuth.profile.name)
      .gte('created_at', from + 'T00:00:00+05:30')
      .lte('created_at', to   + 'T23:59:59+05:30')
      .order('created_at', { ascending: false });

    if (error) throw error;
    _myRecordsCache = data || [];
    renderMyKpis(_myRecordsCache);
    renderMyTable(_myRecordsCache);
  } catch (e) {
    kpiGrid.innerHTML = '';
    tableEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--rose-lt);">❌ ${e.message}</div>`;
  }
}

function renderMyKpis(rows) {
  const taken    = rows.filter(r => String(r.taken).toLowerCase() === 'yes');
  const notTaken = rows.filter(r => String(r.taken).toLowerCase() !== 'yes');
  const totalP   = taken.reduce((a, r) => a + (r.present || 0), 0);
  const totalS   = taken.reduce((a, r) => a + (r.total   || 0), 0);
  const avgPct   = totalS ? Math.round(totalP / totalS * 100) : 0;
  const periods  = [...new Set(rows.map(r => r.period))].length;

  const kpis = [
    { val: rows.length,     lbl: 'Total Submitted', color: 'var(--indigo-lt)' },
    { val: taken.length,    lbl: 'Classes Taken',   color: 'var(--emerald-lt)' },
    { val: notTaken.length, lbl: 'Not Taken',       color: 'var(--rose-lt)' },
    { val: avgPct + '%',    lbl: 'Avg Attendance',  color: 'var(--cyan-lt)' },
    { val: periods,         lbl: 'Periods Covered', color: 'var(--amber-lt)' },
  ];

  document.getElementById('my-kpi-grid').innerHTML = kpis.map(k => `
    <div class="my-kpi">
      <div class="my-kpi-val" style="color:${k.color}">${k.val}</div>
      <div class="my-kpi-lbl">${k.lbl}</div>
    </div>`).join('');
}

function renderMyTable(rows) {
  const el = document.getElementById('my-records-body');
  if (!rows.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3);">📭 No submissions found for this period.</div>';
    return;
  }
  let h = `<table style="width:100%;border-collapse:collapse;font-size:0.84rem;">
    <thead><tr style="background:var(--bg-raised);">
      <th style="padding:10px 12px;text-align:left;font-size:0.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">#</th>
      <th style="padding:10px 12px;text-align:left;font-size:0.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">Date</th>
      <th style="padding:10px 12px;text-align:left;font-size:0.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">Period</th>
      <th style="padding:10px 12px;text-align:left;font-size:0.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">Class</th>
      <th style="padding:10px 12px;text-align:left;font-size:0.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">Subject</th>
      <th style="padding:10px 12px;text-align:left;font-size:0.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">Status</th>
      <th style="padding:10px 12px;text-align:center;font-size:0.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">Total</th>
      <th style="padding:10px 12px;text-align:center;font-size:0.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">Present</th>
      <th style="padding:10px 12px;text-align:center;font-size:0.62rem;color:var(--t3);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">Absent</th>
    </tr></thead><tbody>`;

  rows.forEach((r, i) => {
    const dt  = new Date(r.created_at);
    const date = dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const time = dt.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
    const isTaken = String(r.taken).toLowerCase() === 'yes';
    const statusHtml = isTaken
      ? '<span style="background:var(--emerald-sub);color:var(--emerald-lt);border:1px solid var(--emerald-border);padding:2px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;">✓ Taken</span>'
      : '<span style="background:var(--rose-sub);color:var(--rose-lt);border:1px solid var(--rose-border);padding:2px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;">✗ Not Taken</span>';
    const bg = i % 2 === 0 ? '' : 'background:var(--bg-raised);';
    h += `<tr style="${bg}border-bottom:1px solid var(--bd);">
      <td style="padding:10px 12px;color:var(--t3);">${i + 1}</td>
      <td style="padding:10px 12px;white-space:nowrap;"><div style="font-weight:600;color:var(--t1);">${date}</div><div style="font-size:0.7rem;color:var(--t3);">${time}</div></td>
      <td style="padding:10px 12px;font-weight:700;color:var(--indigo-lt);">P${r.period}</td>
      <td style="padding:10px 12px;font-weight:600;color:var(--t1);">${r.class}</td>
      <td style="padding:10px 12px;color:var(--t2);">${r.subject}</td>
      <td style="padding:10px 12px;">${statusHtml}</td>
      <td style="padding:10px 12px;text-align:center;font-weight:600;">${r.total || '—'}</td>
      <td style="padding:10px 12px;text-align:center;color:var(--emerald-lt);font-weight:600;">${r.present || '—'}</td>
      <td style="padding:10px 12px;text-align:center;color:var(--rose-lt);font-weight:600;">${r.absent || '—'}</td>
    </tr>`;
  });

  el.innerHTML = h + '</tbody></table>';
}

function exportMyExcel() {
  if (!_myRecordsCache.length) { showToast('⚠️ No data to export.'); return; }
  if (typeof XLSX === 'undefined') { showToast('⚠️ Excel library not loaded yet.'); return; }

  const from  = document.getElementById('my-from').value;
  const to    = document.getElementById('my-to').value;
  const name  = appAuth.profile?.name || 'Teacher';

  // Build rows for export
  const sheetData = [
    ['#', 'Date', 'Time', 'Period', 'Class', 'Subject', 'Status', 'Total', 'Present', 'Absent', 'On Leave', 'On OD', 'TCA', 'NR', 'Sick', 'Remarks']
  ];
  _myRecordsCache.forEach((r, i) => {
    const dt = new Date(r.created_at);
    sheetData.push([
      i + 1,
      dt.toLocaleDateString('en-IN'),
      dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      'P' + r.period,
      r.class,
      r.subject,
      String(r.taken).toLowerCase() === 'yes' ? 'Taken' : 'Not Taken',
      r.total || 0, r.present || 0, r.absent || 0,
      r.leave_count || 0, r.od || 0, r.tca || 0, r.nr || 0, r.sick || 0,
      r.remarks || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  // Column widths
  ws['!cols'] = [4,14,8,6,8,16,10,6,7,7,8,6,5,5,5,20].map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'My Attendance');

  const fileName = `JNV_${name.replace(/\s+/g,'_')}_${from}_to_${to}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast('✅ Excel exported successfully!');
}
