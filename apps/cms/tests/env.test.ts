import { describe, expect, it } from 'vitest';
import { mediaBaseUrl, parseServerEnv } from '@/server/env';

const required = {
  SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key-long-enough-for-the-check',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key-long-enough-for-the-check',
  RATE_LIMIT_SALT: '0123456789abcdef0123',
};

describe('parseServerEnv', () =>
{
  it('treats an empty optional value as not set and uses the default', () =>
  {
    const env = parseServerEnv({ ...required, PUBLIC_MEDIA_BASE_URL: '', ROUTING_PROFILE: '  ' });
    expect(env.PUBLIC_MEDIA_BASE_URL).toBeUndefined();
    expect(env.ROUTING_PROFILE).toBe('foot');
    expect(mediaBaseUrl(env)).toBe('https://abcdefghijklmnop.supabase.co/storage/v1/object/public/media');
  });

  it('still rejects an empty required value', () =>
  {
    expect(() => parseServerEnv({ ...required, SUPABASE_URL: '' })).toThrow();
  });

  it('keeps a set media URL', () =>
  {
    const env = parseServerEnv({ ...required, PUBLIC_MEDIA_BASE_URL: 'https://cdn.example.com/media/' });
    expect(mediaBaseUrl(env)).toBe('https://cdn.example.com/media');
  });
});
