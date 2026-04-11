
    // ═══════════════════════════════════════════════════════════════
    //  STEP 1: Set your Supabase project details
    //  Get from: supabase.com → your project → Settings → API
    // ═══════════════════════════════════════════════════════════════
    const SUPABASE_URL = 'https://cuvleeayglhpuhouvzts.supabase.co';
    const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dmxlZWF5Z2xocHVob3V2enRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjYxNzgsImV4cCI6MjA5MTUwMjE3OH0.ZTKWwnvSESrSw_h7YCan9RIZxf69mq7tpVmkcIXCG4Y';

    // ── DASHBOARD PIN ─────────────────────────────────────────────
    // PIN hash is fetched from Supabase admin_settings table.
    // The actual PIN is never stored anywhere — only its SHA-256 hash.
    let cachedPinHash = null;  // populated on first login attempt

    // Brute-force protection state
    let pinFailCount = 0;
    const PIN_MAX_FAILS = 5;
    const PIN_LOCKOUT_MS = 30_000; // 30 seconds
    let pinLockedUntil = 0;

    // ── CONFIG ────────────────────────────────────────────────────
    const TEACHERS = [
      "TGT Computer Science", "Librarian", "PET F", "PET M",
      "PGT Biology", "PGT Chemistry", "PGT Economics", "PGT English",
      "PGT Geography", "PGT Hindi", "PGT History", "PGT Computer Sc.",
      "PGT Mathematics", "PGT Physics", "TGT Art", "TGT Eng-1",
      "TGT Eng-2", "TGT Hindi-1", "TGT Hindi-2", "TGT Punjabi-1",
      "TGT Punjabi-2", "TGT Math-1", "TGT Math-2", "TGT Music",
      "TGT Science", "TGT Social Science", "Automotive Teacher"
    ];
    const CLASSES = [
      "VI-A", "VI-B", "VII-A", "VII-B", "VIII-A", "VIII-B",
      "IX-A", "IX-B", "X-A", "X-B", "XI-Sci", "XI-Hum", "XII-Sci", "XII-Hum"
    ];
    const PERIODS = ["1", "2", "3", "4", "5", "6", "7", "8"];
    const AUTO_REFRESH_SEC = 60;

    // ── SUPABASE CLIENT ───────────────────────────────────────────
    const { createClient } = supabase;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON);

    // ── PIN CRYPTO HELPERS ────────────────────────────────────────
    // Uses the built-in Web Crypto API (SHA-256).
    // The raw PIN is NEVER stored or logged — only its one-way hash.
    async function hashPin(pin) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fetch stored hash from Supabase admin_settings; cache in memory.
    async function getPinHash(forceRefresh = false) {
      if (cachedPinHash && !forceRefresh) return cachedPinHash;
      const { data, error } = await db
        .from('admin_settings')
        .select('value')
        .eq('key', 'pin_hash')
        .single();
      // Fallback = SHA-256('1234') when table row is absent
      cachedPinHash = (!error && data)
        ? data.value
        : '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
      return cachedPinHash;
    }

    // ── APP STATE ─────────────────────────────────────────────────
    let countdownSec = AUTO_REFRESH_SEC;
    let refreshTimer = null;

    // ── INACTIVITY AUTO-LOCK ──────────────────────────────────────
    const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
    let inactivityTimer = null;

    function resetInactivityTimer() {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(lockDashboard, INACTIVITY_MS);
    }

    function startInactivityWatch() {
      ['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev =>
        document.addEventListener(ev, resetInactivityTimer, { passive: true, capture: true })
      );
      resetInactivityTimer();
    }

    function stopInactivityWatch() {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
      ['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev =>
        document.removeEventListener(ev, resetInactivityTimer, { capture: true })
      );
    }


    // ── DARK MODE ─────────────────────────────────────────────────
    function applyTheme(t) {
      document.documentElement.setAttribute('data-theme', t);
      const icon = t === 'dark' ? '☀️' : '🌙';
      ['pinThemeBtn', 'appThemeBtn'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = icon;
      });
      const tc = document.getElementById('themeColor'); if (tc) tc.setAttribute('content', t === 'dark' ? '#0f1117' : '#1a3a5c');
      localStorage.setItem('theme', t);
    }
    function toggleTheme() {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    }
    applyTheme(localStorage.getItem('theme') || 'light');

    // ── CLOCK ─────────────────────────────────────────────────────
    setInterval(() => {
      const el = document.getElementById('hdrClock');
      if (!el) return;
      const now = new Date();
      el.textContent = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) +
        '  ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }, 1000);

    // ── AUTO-REFRESH ──────────────────────────────────────────────
    function startAutoRefresh() {
      stopAutoRefresh();
      countdownSec = AUTO_REFRESH_SEC;
      refreshTimer = setInterval(() => {
        countdownSec--;
        const bar = document.getElementById('refreshBar');
        const lbl = document.getElementById('countdownLbl');
        if (bar) bar.style.width = (countdownSec / AUTO_REFRESH_SEC * 100) + '%';
        if (lbl) lbl.textContent = countdownSec + 's';
        if (countdownSec <= 0) { countdownSec = AUTO_REFRESH_SEC; loadDaily(true); }
      }, 1000);
    }
    function stopAutoRefresh() {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    }

    // ── IST DATE HELPERS ──────────────────────────────────────────
    // IST = UTC + 5:30
    function todayIST() {
      const now = new Date();
      const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      return ist.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    function fmtDate(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    // Returns [ISO start, ISO end] for a given YYYY-MM-DD date in IST
    function istDayRange(dateStr) {
      return [dateStr + 'T00:00:00+05:30', dateStr + 'T23:59:59+05:30'];
    }
    function istWeekRange(weekStartStr) {
      const start = weekStartStr + 'T00:00:00+05:30';
      const d = new Date(weekStartStr); d.setDate(d.getDate() + 6);
      const end = fmtDate(d) + 'T23:59:59+05:30';
      return [start, end];
    }
    function istMonthRange(monthStr) {
      const [y, m] = monthStr.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return [monthStr + '-01T00:00:00+05:30', monthStr + '-' + String(lastDay).padStart(2, '0') + 'T23:59:59+05:30'];
    }
    function formatDateLabel(v) {
      const p = (v || '').split('-').map(Number);
      if (p.length !== 3 || p.some(n => !n)) return '--/--/----';
      return String(p[2]).padStart(2, '0') + '/' + String(p[1]).padStart(2, '0') + '/' + p[0];
    }
    function formatMonthLabel(v) {
      const p = (v || '').split('-').map(Number);
      if (p.length !== 2 || p.some(n => !n)) return '----';
      return new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
    function updateDateDisplays() {
      document.getElementById('dateDisplay').textContent = formatDateLabel(document.getElementById('dateSelect').value);
      document.getElementById('weekDisplay').textContent = 'Week of ' + formatDateLabel(document.getElementById('weekStart').value);
      document.getElementById('monthDisplay').textContent = formatMonthLabel(document.getElementById('monthSelect').value);
    }

    // ── AGGREGATION HELPERS ───────────────────────────────────────
    const rowSum = r => (r.present || 0) + (r.leave_count || 0) + (r.od || 0) + (r.absent || 0) + (r.tca || 0) + (r.nr || 0) + (r.sick || 0);
    const isTaken = r => String(r.taken).trim().toLowerCase() === 'yes';

    function aggregateDaily(rows, teacherFilter) {
      const scope = teacherFilter ? [teacherFilter] : TEACHERS;
      const taken = rows.filter(isTaken);
      const mathErr = taken.filter(r => rowSum(r) !== (r.total || 0));
      const submitted = new Set(rows.map(r => r.teacher));
      const missing = scope.filter(t => !submitted.has(t));
      const totalP = taken.reduce((a, r) => a + (r.present || 0), 0);
      const totalS = taken.reduce((a, r) => a + (r.total || 0), 0);

      // Period counts
      const periodCounts = {};
      PERIODS.forEach(p => periodCounts[p] = 0);
      rows.forEach(r => { if (periodCounts[r.period] !== undefined) periodCounts[r.period]++; });

      // Teacher perf
      const perf = {};
      scope.forEach(t => perf[t] = { total: 0, taken: 0, mathErrors: 0, absent: 0, classes: {} });
      rows.forEach(r => {
        const t = r.teacher, c = r.class;
        if (!perf[t]) perf[t] = { total: 0, taken: 0, mathErrors: 0, absent: 0, classes: {} };
        perf[t].total++;
        if (isTaken(r)) {
          perf[t].taken++; perf[t].absent += (r.absent || 0);
          if (!perf[t].classes[c]) perf[t].classes[c] = { taken: 0, p: 0, a: 0, l: 0, od: 0, tca: 0, nr: 0, s: 0 };
          const cc = perf[t].classes[c];
          cc.taken++; cc.p += (r.present || 0); cc.a += (r.absent || 0); cc.l += (r.leave_count || 0);
          cc.od += (r.od || 0); cc.tca += (r.tca || 0); cc.nr += (r.nr || 0); cc.s += (r.sick || 0);
          if (rowSum(r) !== (r.total || 0)) perf[t].mathErrors++;
        }
      });

      // Class data
      const clsData = {};
      CLASSES.forEach(c => clsData[c] = { present: 0, absent: 0, leave: 0, total: 0, count: 0 });
      rows.forEach(r => {
        const c = r.class;
        if (!clsData[c]) clsData[c] = { present: 0, absent: 0, leave: 0, total: 0, count: 0 };
        if (isTaken(r)) {
          clsData[c].present += (r.present || 0); clsData[c].absent += (r.absent || 0);
          clsData[c].leave += (r.leave_count || 0); clsData[c].total += (r.total || 0); clsData[c].count++;
        }
      });

      // Heatmap
      const heatmap = {};
      rows.forEach(r => { const k = r.teacher + '||' + r.period; heatmap[k] = (heatmap[k] || 0) + 1; });

      // Submissions for table
      const submissions = rows.map(r => ({
        teacher: r.teacher, period: r.period, cls: r.class, subject: r.subject, taken: isTaken(r),
        total: r.total || 0, present: r.present || 0, absent: r.absent || 0, leave: r.leave_count || 0,
        od: r.od || 0, tca: r.tca || 0, nr: r.nr || 0, sick: r.sick || 0,
        mathOk: !isTaken(r) || rowSum(r) === (r.total || 0),
        time: new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        reason: r.reason || ''
      }));

      // Errors
      const errors = rows.filter(r => isTaken(r) && rowSum(r) !== (r.total || 0)).map(r => ({
        date: new Date(r.created_at).toLocaleDateString('en-IN'),
        teacher: r.teacher, period: r.period, cls: r.class,
        total: r.total, sum: rowSum(r), diff: rowSum(r) - (r.total || 0)
      }));

      return {
        kpis: [
          { val: rows.length, lbl: 'Submissions Today' },
          { val: taken.length, lbl: 'Classes Taken' },
          { val: missing.length, lbl: 'Teachers Missing' },
          { val: mathErr.length, lbl: 'Math Errors' },
          { val: (totalS ? Math.round(totalP / totalS * 100) : 0) + '%', lbl: 'Avg Attendance' }
        ],
        submissions, periodCounts,
        perf: Object.entries(perf).map(([name, p]) => ({ name, ...p, pct: p.total ? Math.round(p.taken / p.total * 100) : 0 })).sort((a, b) => b.pct - a.pct),
        clsData: CLASSES.map(c => ({ cls: c, ...clsData[c], pct: clsData[c].total ? Math.round(clsData[c].present / clsData[c].total * 100) : 0 })),
        heatmap, missing, errors
      };
    }

    function aggregateWeekly(rows, weekStartStr) {
      const taken = rows.filter(isTaken);
      const mathErrs = taken.filter(r => rowSum(r) !== (r.total || 0));
      const submitted = new Set(rows.map(r => r.teacher));
      const dayMap = {};
      const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStartStr + 'T00:00:00'); d.setDate(d.getDate() + i);
        const key = fmtDate(d); dayMap[key] = { label: DAY[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'), count: 0 };
      }
      rows.forEach(r => { const k = fmtDate(new Date(r.created_at)); if (dayMap[k]) dayMap[k].count++; });
      const uniqueDays = new Set(rows.map(r => fmtDate(new Date(r.created_at))));
      const totalP = taken.reduce((a, r) => a + (r.present || 0), 0);
      const totalS = taken.reduce((a, r) => a + (r.total || 0), 0);
      const perf = {}; TEACHERS.forEach(t => perf[t] = { total: 0, taken: 0, absent: 0, mathErrors: 0 });
      rows.forEach(r => { const t = r.teacher; if (!perf[t]) perf[t] = { total: 0, taken: 0, absent: 0, mathErrors: 0 }; perf[t].total++; if (isTaken(r)) { perf[t].taken++; perf[t].absent += (r.absent || 0); if (rowSum(r) !== (r.total || 0)) perf[t].mathErrors++; } });
      const clsData = {}; CLASSES.forEach(c => clsData[c] = { present: 0, absent: 0, leave: 0, total: 0, count: 0 });
      rows.forEach(r => { const c = r.class; if (!clsData[c]) clsData[c] = { present: 0, absent: 0, leave: 0, total: 0, count: 0 }; if (isTaken(r)) { clsData[c].present += (r.present || 0); clsData[c].absent += (r.absent || 0); clsData[c].leave += (r.leave_count || 0); clsData[c].total += (r.total || 0); clsData[c].count++; } });
      return {
        kpis: [{ val: rows.length, lbl: 'Submissions' }, { val: taken.length, lbl: 'Classes Taken' }, { val: submitted.size, lbl: 'Active Teachers' }, { val: uniqueDays.size, lbl: 'School Days' }, { val: mathErrs.length, lbl: 'Math Errors' }, { val: (totalS ? Math.round(totalP / totalS * 100) : 0) + '%', lbl: 'Avg Attendance' }],
        dayTrend: Object.values(dayMap),
        perf: Object.entries(perf).map(([name, p]) => ({ name, ...p, pct: p.total ? Math.round(p.taken / p.total * 100) : 0 })).sort((a, b) => b.pct - a.pct),
        clsData: CLASSES.map(c => ({ cls: c, ...clsData[c], pct: clsData[c].total ? Math.round(clsData[c].present / clsData[c].total * 100) : 0 }))
      };
    }

    function aggregateMonthly(rows) {
      const taken = rows.filter(isTaken), notTaken = rows.filter(r => !isTaken(r));
      const mathErrs = taken.filter(r => rowSum(r) !== (r.total || 0));
      const uniqueDays = new Set(rows.map(r => fmtDate(new Date(r.created_at))));
      const totalP = taken.reduce((a, r) => a + (r.present || 0), 0);
      const totalS = taken.reduce((a, r) => a + (r.total || 0), 0);
      // Daily trend
      const dailyMap = {};
      rows.forEach(r => { const k = fmtDate(new Date(r.created_at)); if (!dailyMap[k]) dailyMap[k] = { p: 0, t: 0 }; if (isTaken(r)) { dailyMap[k].p += (r.present || 0); dailyMap[k].t += (r.total || 0); } });
      const dailyTrend = Object.keys(dailyMap).sort().map(k => ({ label: k, pct: dailyMap[k].t ? Math.round(dailyMap[k].p / dailyMap[k].t * 100) : 0 }));
      // Weekly trend within month
      const weekMap = {};
      rows.forEach(r => { const d = new Date(r.created_at); const mon = new Date(d); mon.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); const wk = 'Wk ' + fmtDate(mon); if (!weekMap[wk]) weekMap[wk] = 0; weekMap[wk]++; });
      const weekTrend = Object.entries(weekMap).map(([label, count]) => ({ label, count }));
      const perf = {}; TEACHERS.forEach(t => perf[t] = { total: 0, taken: 0, absent: 0, mathErrors: 0 });
      rows.forEach(r => { const t = r.teacher; if (!perf[t]) perf[t] = { total: 0, taken: 0, absent: 0, mathErrors: 0 }; perf[t].total++; if (isTaken(r)) { perf[t].taken++; perf[t].absent += (r.absent || 0); if (rowSum(r) !== (r.total || 0)) perf[t].mathErrors++; } });
      const clsData = {}; CLASSES.forEach(c => clsData[c] = { present: 0, absent: 0, leave: 0, total: 0, count: 0 });
      rows.forEach(r => { const c = r.class; if (!clsData[c]) clsData[c] = { present: 0, absent: 0, leave: 0, total: 0, count: 0 }; if (isTaken(r)) { clsData[c].present += (r.present || 0); clsData[c].absent += (r.absent || 0); clsData[c].leave += (r.leave_count || 0); clsData[c].total += (r.total || 0); clsData[c].count++; } });
      return {
        kpis: [{ val: rows.length, lbl: 'Submissions' }, { val: taken.length, lbl: 'Classes Taken' }, { val: notTaken.length, lbl: 'Not Taken' }, { val: uniqueDays.size, lbl: 'School Days' }, { val: mathErrs.length, lbl: 'Math Errors' }, { val: (totalS ? Math.round(totalP / totalS * 100) : 0) + '%', lbl: 'Avg Attendance' }],
        weekTrend, dailyTrend,
        perf: Object.entries(perf).map(([name, p]) => ({ name, ...p, pct: p.total ? Math.round(p.taken / p.total * 100) : 0 })).sort((a, b) => b.pct - a.pct),
        clsData: CLASSES.map(c => ({ cls: c, ...clsData[c], pct: clsData[c].total ? Math.round(clsData[c].present / clsData[c].total * 100) : 0 }))
      };
    }

    // ── SUPABASE FETCH (always fresh — no cache) ──────────────────
    async function fetchRows(startISO, endISO, teacherFilter) {
      let q = db.from('attendance').select('*').gte('created_at', startISO).lte('created_at', endISO);
      if (teacherFilter) q = q.eq('teacher', teacherFilter);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    // ── PIN LOGIC ─────────────────────────────────────────────────
    document.getElementById('pinBtn').addEventListener('click', tryPin);
    document.getElementById('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') tryPin(); });
    setTimeout(() => document.getElementById('pinInput').focus(), 100);

    async function tryPin() {
      const inp = document.getElementById('pinInput');
      const btn = document.getElementById('pinBtn');
      const err = document.getElementById('pinErr');
      const val = inp.value.trim();
      if (!val) return;

      // Brute-force lockout check
      const now = Date.now();
      if (now < pinLockedUntil) {
        const secsLeft = Math.ceil((pinLockedUntil - now) / 1000);
        err.textContent = `🔒 Too many failed attempts. Try again in ${secsLeft}s.`;
        err.style.display = 'block';
        inp.value = '';
        return;
      }

      err.style.display = 'none';
      btn.textContent = 'Verifying…'; btn.disabled = true;

      try {
        const entered = await hashPin(val);
        const stored  = await getPinHash();
        if (entered !== stored) {
          pinFailCount++;
          inp.value = ''; inp.style.border = '2px solid var(--red)';
          if (pinFailCount >= PIN_MAX_FAILS) {
            pinLockedUntil = Date.now() + PIN_LOCKOUT_MS;
            pinFailCount = 0;
            err.textContent = `🔒 Too many failed attempts. Locked for ${PIN_LOCKOUT_MS / 1000}s.`;
          } else {
            const remaining = PIN_MAX_FAILS - pinFailCount;
            err.textContent = `❌ Wrong PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`;
          }
          err.style.display = 'block';
          btn.textContent = 'Open Dashboard →'; btn.disabled = false;
          setTimeout(() => inp.focus(), 50);
          return;
        }
        // Successful login — reset fail counter
        pinFailCount = 0;
        pinLockedUntil = 0;
        inp.style.border = '';
        btn.textContent = 'Opening…';
        await initApp();
      } catch (e) {
        err.textContent = '❌ ' + e.message; err.style.display = 'block';
      }
      btn.textContent = 'Open Dashboard →'; btn.disabled = false;
    }

    function lockDashboard() {
      stopAutoRefresh();
      stopInactivityWatch();
      cachedPinHash = null; // force fresh fetch from DB on next login
      document.getElementById('app').style.display = 'none';
      document.getElementById('pinScreen').style.display = 'flex';
      const inp = document.getElementById('pinInput');
      inp.value = ''; inp.style.border = '';
      document.getElementById('pinErr').style.display = 'none';
      setTimeout(() => inp.focus(), 50);
    }

    // ── CHANGE PIN ──────────────────────────────────────────────
    function openChangePinModal() {
      // Clear all fields and messages
      ['cpCurrent','cpNew','cpConfirm'].forEach(id => {
        const el = document.getElementById(id);
        el.value = '';
        el.style.borderColor = '';
      });
      document.getElementById('cpCurrentErr').textContent = '';
      document.getElementById('cpErr').textContent = '';
      const suc = document.getElementById('cpSuccess');
      suc.style.display = 'none'; suc.textContent = '';
      document.getElementById('cpSaveBtn').disabled = false;
      document.getElementById('cpSaveBtn').textContent = '💾 Save New PIN';
      document.getElementById('changePinModal').style.display = 'flex';
      setTimeout(() => document.getElementById('cpCurrent').focus(), 80);
    }

    function closeChangePinModal() {
      document.getElementById('changePinModal').style.display = 'none';
    }

    async function saveNewPin() {
      const currentVal = document.getElementById('cpCurrent').value.trim();
      const newVal     = document.getElementById('cpNew').value.trim();
      const confirmVal = document.getElementById('cpConfirm').value.trim();
      const errEl      = document.getElementById('cpErr');
      const currErrEl  = document.getElementById('cpCurrentErr');
      const sucEl      = document.getElementById('cpSuccess');
      const btn        = document.getElementById('cpSaveBtn');

      // Clear previous messages
      errEl.textContent = '';
      currErrEl.textContent = '';
      sucEl.style.display = 'none';

      // Basic presence checks before any async work
      if (!currentVal) { currErrEl.textContent = '⚠️ Enter your current PIN'; document.getElementById('cpCurrent').focus(); return; }
      if (!newVal)     { errEl.textContent = '⚠️ Enter a new PIN'; document.getElementById('cpNew').focus(); return; }
      if (newVal.length < 4) { errEl.textContent = '⚠️ PIN must be at least 4 characters'; return; }
      if (newVal !== confirmVal) { errEl.textContent = '❌ PINs do not match'; document.getElementById('cpConfirm').focus(); return; }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Verifying...';

      try {
        // Hash current PIN and verify against stored hash (always fresh from DB)
        const currentHash = await hashPin(currentVal);
        const storedHash  = await getPinHash(true); // force-refresh from DB

        if (currentHash !== storedHash) {
          currErrEl.textContent = '❌ Wrong current PIN';
          document.getElementById('cpCurrent').value = '';
          document.getElementById('cpCurrent').focus();
          btn.disabled = false;
          btn.textContent = '💾 Save New PIN';
          return;
        }

        // Check new PIN ≠ current PIN
        const newHash = await hashPin(newVal);
        if (newHash === storedHash) {
          errEl.textContent = '⚠️ New PIN must be different from current PIN';
          btn.disabled = false;
          btn.textContent = '💾 Save New PIN';
          return;
        }

        btn.innerHTML = '<span class="spinner"></span> Saving...';

        // Upsert the new hash into Supabase admin_settings
        const { error: dbErr } = await db
          .from('admin_settings')
          .upsert(
            { key: 'pin_hash', value: newHash, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          );

        if (dbErr) throw dbErr;

        // Update in-memory cache
        cachedPinHash = newHash;

        // Show success & auto-close
        btn.textContent = '✅ PIN Changed!';
        sucEl.textContent = '🔐 PIN updated successfully! Encrypted hash stored securely in the database.';
        sucEl.style.display = 'block';
        sucEl.style.padding = '8px 12px';
        setTimeout(() => closeChangePinModal(), 2400);

      } catch (e) {
        errEl.textContent = '❌ Error: ' + e.message;
        btn.disabled = false;
        btn.textContent = '💾 Save New PIN';
      }
    }

    // ── INIT ──────────────────────────────────────────────────────
    async function initApp() {
      const today = todayIST();
      document.getElementById('dateSelect').value = today;
      const now = new Date(), day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      document.getElementById('weekStart').value = fmtDate(mon);
      document.getElementById('monthSelect').value = today.slice(0, 7);
      updateDateDisplays();

      const sel = document.getElementById('teacherFilter');
      if (sel.options.length <= 1) {
        TEACHERS.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o); });
      }

      document.getElementById('pinScreen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      await loadDaily(true);
      startAutoRefresh();
      startInactivityWatch();
      checkPendingBadge(); // show pending badge on Approvals tab if any
    }

    // ── TABS ──────────────────────────────────────────────────────
    function switchTab(id, btn) {
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('tab-' + id).classList.add('active');
      btn.classList.add('active');
    }
    function filterTbl(tblId, q) {
      const tbl = document.getElementById(tblId);
      if (!tbl) return;
      tbl.querySelectorAll('tbody tr.dr').forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
      });
    }

    // ── DAILY LOAD ────────────────────────────────────────────────
    async function loadDaily(forceRefresh = false) {
      const btn = document.getElementById('syncBtn');
      const icon = document.getElementById('syncIcon');
      const date = document.getElementById('dateSelect').value;
      const teacher = document.getElementById('teacherFilter').value;
      updateDateDisplays();
      btn.disabled = true; icon.innerHTML = '<span class="spinner"></span>';
      document.getElementById('lastSync').textContent = 'Loading...';
      ['todayBody', 'teacherBody', 'classBody', 'heatmapBody', 'errorBody'].forEach(id =>
        document.getElementById(id).innerHTML = '<div class="empty"><div class="empty-icon">⏳</div>Fetching fresh data...</div>');
      if (forceRefresh) { countdownSec = AUTO_REFRESH_SEC; }
      try {
        const [start, end] = istDayRange(date);
        const rows = await fetchRows(start, end, teacher);
        const d = aggregateDaily(rows, teacher);
        renderKpis(d.kpis, 'kpiGrid');
        renderTodayTable(d.submissions);
        renderPeriodBars(d.periodCounts);
        renderTeacherTable(d.perf);
        renderClassTable(d.clsData, 'classBody');
        renderHeatmap(d.heatmap, rows);
        renderErrorTable(d.errors);
        renderMissingBanner(d.missing);
        document.getElementById('lastSync').textContent = '✓ ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        ['todayBody', 'teacherBody', 'classBody', 'heatmapBody', 'errorBody'].forEach(id =>
          document.getElementById(id).innerHTML = `<div class="empty"><div class="empty-icon">❌</div><div style="font-size:12px;color:var(--red)">${e.message}</div></div>`);
        document.getElementById('lastSync').textContent = '✗ Failed';
      }
      btn.disabled = false; icon.textContent = '↻';
    }

    // ── WEEKLY ────────────────────────────────────────────────────
    async function loadWeeklyTab() {
      const ws = document.getElementById('weekStart').value;
      if (!ws) return;
      updateDateDisplays();
      document.getElementById('weeklyTeacherBody').innerHTML = '<div class="empty"><div class="empty-icon">⏳</div>Loading...</div>';
      try {
        const [start, end] = istWeekRange(ws);
        const rows = await fetchRows(start, end, '');
        const d = aggregateWeekly(rows, ws);
        renderKpis(d.kpis, 'weeklyKpis');
        renderBars(d.dayTrend, 'label', 'count', 'weeklyDayBars', 'var(--blue2)');
        renderPerfTable(d.perf, 'weeklyTbl', 'weeklyTeacherBody');
        renderClsTable(d.clsData, 'weeklyClassBody');
      } catch (e) {
        document.getElementById('weeklyTeacherBody').innerHTML = `<div class="empty">❌ ${e.message}</div>`;
      }
    }
    function shiftWeek(dir) {
      const d = new Date(document.getElementById('weekStart').value);
      d.setDate(d.getDate() + dir * 7);
      document.getElementById('weekStart').value = fmtDate(d);
      updateDateDisplays(); loadWeeklyTab();
    }

    // ── MONTHLY ───────────────────────────────────────────────────
    async function loadMonthlyTab() {
      const mv = document.getElementById('monthSelect').value;
      if (!mv) return;
      updateDateDisplays();
      document.getElementById('monthlyTeacherBody').innerHTML = '<div class="empty"><div class="empty-icon">⏳</div>Loading...</div>';
      try {
        const [start, end] = istMonthRange(mv);
        const rows = await fetchRows(start, end, '');
        const d = aggregateMonthly(rows);
        renderKpis(d.kpis, 'monthlyKpis');
        renderBars(d.weekTrend, 'label', 'count', 'monthlyWeekBars', 'var(--teal)');
        renderBars(d.dailyTrend, 'label', 'pct', 'monthlyDailyTrend', 'var(--blue)');
        renderPerfTable(d.perf, 'monthlyTbl', 'monthlyTeacherBody');
        renderClsTable(d.clsData, 'monthlyClassBody');
      } catch (e) {
        document.getElementById('monthlyTeacherBody').innerHTML = `<div class="empty">❌ ${e.message}</div>`;
      }
    }
    function shiftMonth(dir) {
      const val = document.getElementById('monthSelect').value;
      const [y, m] = val.split('-').map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      document.getElementById('monthSelect').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      updateDateDisplays(); loadMonthlyTab();
    }

    // ── RENDER HELPERS ────────────────────────────────────────────
    function renderMissingBanner(missing) {
      const banner = document.getElementById('missingBanner');
      if (!missing || !missing.length) { banner.style.display = 'none'; return; }
      banner.style.display = '';
      document.getElementById('missingTags').innerHTML = missing.map(t => `<span class="missing-tag">${t}</span>`).join('');
    }

    function renderKpis(kpis, targetId) {
      const colors = ['blue', 'teal', 'ok', 'amber', 'red'];
      document.getElementById(targetId).innerHTML = kpis.map((k, i) =>
        `<div class="kpi ${colors[i % colors.length]}"><div class="kpi-val">${k.val}</div><div class="kpi-lbl">${k.lbl}</div></div>`
      ).join('');
    }

    function renderTodayTable(rows) {
      if (!rows.length) { document.getElementById('todayBody').innerHTML = '<div class="empty"><div class="empty-icon">📭</div>No submissions yet for this date.</div>'; return; }
      let h = `<table id="todayTbl"><thead><tr>
    <th>#</th><th>Teacher</th><th>Prd</th><th>Class</th><th>Subject</th>
    <th>Taken</th><th>Total</th><th>Present</th><th>Absent</th>
    <th>Leave</th><th>OD</th><th>TCA</th><th>NR</th><th>Sick</th>
    <th>Math</th><th>Time</th></tr></thead><tbody>`;
      rows.forEach((r, i) => {
        const tp = r.taken ? '<span class="pill pill-ok">Yes</span>' : '<span class="pill pill-warn">No</span>';
        const mp = !r.taken ? '<span class="pill pill-gray">N/A</span>' : r.mathOk ? '<span class="pill pill-ok">✅</span>' : '<span class="pill pill-err">❌</span>';
        h += `<tr class="dr"><td>${i + 1}</td><td><b>${r.teacher}</b></td>
      <td style="text-align:center"><b>${r.period}</b></td>
      <td>${r.cls}</td><td>${r.subject}</td><td>${tp}</td>
      <td>${r.total || ''}</td>
      <td style="color:var(--ok);font-weight:600">${r.present || ''}</td>
      <td style="color:var(--red)">${r.absent || ''}</td>
      <td>${r.leave || ''}</td><td>${r.od || ''}</td>
      <td>${r.tca || ''}</td><td>${r.nr || ''}</td><td>${r.sick || ''}</td>
      <td>${mp}</td>
      <td style="color:var(--muted);font-size:12px">${r.time || ''}</td></tr>`;
      });
      document.getElementById('todayBody').innerHTML = h + '</tbody></table>';
    }

    function renderPeriodBars(counts) {
      const vals = PERIODS.map(p => counts[p] || 0);
      const max = Math.max(...vals, 1);
      let h = '<div style="display:flex;flex-direction:column;gap:7px">';
      PERIODS.forEach((p, i) => {
        const w = Math.round(vals[i] / max * 100);
        h += `<div style="display:flex;align-items:center;gap:8px">
      <div style="width:52px;font-weight:700;font-family:var(--fh);color:var(--blue);font-size:13px">Prd ${p}</div>
      <div style="flex:1;background:var(--border);border-radius:5px;height:22px;overflow:hidden">
        <div style="width:${w}%;background:var(--blue2);height:100%;border-radius:5px;
             display:flex;align-items:center;padding-left:6px;color:#fff;font-size:11px;
             font-weight:700;transition:width .6s">${vals[i]}</div>
      </div></div>`;
      });
      document.getElementById('periodBars').innerHTML = h + '</div>';
    }

    function renderTeacherTable(perf) {
      let idx = 0;
      let h = `<div style="margin-bottom:8px">
    <button class="expand-btn" onclick="expandAll(true)">▼ Expand All</button>
    &nbsp;<button class="expand-btn" onclick="expandAll(false)">▲ Collapse All</button></div>
    <table id="teacherTbl"><thead><tr>
    <th>Rank</th><th>Teacher</th><th>Taken %</th><th>Taken</th><th>Total</th>
    <th>Errors</th><th>Details</th></tr></thead><tbody>`;
      perf.forEach((p, i) => {
        const pct = p.pct, bc = pct >= 90 ? 'pbar-hi' : pct >= 75 ? 'pbar-mid' : 'pbar-lo';
        const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        const uid = idx++;
        let det = '';
        if (p.classes) {
          Object.entries(p.classes).forEach(([cls, d]) => {
            det += `<tr><td><b>${cls}</b></td><td>${d.taken}</td>
        <td style="color:var(--ok)">${d.p}</td><td style="color:var(--red)">${d.a}</td>
        <td>${d.l}</td><td>${d.od}</td><td>${d.tca}</td><td>${d.nr}</td><td>${d.s}</td></tr>`;
          });
        }
        h += `<tr class="dr">
      <td style="text-align:center">${rank}</td><td><b>${p.name}</b></td>
      <td><div class="pbar ${bc}"><div class="pbar-fill" style="width:${pct}%"></div></div><b>${pct}%</b></td>
      <td>${p.taken}</td><td>${p.total}</td>
      <td>${p.mathErrors > 0 ? `<span class="pill pill-err">${p.mathErrors}</span>` : '<span class="pill pill-ok">0</span>'}</td>
      <td><button class="expand-btn" onclick="toggleDet(this,${uid})">▼</button></td></tr>
    <tr class="detail-row" id="dr-${uid}"><td colspan="7">
      <div class="detail-inner"><table><thead><tr>
        <th>Class</th><th>Taken</th><th>P</th><th>A</th><th>L</th><th>OD</th><th>TCA</th><th>NR</th><th>S</th>
      </tr></thead><tbody>${det || '<tr><td colspan="9" style="text-align:center;color:var(--muted)">No data</td></tr>'}</tbody></table></div>
    </td></tr>`;
      });
      document.getElementById('teacherBody').innerHTML = h + '</tbody></table>';
    }

    function renderClassTable(clsData, targetId) {
      let h = `<table><thead><tr><th>Class</th><th>Periods</th><th>Avg %</th>
    <th>Present</th><th>Absent</th><th>Leave</th></tr></thead><tbody>`;
      clsData.forEach(d => {
        const bc = d.pct >= 90 ? 'pbar-hi' : d.pct >= 75 ? 'pbar-mid' : 'pbar-lo';
        h += `<tr><td><b>${d.cls}</b></td><td>${d.count}</td>
      <td><div class="pbar ${bc}"><div class="pbar-fill" style="width:${d.pct}%"></div></div><b>${d.pct}%</b></td>
      <td style="color:var(--ok);font-weight:600">${d.present}</td>
      <td style="color:var(--red)">${d.absent}</td><td>${d.leave}</td></tr>`;
      });
      document.getElementById(targetId).innerHTML = h + '</tbody></table>';
    }

    function renderHeatmap(heatmap, rows) {
      const maxVal = Math.max(...Object.values(heatmap), 1);
      let h = `<div style="overflow-x:auto"><div class="heatmap-grid"
    style="grid-template-columns:140px repeat(${PERIODS.length},44px)">`;
      h += '<div class="hm-cell hm-hd" style="text-align:left;padding-left:4px">Teacher</div>';
      PERIODS.forEach(p => h += `<div class="hm-cell hm-hd">P${p}</div>`);
      TEACHERS.forEach(t => {
        h += `<div class="hm-cell hm-hd" style="text-align:left;padding-left:4px;font-size:9px;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${t}">${t}</div>`;
        PERIODS.forEach(p => {
          const v = heatmap[t + '||' + p] || 0;
          const cls = v === 0 ? 'hm-0' : v / maxVal < .34 ? 'hm-lo' : v / maxVal < .67 ? 'hm-md' : 'hm-hi';
          h += `<div class="hm-cell ${cls}" title="${t} — P${p}: ${v}">${v || ''}</div>`;
        });
      });
      document.getElementById('heatmapBody').innerHTML = h + '</div></div>';
    }

    function renderErrorTable(errors) {
      if (!errors.length) { document.getElementById('errorBody').innerHTML = '<div class="empty"><div class="empty-icon">✅</div>No math errors today.</div>'; return; }
      let h = `<table><thead><tr><th>Date</th><th>Teacher</th><th>Prd</th>
    <th>Class</th><th>Total</th><th>Sum</th><th>Diff</th></tr></thead><tbody>`;
      errors.forEach(r => {
        const color = r.diff > 0 ? 'var(--red)' : 'var(--blue2)';
        h += `<tr><td>${r.date}</td><td><b>${r.teacher}</b></td>
      <td>${r.period}</td><td>${r.cls}</td><td>${r.total}</td><td>${r.sum}</td>
      <td style="color:${color};font-weight:700">${r.diff > 0 ? '+' : ''}${r.diff}</td></tr>`;
      });
      document.getElementById('errorBody').innerHTML = h + '</tbody></table>';
    }

    function toggleDet(btn, id) {
      const row = document.getElementById('dr-' + id);
      if (!row) return;
      const open = row.style.display !== 'table-row';
      row.style.display = open ? 'table-row' : 'none';
      btn.textContent = open ? '▲' : '▼';
    }
    function expandAll(flag) {
      document.querySelectorAll('.detail-row').forEach(r => r.style.display = flag ? 'table-row' : 'none');
      document.querySelectorAll('.expand-btn[onclick*="toggleDet"]').forEach(b => b.textContent = flag ? '▲' : '▼');
    }

    function renderBars(items, lk, vk, targetId, color) {
      if (!items || !items.length) { document.getElementById(targetId).innerHTML = '<div class="empty">No data</div>'; return; }
      const max = Math.max(...items.map(i => i[vk] || 0), 1);
      let h = '<div style="display:flex;flex-direction:column;gap:6px">';
      items.forEach(it => {
        const w = Math.round((it[vk] || 0) / max * 100);
        h += `<div style="display:flex;align-items:center;gap:7px">
      <div style="width:88px;font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${it[lk]}">${it[lk]}</div>
      <div style="flex:1;background:var(--border);border-radius:5px;height:20px;overflow:hidden">
        <div style="width:${w}%;background:${color};height:100%;border-radius:5px;
             display:flex;align-items:center;padding-left:6px;color:#fff;font-size:11px;
             font-weight:700;transition:width .6s">${it[vk]}</div>
      </div></div>`;
      });
      document.getElementById(targetId).innerHTML = h + '</div>';
    }

    function renderPerfTable(perf, tblId, targetId) {
      let h = `<table id="${tblId}"><thead><tr>
    <th>Rank</th><th>Teacher</th><th>Taken %</th>
    <th>Taken</th><th>Total</th><th>Absent</th><th>Errors</th>
    </tr></thead><tbody>`;
      perf.forEach((p, i) => {
        const pct = p.pct, bc = pct >= 90 ? 'pbar-hi' : pct >= 75 ? 'pbar-mid' : 'pbar-lo';
        const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        h += `<tr class="dr"><td style="text-align:center">${rank}</td><td><b>${p.name}</b></td>
      <td><div class="pbar ${bc}"><div class="pbar-fill" style="width:${pct}%"></div></div><b>${pct}%</b></td>
      <td>${p.taken}</td><td>${p.total}</td>
      <td style="color:var(--red)">${p.absent}</td>
      <td>${p.mathErrors > 0 ? `<span class="pill pill-err">${p.mathErrors}</span>` : '<span class="pill pill-ok">0</span>'}</td></tr>`;
      });
      document.getElementById(targetId).innerHTML = h + '</tbody></table>';
    }

    function renderClsTable(clsData, targetId) {
      let h = `<table><thead><tr><th>Class</th><th>Periods</th><th>Avg %</th>
    <th>Present</th><th>Absent</th><th>Leave</th></tr></thead><tbody>`;
      clsData.forEach(d => {
        const bc = d.pct >= 90 ? 'pbar-hi' : d.pct >= 75 ? 'pbar-mid' : 'pbar-lo';
        h += `<tr><td><b>${d.cls}</b></td><td>${d.count}</td>
      <td><div class="pbar ${bc}"><div class="pbar-fill" style="width:${d.pct}%"></div></div><b>${d.pct}%</b></td>
      <td style="color:var(--ok);font-weight:600">${d.present}</td>
      <td style="color:var(--red)">${d.absent}</td><td>${d.leave}</td></tr>`;
      });
      document.getElementById(targetId).innerHTML = h + '</tbody></table>';
    }

    // ═══════════════════════════════════════════════════════════════
    //  TEACHER APPROVALS
    // ═══════════════════════════════════════════════════════════════
    const ALL_CLASSES = [
      "VI-A","VI-B","VII-A","VII-B","VIII-A","VIII-B",
      "IX-A","IX-B","X-A","X-B","XI-Sci","XI-Hum","XII-Sci","XII-Hum"
    ];
    const ALL_SUBJECTS = [
      "Art","Biology","Chemistry","Computer","Economics","English",
      "Geography","Hindi","History","Library","Hindi/Punjabi",
      "Mathematics","Music","Physical Education","Physics","Science",
      "Social Science","SUPW","3rd Language","G.S. / G.F.C",
      "SEWA / WE","ICT (Comp. Lab)","Vocational Education","Hindi/CS",
      "IT/Automotive","Computer Science","Math/Biology",
      "Art Education (Music)","Art Education (Drawing)","Automotive"
    ];

    let allProfiles = [];
    let approvalFilter = 'all';
    let editingProfileId = null;

    async function loadApprovals() {
      document.getElementById('approvalsBody').innerHTML =
        '<div class="empty"><div class="empty-icon">⏳</div>Loading teacher profiles...</div>';
      try {
        // Use Supabase service key is not available on frontend;
        // We use the anon key but add a wide-open SELECT policy for admin
        // Admin dashboard already has PIN protection.
        const { data, error } = await db
          .from('teacher_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        allProfiles = data || [];

        // Update pending badge
        const pending = allProfiles.filter(p => !p.approved).length;
        const badge = document.getElementById('pendingBadge');
        if (pending > 0) {
          badge.textContent = pending;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }

        renderApprovals();
      } catch (e) {
        document.getElementById('approvalsBody').innerHTML =
          `<div class="empty"><div class="empty-icon">❌</div><div style="color:var(--red);font-size:12px">Error: ${e.message}<br><br><b>Note:</b> The dashboard needs a SELECT policy on teacher_profiles for anon role. Run this in Supabase SQL Editor:<br><code style="font-size:10px;background:var(--card2);padding:4px 8px;border-radius:4px;display:block;margin-top:6px">CREATE POLICY "allow_admin_select" ON teacher_profiles FOR SELECT TO anon USING (true);<br>CREATE POLICY "allow_admin_update" ON teacher_profiles FOR UPDATE TO anon USING (true) WITH CHECK (true);</code></div></div>`;
      }
    }

    function setApprovalFilter(f, btn) {
      approvalFilter = f;
      document.querySelectorAll('.approval-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderApprovals();
    }

    function renderApprovals() {
      let profiles = allProfiles;
      if (approvalFilter === 'pending')  profiles = profiles.filter(p => !p.approved);
      if (approvalFilter === 'approved') profiles = profiles.filter(p => p.approved);

      if (!profiles.length) {
        document.getElementById('approvalsBody').innerHTML =
          `<div class="empty"><div class="empty-icon">${approvalFilter === 'pending' ? '🎉' : '📭'}</div>${approvalFilter === 'pending' ? 'No pending approvals!' : 'No teachers found.'}</div>`;
        return;
      }

      const html = profiles.map(p => {
        const statusClass = p.approved ? 'approved' : 'pending';
        const statusPill = p.approved
          ? '<span class="pill pill-ok">✅ Approved</span>'
          : '<span class="pill pill-warn">⏳ Pending</span>';
        const classTags = (p.classes || []).map(c =>
          `<span class="tc-tag cls">${c}</span>`).join('');
        const subjectTags = (p.subjects || []).slice(0,4).map(s =>
          `<span class="tc-tag">${s}</span>`).join('') +
          ((p.subjects||[]).length > 4 ? `<span class="tc-tag">+${p.subjects.length-4} more</span>` : '');
        const regDate = new Date(p.created_at).toLocaleDateString('en-IN',
          {day:'2-digit',month:'short',year:'numeric'});

        const actionBtns = p.approved
          ? `<button class="tc-btn revoke" onclick="setApproval('${p.id}',false,this)">🚫 Revoke</button>
             <button class="tc-btn edit"   onclick="openEdit('${p.id}')">✏️ Edit</button>
             <button class="tc-btn reset"  onclick="resetTeacherPassword('${p.email}',this)">🔑 Reset Pwd</button>`
          : `<button class="tc-btn approve" onclick="setApproval('${p.id}',true,this)">✅ Approve</button>
             <button class="tc-btn reject"  onclick="setApproval('${p.id}',false,this)" style="opacity:.75">🗑 Reject</button>
             <button class="tc-btn edit"    onclick="openEdit('${p.id}')">✏️ Edit</button>
             <button class="tc-btn reset"   onclick="resetTeacherPassword('${p.email}',this)">🔑 Reset Pwd</button>`;

        return `<div class="teacher-card ${statusClass}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
            <div>
              <div class="tc-name">👤 ${p.name}</div>
              <div class="tc-email">${p.email}</div>
            </div>
            ${statusPill}
          </div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Classes</div>
          <div class="tc-tags">${classTags || '<span style="color:var(--muted);font-size:11px">None assigned</span>'}</div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Subjects</div>
          <div class="tc-tags">${subjectTags || '<span style="color:var(--muted);font-size:11px">None assigned</span>'}</div>
          <div class="tc-meta">Registered: ${regDate}</div>
          <div class="tc-actions">${actionBtns}</div>
        </div>`;
      }).join('');

      document.getElementById('approvalsBody').innerHTML =
        `<div class="approval-grid">${html}</div>`;
    }

    async function setApproval(id, approved, btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner spinner-dark"></span>';
      try {
        const { error } = await db
          .from('teacher_profiles')
          .update({ approved })
          .eq('id', id);
        if (error) throw error;
        // Update local state
        const p = allProfiles.find(x => x.id === id);
        if (p) p.approved = approved;
        // Update pending badge
        const pending = allProfiles.filter(p => !p.approved).length;
        const badge = document.getElementById('pendingBadge');
        badge.textContent = pending;
        badge.style.display = pending > 0 ? 'inline-block' : 'none';
        renderApprovals();
      } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
      }
    }

    // ── RESET TEACHER PASSWORD ─────────────────────────────────
    async function resetTeacherPassword(email, btn) {
      if (!confirm(`Send a password reset link to:\n${email}\n\nThe teacher will receive an email with a link to set a new password.`)) return;

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner spinner-dark"></span>';

      try {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/index.html'
        });
        if (error) throw error;

        btn.innerHTML = '✅ Sent!';
        btn.style.background = 'var(--ok)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--ok)';
        // Reset button appearance after 3 seconds
        setTimeout(() => {
          btn.innerHTML = '🔑 Reset Pwd';
          btn.style.background = '';
          btn.style.color = '';
          btn.style.borderColor = '';
          btn.disabled = false;
        }, 3000);

      } catch (e) {
        alert('❌ Failed to send reset email: ' + e.message);
        btn.innerHTML = '🔑 Reset Pwd';
        btn.disabled = false;
      }
    }

    // ── EDIT MODAL ──────────────────────────────────────────────
    function openEdit(id) {
      const p = allProfiles.find(x => x.id === id);
      if (!p) return;
      editingProfileId = id;
      document.getElementById('modalTeacherName').textContent = p.name;
      document.getElementById('modalError').textContent = '';

      // Build class checkboxes
      document.getElementById('modalClasses').innerHTML = ALL_CLASSES.map(c => {
        const on = (p.classes || []).includes(c) ? 'on' : '';
        return `<div class="mcheck ${on}" data-val="${c}" onclick="toggleMcheck(this)">
          <span class="mcheck-dot"></span>${c}</div>`;
      }).join('');

      // Build subject checkboxes
      document.getElementById('modalSubjects').innerHTML = ALL_SUBJECTS.map(s => {
        const on = (p.subjects || []).includes(s) ? 'on' : '';
        return `<div class="mcheck ${on}" data-val="${s}" onclick="toggleMcheck(this)">
          <span class="mcheck-dot"></span>${s}</div>`;
      }).join('');

      document.getElementById('editModal').style.display = 'flex';
    }

    function toggleMcheck(el) { el.classList.toggle('on'); }

    function closeModal(e) {
      if (e && e.target !== document.getElementById('editModal')) return;
      document.getElementById('editModal').style.display = 'none';
      editingProfileId = null;
    }

    async function saveProfile() {
      if (!editingProfileId) return;
      const classes = [...document.querySelectorAll('#modalClasses .mcheck.on')]
        .map(el => el.dataset.val);
      const subjects = [...document.querySelectorAll('#modalSubjects .mcheck.on')]
        .map(el => el.dataset.val);
      const errEl = document.getElementById('modalError');
      const btn = document.getElementById('modalSaveBtn');

      errEl.textContent = '';
      if (classes.length === 0) { errEl.textContent = '⚠️ Select at least one class'; return; }
      if (subjects.length === 0) { errEl.textContent = '⚠️ Select at least one subject'; return; }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Saving...';

      try {
        const { error } = await db
          .from('teacher_profiles')
          .update({ classes, subjects })
          .eq('id', editingProfileId);
        if (error) throw error;
        // Update local
        const p = allProfiles.find(x => x.id === editingProfileId);
        if (p) { p.classes = classes; p.subjects = subjects; }
        document.getElementById('editModal').style.display = 'none';
        editingProfileId = null;
        renderApprovals();
      } catch (e) {
        errEl.textContent = '❌ ' + e.message;
      }
      btn.disabled = false;
      btn.textContent = '💾 Save Changes';
    }

    // ── CHECK FOR PENDING ON DASHBOARD LOAD ────────────────────
    async function checkPendingBadge() {
      try {
        const { data } = await db
          .from('teacher_profiles')
          .select('id, approved')
          .eq('approved', false);
        const pending = (data || []).length;
        const badge = document.getElementById('pendingBadge');
        if (pending > 0) {
          badge.textContent = pending;
          badge.style.display = 'inline-block';
        }
      } catch (_) { /* silently ignore if policy not set */ }
    }
  