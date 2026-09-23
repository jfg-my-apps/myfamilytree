const fs = require('fs');
const path = require('path');

// Jest doesn't load .env the way `expo start`/`expo export` do, but modules
// like lib/supabase.ts throw at import time if the env vars are missing —
// even for tests that never touch the network. Load it here so any test file
// that transitively imports the real supabase client doesn't need its own
// per-file mock just to survive module load.
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
