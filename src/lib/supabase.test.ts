describe('supabase client bootstrap', () => {
  const ORIGINAL_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const ORIGINAL_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_URL === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
    if (ORIGINAL_ANON_KEY === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_ANON_KEY;
  });

  it('throws a clear error when env vars are missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must re-require after jest.resetModules()
    expect(() => require('./supabase')).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  it('creates a client when env vars are present', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must re-require after jest.resetModules()
    const { supabase } = require('./supabase');
    expect(supabase).toBeDefined();
    expect(typeof supabase.auth.signInWithOtp).toBe('function');
  });
});
