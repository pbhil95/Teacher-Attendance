// Initialize Supabase Client
const SUPABASE_URL = 'https://cuvleeayglhpuhouvzts.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dmxlZWF5Z2xocHVob3V2enRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjYxNzgsImV4cCI6MjA5MTUwMjE3OH0.ZTKWwnvSESrSw_h7YCan9RIZxf69mq7tpVmkcIXCG4Y';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

window.appAuth = {
  db,
  user: null,
  profile: null,
  initialized: false,
  recoveryMode: false,
  _listeners: [],
  _initDone: false,  // guard against duplicate init calls

  // Register a UI listener for auth state changes
  onStateChange(callback) {
    this._listeners.push(callback);
    // If already initialized, immediately invoke with current state
    if (this.initialized) callback(this.user, this.profile);
  },

  _notify() {
    this._listeners.forEach(cb => cb(this.user, this.profile));
  },

  // Fetch profile from DB; optionally create it from Supabase user_metadata
  async _loadProfile(user) {
    let { data: profile, error } = await db
      .from('teacher_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Auto-create profile on first login if metadata is present
    if ((error || !profile) && user.user_metadata?.name) {
      const uMeta = user.user_metadata;
      const { data: newProfile } = await db
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
      profile = newProfile;
    }
    return profile || null;
  },

  async init() {
    if (this._initDone) return;
    this._initDone = true;

    try {
      const { data: { session } } = await db.auth.getSession();

      if (session) {
        this.user = session.user;
        this.profile = await this._loadProfile(session.user);
      } else {
        this.user = null;
        this.profile = null;
      }
    } catch (err) {
      console.error('[Auth] init error:', err);
      this.user = null;
      this.profile = null;
    }

    // Mark ready and notify UI exactly ONCE
    this.initialized = true;
    this._notify();

    // Now watch for future auth changes (post-init only)
    db.auth.onAuthStateChange(async (event, session) => {
      // Skip INITIAL_SESSION — already handled above via getSession()
      if (event === 'INITIAL_SESSION') return;

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
          console.error('[Auth] onAuthStateChange error:', err);
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
