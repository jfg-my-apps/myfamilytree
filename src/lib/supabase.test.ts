describe('supabase client bootstrap', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
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
