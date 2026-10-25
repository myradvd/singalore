export type PackState = 'not_downloaded' | 'downloading' | 'paused' | 'downloaded' | 'failed' | 'update_available';

export type PackEvent = 'start' | 'pause' | 'interrupt' | 'resume' | 'complete' | 'fail' | 'update_found' | 'delete';

const TRANSITIONS: Record<PackState, Partial<Record<PackEvent, PackState>>> = {
  not_downloaded: { start: 'downloading' },
  downloading: { pause: 'paused', interrupt: 'paused', complete: 'downloaded', fail: 'failed', delete: 'not_downloaded' },
  paused: { resume: 'downloading', start: 'downloading', delete: 'not_downloaded', fail: 'failed' },
  downloaded: { update_found: 'update_available', delete: 'not_downloaded', start: 'downloading' },
  failed: { start: 'downloading', resume: 'downloading', delete: 'not_downloaded' },
  update_available: { start: 'downloading', delete: 'not_downloaded' },
};

export function nextPackState(state: PackState, event: PackEvent): PackState | null
{
  return TRANSITIONS[state][event] ?? null;
}

export function isOfflineReady(state: PackState): boolean
{
  return state === 'downloaded' || state === 'update_available';
}
