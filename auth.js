// Initialize Supabase Client
const SUPABASE_URL = 'https://cuvleeayglhpuhouvzts.supabase.co';
const SUPABASE_ANON = 'sb_publishable_2dIPFyaQ6DOI_f3Tlt47dg_yJEsu5B7';

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
    // Get current session synchronously/async on load
    const { data: { session }, error } = await db.auth.getSession();
    await this._handleSession(session);
    this.initialized = true;

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
