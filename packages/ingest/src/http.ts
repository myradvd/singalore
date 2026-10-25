export const INGEST_USER_AGENT = 'Singalore/0.1 (NTU SC2006 coursework heritage app; https://github.com/singalore)';

export interface FetchJsonOptions
{
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  fetchImplementation?: typeof fetch;
}

export class IngestHttpError extends Error
{
  constructor(message: string, readonly status: number | null, readonly url: string)
  {
    super(message);
    this.name = 'IngestHttpError';
  }
}

export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown>
{
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const retries = options.retries ?? 2;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1)
  {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
    try
    {
      const response = await fetchImplementation(url, {
        method: options.method ?? 'GET',
        headers: { 'User-Agent': INGEST_USER_AGENT, Accept: 'application/json', ...options.headers },
        ...(options.body !== undefined ? { body: options.body } : {}),
        signal: controller.signal,
      });
      if (response.status === 429 || response.status >= 500)
      {
        lastError = new IngestHttpError(`Upstream status ${response.status}`, response.status, url);
        await delay(1000 * (attempt + 1));
        continue;
      }
      if (!response.ok)
      {
        throw new IngestHttpError(`Upstream status ${response.status}`, response.status, url);
      }
      return await response.json();
    }
    catch (error)
    {
      if (error instanceof IngestHttpError && error.status !== null && error.status < 500 && error.status !== 429)
      {
        throw error;
      }
      lastError = error;
      if (attempt < retries)
      {
        await delay(1000 * (attempt + 1));
      }
    }
    finally
    {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new IngestHttpError('Request failed', null, url);
}

function delay(milliseconds: number): Promise<void>
{
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
