import type { GeofenceTarget, LocationFix } from '@/core/location';
import { DISMISS_SUPPRESSION_MS } from './promptPolicy';
import { arrivalNotificationText, evaluateBackgroundArrival } from './backgroundArrival';

const target: GeofenceTarget = { landmarkId: 'a', name: 'Thian Hock Keng', latitude: 1.2806, longitude: 103.8475, radiusMeters: 30, hasPodcast: true };
const silent: GeofenceTarget = { ...target, landmarkId: 'b', hasPodcast: false };
const fix = (accuracyMeters: number | null, offsetLat = 0): LocationFix => ({ latitude: 1.2806 + offsetLat, longitude: 103.8475, accuracyMeters, timestamp: 0, source: 'device' });

describe('evaluateBackgroundArrival', () =>
{
  it('reports an arrival inside the real radius with good accuracy', () =>
  {
    expect(evaluateBackgroundArrival({ fix: fix(10), targets: [target], geofenceTriggersEnabled: true, lastNotifiedAt: new Map(), now: 0 }))
      .toEqual({ kind: 'arrived', landmarkId: 'a', name: 'Thian Hock Keng' });
  });

  it('asks for an approach watch when the OS region fired but the walker is not inside yet', () =>
  {
    expect(evaluateBackgroundArrival({ fix: fix(10, 0.0006), targets: [target], geofenceTriggersEnabled: true, lastNotifiedAt: new Map(), now: 0, candidateLandmarkId: 'a' }))
      .toEqual({ kind: 'approaching', landmarkId: 'a' });
    expect(evaluateBackgroundArrival({ fix: fix(80), targets: [target], geofenceTriggersEnabled: true, lastNotifiedAt: new Map(), now: 0 })).toEqual({ kind: 'none' });
  });

  it('respects the master switch, podcasts and the 10 minute repeat guard', () =>
  {
    expect(evaluateBackgroundArrival({ fix: fix(5), targets: [target], geofenceTriggersEnabled: false, lastNotifiedAt: new Map(), now: 0 }).kind).toBe('none');
    expect(evaluateBackgroundArrival({ fix: fix(5), targets: [silent], geofenceTriggersEnabled: true, lastNotifiedAt: new Map(), now: 0 }).kind).toBe('none');
    const notified = new Map([['a', 1000]]);
    expect(evaluateBackgroundArrival({ fix: fix(5), targets: [target], geofenceTriggersEnabled: true, lastNotifiedAt: notified, now: 1000 + DISMISS_SUPPRESSION_MS - 1 }).kind).toBe('none');
    expect(evaluateBackgroundArrival({ fix: fix(5), targets: [target], geofenceTriggersEnabled: true, lastNotifiedAt: notified, now: 1000 + DISMISS_SUPPRESSION_MS }).kind).toBe('arrived');
  });

  it('builds the notification copy', () =>
  {
    expect(arrivalNotificationText('CHIJMES')).toEqual({ title: 'You have reached CHIJMES', body: 'A podcast about this site is available. Tap to listen.' });
  });
});
