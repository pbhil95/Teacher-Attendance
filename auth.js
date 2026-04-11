// Initialize Supabase Client
const SUPABASE_URL = 'https://cuvleeayglhpuhouvzts.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dmxlZWF5Z2xocHVob3V2enRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjYxNzgsImV4cCI6MjA5MTUwMjE3OH0.ZTKWwnvSESrSw_h7YCan9RIZxf69mq7tpVmkcIXCG4Y';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

window.appAuth = {
  db,
  user: null,
  profile: null,
  initialized: false,
  _listeners: [],

  // Register UI listeners for auth state changes
  onStateChange(callback) {
    this._listeners.push(callback);
    // If already initialized, immediately trigger the callback
    if (this.initialized) callback(this.user, this.profile);
  },

  _notify() {
    this._listeners.forEach(cb => cb(this.user, this.profile));
  },

  async init() {
    try {
      // Get current session synchronously/async on load
      const { data: { session }, error } = await db.auth.getSession();
      if (error) console.error("Session error:", error);
      await this._handleSession(session || null);
    } catch (err) {
      console.error("Supabase Init Error:", err);
      this.user = null;
      this.profile = null;
    }
    
    this.initialized = true;
    this._notify();

    // Listen to continuous changes
    db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        this.user = null;
        this.profile = null;
        this._notify();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await this._handleSession(session);
      }
    });
  },

  async _handleSession(session) {
    if (!session) {
      this.user = null;
      this.profile = null;
      if (this.initialized) this._notify();
      return;
    }
    
    this.user = session.user;
    
    // Fetch user profile from DB
    let { data: profile, error } = await db.from('teacher_profiles').select('*').eq('id', this.user.id).single();
    
    // If no profile yet, but we are logged in, we create it from registration metadata
    if ((error || !profile) && this.user.user_metadata?.name) {
       const uMeta = this.user.user_metadata;
       const { data: newProfile } = await db.from('teacher_profiles').insert([{
           id: this.user.id,
           name: uMeta.name,
           email: this.user.email,
           classes: uMeta.classes || [],
           subjects: uMeta.subjects || [],
           approved: false
       }]).select().single();
       profile = newProfile;
    }

    this.profile = profile || null;
    this._notify();
  },

  async login(email, password) {
    return await db.auth.signInWithPassword({ email, password });
  },

  async register(email, password, name, classes, subjects) {
    return await db.auth.signUp({
      email,
      password,
      options: {
        data: { name, classes, subjects }
      }
    });
  },

  async logout() {
    await db.auth.signOut();
  }
};
