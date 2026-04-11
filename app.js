// Constants for Form Population
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

// --- DOM ELEMENTS ---
const ST = {
  loading: document.getElementById('screen-loading'),
  auth: document.getElementById('screen-auth'),
  wait: document.getElementById('screen-wait'),
  main: document.getElementById('screen-main'),
  success: document.getElementById('screen-success')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  populateDropdowns();
  setupEventListeners();
  
  // Hook up to Auth State changes
  appAuth.onStateChange((user, profile) => {
    // Hide loading screen immediately on any state change notification post-init
    ST.loading.classList.add('fade-out');
    setTimeout(() => ST.loading.classList.add('hidden'), 300); // Also hide it from DOM flow
    
    // Switch screens based on state
    if (!user) {
      showScreen('auth');
    } else if (!profile) {
       // Edge-case: User is logged in, but their profile couldn't be loaded or table was deleted.
       document.getElementById('wait-name').textContent = "Profile Data Missing";
       const p = document.querySelector('#screen-wait p');
       if (p) p.innerHTML = "Your profile data could not be found. <b>If the database tables were deleted</b>, please run your SQL script again in Supabase.";
       showScreen('wait');
    } else if (!profile.approved) {
      document.getElementById('wait-name').textContent = profile.name;
      showScreen('wait');
    } else if (profile.approved) {
      setupTeacherForm(profile);
      showScreen('main');
    }
  });

  // Init Auth (checks session)
  appAuth.init();
});

// --- NAVIGATION & SCREENS ---
function showScreen(screenKey) {
  Object.keys(ST).forEach(k => {
    if (k !== 'loading') ST[k].classList.add('hidden');
  });
  ST[screenKey].classList.remove('hidden');
}

