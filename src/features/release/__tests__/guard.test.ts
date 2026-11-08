import { devToolsAllowed, releaseIssue } from '../guard';

const SERVER = 'https://abcd.supabase.co';

describe('releaseIssue', () => {
  it('lets development builds run in local mode', () => {
    expect(releaseIssue({ isDev: true, backendMode: 'local', supabaseUrl: '' })).toBeNull();
  });

  it('lets development builds use a local Supabase over http', () => {
    expect(releaseIssue({ isDev: true, backendMode: 'supabase', supabaseUrl: 'http://127.0.0.1:54321' })).toBeNull();
  });

  it('blocks a release build in local mode', () => {
    expect(releaseIssue({ isDev: false, backendMode: 'local', supabaseUrl: '' })).toBe('missing_server_config');
  });

  it('blocks a release build in local mode even when a URL is set without a key', () => {
    expect(releaseIssue({ isDev: false, backendMode: 'local', supabaseUrl: SERVER })).toBe('missing_server_config');
  });

  it('blocks a release build that points at a non-https server', () => {
    expect(releaseIssue({ isDev: false, backendMode: 'supabase', supabaseUrl: 'http://127.0.0.1:54321' })).toBe(
      'insecure_server_url',
    );
  });

  it('lets a release build with its server settings run', () => {
    expect(releaseIssue({ isDev: false, backendMode: 'supabase', supabaseUrl: SERVER })).toBeNull();
  });
});

describe('devToolsAllowed', () => {
  it('is on only in development builds in local mode', () => {
    expect(devToolsAllowed({ isDev: true, backendMode: 'local' })).toBe(true);
    expect(devToolsAllowed({ isDev: true, backendMode: 'supabase' })).toBe(false);
    expect(devToolsAllowed({ isDev: false, backendMode: 'local' })).toBe(false);
    expect(devToolsAllowed({ isDev: false, backendMode: 'supabase' })).toBe(false);
  });
});
