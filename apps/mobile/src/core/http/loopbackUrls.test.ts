import { localizeLoopbackUrl, localizeLoopbackUrls, loopbackReplacementHost } from './loopbackUrls';

describe('loopback media URLs', () =>
{
  it('uses the API host only when the API itself is not on loopback', () =>
  {
    expect(loopbackReplacementHost('http://10.0.2.2:3000')).toBe('10.0.2.2');
    expect(loopbackReplacementHost('https://api.singalore.app/')).toBe('api.singalore.app');
    expect(loopbackReplacementHost('http://localhost:3000')).toBeNull();
    expect(loopbackReplacementHost('http://127.0.0.1:3000')).toBeNull();
    expect(loopbackReplacementHost('not a url')).toBeNull();
  });

  it('swaps loopback hosts and keeps scheme, port and path', () =>
  {
    expect(localizeLoopbackUrl('http://127.0.0.1:54321/storage/v1/object/public/media/a.m4a', '10.0.2.2'))
      .toBe('http://10.0.2.2:54321/storage/v1/object/public/media/a.m4a');
    expect(localizeLoopbackUrl('http://localhost/x.jpg', '10.0.2.2')).toBe('http://10.0.2.2/x.jpg');
    expect(localizeLoopbackUrl('https://cdn.example.com/x.jpg', '10.0.2.2')).toBe('https://cdn.example.com/x.jpg');
    expect(localizeLoopbackUrl('http://localhostile.com/x.jpg', '10.0.2.2')).toBe('http://localhostile.com/x.jpg');
  });

  it('rewrites nested response values and leaves other values alone', () =>
  {
    const input = { podcasts: [{ audioUrl: 'http://127.0.0.1:54321/a.m4a', durationSeconds: 23 }], thumbnailUrl: null, name: 'localhost' };
    expect(localizeLoopbackUrls(input, '10.0.2.2')).toEqual({
      podcasts: [{ audioUrl: 'http://10.0.2.2:54321/a.m4a', durationSeconds: 23 }],
      thumbnailUrl: null,
      name: 'localhost',
    });
    expect(localizeLoopbackUrls(input, null)).toBe(input);
  });
});