function switchAuthTab(type) {
  const isLogin = type === 'login';
  
  // Toggle UI active states
  document.getElementById('tab-login').style.borderBottomColor = isLogin ? 'var(--primary)' : 'transparent';
  document.getElementById('tab-login').style.color = isLogin ? 'var(--primary)' : 'var(--text-secondary)';
  document.getElementById('tab-register').style.borderBottomColor = !isLogin ? 'var(--primary)' : 'transparent';
  document.getElementById('tab-register').style.color = !isLogin ? 'var(--primary)' : 'var(--text-secondary)';
  
  // Toggle forms
  document.getElementById('form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('form-register').classList.toggle('hidden', isLogin);

  // Clear errors
  document.getElementById('err-login').classList.add('hidden');
  document.getElementById('err-register').classList.add('hidden');
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
          <input type="checkbox" id="chk-${val}" value="${val}">
          <label for="chk-${val}">${val}</label>
        </div>
      `;
    });
  };

  buildChips('reg-classes', CLASSES);
  buildChips('reg-subjects', SUBJECTS);

  // Build periods
  const pBox = document.getElementById('period-chips');
  PERIODS.forEach(p => {
    pBox.innerHTML += `
      <div class="chip">
        <input type="radio" name="period" id="p${p}" value="${p}" required>
        <label for="p${p}">P${p}</label>
      </div>
    `;
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

  // Reset form
  document.getElementById('attendance-form').reset();
  toggleCounts(true);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Theme Toggle
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
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
  document.getElementById('btn-refresh-status').addEventListener('click', async () => {
     ST.loading.classList.remove('fade-out');
     await appAuth.db.auth.refreshSession();
     appAuth.init(); // re-evaluates
  });

  // Login Form
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('log-email').value.trim();
    const pwd = document.getElementById('log-pwd').value;
    const btn = document.getElementById('btn-login');
    const err = document.getElementById('err-login');
    
    err.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Signing In...';

    const { error } = await appAuth.login(email, pwd);
    if (error) {
       err.textContent = error.message;
       err.classList.remove('hidden');
       btn.disabled = false;
       btn.textContent = 'Sign In';
    }
    // Success is handled by onAuthStateChange
  });

  // Register Form
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value.trim();
    const pwd = document.getElementById('reg-pwd').value;
    const pwdConfirm = document.getElementById('reg-pwd-confirm').value;
    
    const classes = [...document.querySelectorAll('#reg-classes input:checked')].map(i => i.value);
    const subjects = [...document.querySelectorAll('#reg-subjects input:checked')].map(i => i.value);

    const btn = document.getElementById('btn-register');
    const err = document.getElementById('err-register');
    err.classList.add('hidden');

    if (!name) return showError(err, 'Please select a designation');
    if (pwd !== pwdConfirm) return showError(err, 'Passwords do not match');
    if (classes.length === 0) return showError(err, 'Select at least one class');
    if (subjects.length === 0) return showError(err, 'Select at least one subject');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Creating Account...';

    const { data, error } = await appAuth.register(email, pwd, name, classes, subjects);
    if (error) {
      showError(err, error.message);
      btn.disabled = false;
      btn.textContent = 'Create Account';
      return;
    }

    // Success (will await admin approval)
    // Wait screen handled by onAuthStateChange
  });

  // Form Toggles (Class Taken)
  document.querySelectorAll('input[name="taken"]').forEach(r => {
     r.addEventListener('change', () => toggleCounts(r.value === 'Yes'));
  });

  // Math Auto Update
  ['tot','pre','abs','lea','od','tca','nr','sick'].forEach(id => {
     const el = document.getElementById(`count-${id}`);
     if(el) el.addEventListener('input', updateMath);
  });

  // Main Form Submit
  document.getElementById('attendance-form').addEventListener('submit', handleAttendanceSubmit);
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
  return parseInt(document.getElementById(`count-${id}`).value) || 0;
}

function updateMath() {
  const tot = getN('tot');
  const sum = getN('pre') + getN('abs') + getN('lea') + getN('od') + getN('tca') + getN('nr') + getN('sick');
  
  const checkCard = document.getElementById('math-checker');
  if (!tot && !sum) {
     checkCard.className = 'alert';
     checkCard.style.backgroundColor = 'rgba(0,0,0,0.05)';
     checkCard.style.color = 'var(--text-secondary)';
     checkCard.style.border = 'none';
     checkCard.innerHTML = '⊞ Enter counts above — sum must equal Total Students';
  } else if (sum === tot) {
     checkCard.className = 'alert';
     checkCard.style.backgroundColor = 'var(--success-bg)';
     checkCard.style.color = 'var(--success)';
     checkCard.style.border = '1px solid var(--success)';
     checkCard.innerHTML = `✅ Sum (${sum}) = Total (${tot}) — Correct!`;
  } else {
     checkCard.className = 'alert alert-danger';
     checkCard.style.backgroundColor = 'var(--danger-bg)';
     checkCard.style.color = 'var(--danger)';
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

async function handleAttendanceSubmit(e) {
  e.preventDefault();
  
  const period = document.querySelector('input[name="period"]:checked')?.value;
  const cls = document.getElementById('form-class').value;
  const subject = document.getElementById('form-subject').value;
  const taken = document.querySelector('input[name="taken"]:checked')?.value;

  if (!period || !cls || !subject || !taken) {
    return showToast('⚠️ Please fill out all required fields.');
  }

  if (taken === 'Yes') {
    const tot = getN('tot');
    const sum = getN('pre') + getN('abs') + getN('lea') + getN('od') + getN('tca') + getN('nr') + getN('sick');
    if (!tot) return showToast('⚠️ Please enter Total Students');
    if (sum !== tot) return showToast(`❌ Math error: Sum (${sum}) ≠ Total (${tot})`);
  }

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span> Submitting...';

  const payload = {
    teacher: appAuth.profile.name,
    period,
    class: cls,
    subject,
    taken,
    total: taken === 'Yes' ? getN('tot') : 0,
    present: taken === 'Yes' ? getN('pre') : 0,
    leave_count: taken === 'Yes' ? getN('lea') : 0,
    od: taken === 'Yes' ? getN('od') : 0,
    absent: taken === 'Yes' ? getN('abs') : 0,
    tca: taken === 'Yes' ? getN('tca') : 0,
    nr: taken === 'Yes' ? getN('nr') : 0,
    sick: taken === 'Yes' ? getN('sick') : 0,
    reason: document.getElementById('form-reason').value,
    remarks: document.getElementById('form-remarks').value.trim()
  };

  const { error } = await appAuth.db.from('attendance').insert([payload]);
  
  btn.disabled = false;
  btn.innerHTML = 'Submit Attendance &rarr;';

  if (error) {
    showToast('❌ Error submitting: ' + error.message);
  } else {
    // Show success details
    document.getElementById('suc-details').innerHTML = `
       Class: ${cls} - ${subject} <br>
       Period: ${period} <br>
       Status: ${taken === 'Yes' ? 'Taken' : 'Not Taken'}
    `;
    showScreen('success');
    window.scrollTo(0,0);
  }
}

function submitAnother() {
  document.getElementById('attendance-form').reset();
  document.querySelectorAll('input[name="period"]').forEach(r => r.checked = false);
  toggleCounts(true);
  showScreen('main');
  window.scrollTo(0,0);
}
