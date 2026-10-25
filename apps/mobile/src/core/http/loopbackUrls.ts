const HOST_PATTERN = /^https?:\/\/(\[[^\]]+\]|[^/:?#]+)/i;
const LOOPBACK_URL_PATTERN = /^(https?:\/\/)(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(?=[:/?#]|$)/i;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '[::1]']);

export function loopbackReplacementHost(apiBaseUrl: string): string | null
{
  const host = HOST_PATTERN.exec(apiBaseUrl.trim())?.[1]?.toLowerCase() ?? null;
  if (host === null || LOOPBACK_HOSTS.has(host))
  {
    return null;
  }
  return host;
}

export function localizeLoopbackUrl(url: string, replacementHost: string): string
{
  return url.replace(LOOPBACK_URL_PATTERN, (_match, scheme: string) => `${scheme}${replacementHost}`);
}

export function localizeLoopbackUrls(value: unknown, replacementHost: string | null, depth = 0): unknown
{
  if (replacementHost === null || depth > 12)
  {
    return value;
  }
  if (typeof value === 'string')
  {
    return localizeLoopbackUrl(value, replacementHost);
  }
  if (Array.isArray(value))
  {
    return value.map((item) => localizeLoopbackUrls(item, replacementHost, depth + 1));
  }
  if (value !== null && typeof value === 'object')
  {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, localizeLoopbackUrls(nested, replacementHost, depth + 1)]));
  }
  return value;
}
