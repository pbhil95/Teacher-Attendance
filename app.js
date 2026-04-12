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
  forceReset:  document.getElementById('screen-force-reset')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  populateDropdowns();
  setupEventListeners();

  appAuth.onStateChange((user, profile) => {
    ST.loading.classList.add('fade-out');
    setTimeout(() => ST.loading.classList.add('hidden'), 300);

    if (!user) {
      showScreen('auth');
    } else if (!profile) {
      document.getElementById('wait-name').textContent = "Profile Data Missing";
      const p = document.querySelector('#screen-wait p');
      if (p) p.innerHTML = "Your profile data could not be found. <b>If the database tables were deleted</b>, please run your SQL script again in Supabase.";
      showScreen('wait');
    } else if (!profile.approved) {
      document.getElementById('wait-name').textContent = profile.name;
      showScreen('wait');
    } else if (profile.force_password_reset || appAuth.recoveryMode) {
      // Admin reset password or User forgot password — force new password
      document.getElementById('force-reset-name').textContent = profile.name;
      showScreen('forceReset');
    } else {
      setupTeacherForm(profile);
      showScreen('main');
    }
  });

  appAuth.init();
});

// --- NAVIGATION ---
function showScreen(screenKey) {
  Object.keys(ST).forEach(k => {
    if (ST[k] && k !== 'loading') ST[k].classList.add('hidden');
  });
  if (ST[screenKey]) ST[screenKey].classList.remove('hidden');
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
  const regName = document.getElementById('reg-name');
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
  // Theme Toggle
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('nova-theme', next);
      document.querySelectorAll('.theme-toggle').forEach(b => b.textContent = next === 'dark' ? '☀' : '🌙');
    });
  });

  // Logout
  document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', async () => {
      ST.loading.classList.remove('fade-out');
      await appAuth.logout();
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
    const name       = document.getElementById('reg-name').value;
    const email      = document.getElementById('reg-email').value.trim();
    const pwd        = document.getElementById('reg-pwd').value;
    const pwdConfirm = document.getElementById('reg-pwd-confirm').value;
    const classes    = [...document.querySelectorAll('#reg-classes input:checked')].map(i => i.value);
    const subjects   = [...document.querySelectorAll('#reg-subjects input:checked')].map(i => i.value);
    const btn        = document.getElementById('btn-register');
    const err        = document.getElementById('err-register');
    err.classList.add('hidden');

    if (!name)               return showError(err, 'Please select a designation');
    if (pwd !== pwdConfirm)  return showError(err, 'Passwords do not match');
    if (classes.length  < 1) return showError(err, 'Select at least one class');
    if (subjects.length < 1) return showError(err, 'Select at least one subject');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Creating Account…';

    const { error } = await appAuth.register(email, pwd, name, classes, subjects);
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
