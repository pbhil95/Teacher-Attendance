// Initialize Supabase Client
const SUPABASE_URL = 'https://cuvleeayglhpuhouvzts.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dmxlZWF5Z2xocHVob3V2enRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjYxNzgsImV4cCI6MjA5MTUwMjE3OH0.ZTKWwnvSESrSw_h7YCan9RIZxf69mq7tpVmkcIXCG4Y';

function _L(msg) { if (window._log) window._log(msg); }
function _E(msg) { if (window._err) window._err(msg); }

let _dbClient;
try {
  _dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  _L('Supabase client created OK');
} catch(e) {
  _E('Supabase client FAILED: ' + e.message);
}

const db = _dbClient;

window.appAuth = {
  db,
  user: null,
  profile: null,
  initialized: false,
  recoveryMode: false,
  _listeners: [],
  _initDone: false,

  onStateChange(callback) {
    this._listeners.push(callback);
    _L('onStateChange registered. initialized=' + this.initialized);
    if (this.initialized) callback(this.user, this.profile);
  },

  _notify() {
    _L('_notify() called. user=' + (this.user ? this.user.email : 'null') + ' profile=' + (this.profile ? this.profile.name : 'null'));
    this._listeners.forEach(cb => cb(this.user, this.profile));
  },

  async _loadProfile(user) {
    _L('_loadProfile() for user: ' + user.email);
    let { data: profile, error } = await db
      .from('teacher_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) _E('_loadProfile error: ' + error.message + ' code:' + error.code);

    if ((error || !profile) && user.user_metadata?.name) {
      _L('Creating new profile for: ' + user.user_metadata.name);
      const uMeta = user.user_metadata;
      const { data: newProfile, error: insErr } = await db
        .from('teacher_profiles')
        .insert([{
          id: user.id,
          name: uMeta.name,
          email: user.email,
          classes: uMeta.classes || [],
          subjects: uMeta.subjects || [],
          approved: false
        }])
        .select()
        .single();
      if (insErr) _E('Insert profile error: ' + insErr.message);
      profile = newProfile;
    }
    _L('_loadProfile done. profile=' + (profile ? profile.name : 'null'));
    return profile || null;
  },

  async init() {
    _L('init() called. _initDone=' + this._initDone);
    if (this._initDone) { _L('init() skipped (already done)'); return; }
    this._initDone = true;

    try {
      _L('Calling db.auth.getSession()...');
      const { data: { session }, error } = await db.auth.getSession();
      if (error) _E('getSession error: ' + error.message);
      _L('getSession() returned. session=' + (session ? 'EXISTS (user:' + session.user.email + ')' : 'NULL'));

      if (session) {
        this.user = session.user;
        this.profile = await this._loadProfile(session.user);
      } else {
        this.user = null;
        this.profile = null;
      }
    } catch (err) {
      _E('init() CAUGHT: ' + err.message);
      this.user = null;
      this.profile = null;
    }

    this.initialized = true;
    _L('initialized=true. Calling _notify()...');
    this._notify();
    _L('_notify() returned from init().');

    db.auth.onAuthStateChange(async (event, session) => {
      _L('onAuthStateChange event: ' + event);
      if (event === 'INITIAL_SESSION') { _L('INITIAL_SESSION skipped.'); return; }

      if (event === 'SIGNED_OUT') {
        this.user = null;
        this.profile = null;
        this.recoveryMode = false;
        this._notify();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!session) return;
        try {
          this.user = session.user;
          this.profile = await this._loadProfile(session.user);
        } catch (err) {
          _E('onAuthStateChange CAUGHT: ' + err.message);
        }
        this._notify();
      } else if (event === 'PASSWORD_RECOVERY') {
        this.recoveryMode = true;
        if (session) {
          this.user = session.user;
          this.profile = await this._loadProfile(session.user);
        }
        this._notify();
      }
    });
  },

  async login(email, password) {
    return await db.auth.signInWithPassword({ email, password });
  },

  async register(email, password, name, classes, subjects) {
    return await db.auth.signUp({
      email,
      password,
      options: { data: { name, classes, subjects } }
    });
  },

  async resetPassword(email) {
    const redirectTo = window.location.origin + window.location.pathname;
    return await db.auth.resetPasswordForEmail(email, { redirectTo });
  },

  async logout() {
    await db.auth.signOut();
  }
};
