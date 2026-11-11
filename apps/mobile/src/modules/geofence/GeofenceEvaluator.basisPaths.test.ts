import { destinationPoint } from '@singalore/shared';
import type { GeofenceTarget, LocationFix } from '@/core/location';
import { GeofenceEvaluator } from './GeofenceEvaluator';

// Basis path tests for GeofenceEvaluator.evaluate. The control flow graph, V(G) and the path list are in docs/TESTING.md section 2.

const CENTER = { lat: 1.2951, lng: 103.8519 };
const chijmes: GeofenceTarget = { landmarkId: 'chijmes', name: 'CHIJMES', latitude: CENTER.lat, longitude: CENTER.lng, radiusMeters: 30, hasPodcast: true };

// Builds a fix the given number of metres north of the landmark.
function fixAt(metersNorth: number, timestamp: number, accuracyMeters: number | null = 10): LocationFix
{
  const point = destinationPoint(CENTER, 0, metersNorth);
  return { latitude: point.lat, longitude: point.lng, accuracyMeters, timestamp, source: 'spoof' };
}

// Returns an evaluator that is already inside CHIJMES.
function insideEvaluator(): GeofenceEvaluator
{
  const evaluator = new GeofenceEvaluator();
  expect(evaluator.evaluate(fixAt(5, 0), [chijmes])).toHaveLength(1);
  return evaluator;
}

describe('GeofenceEvaluator.evaluate basis paths (V(G) = 8)', () =>
{
  it('basis path P1: no targets and nothing inside returns no transitions', () =>
  {
    const evaluator = new GeofenceEvaluator();
    expect(evaluator.evaluate(fixAt(5, 0), [])).toEqual([]);
    expect(evaluator.insideLandmarkIds()).toEqual([]);
  });

  it('basis path P2: not inside and the fix is outside the radius gives no entry', () =>
  {
    const evaluator = new GeofenceEvaluator();
    expect(evaluator.evaluate(fixAt(60, 0), [chijmes])).toEqual([]);
    expect(evaluator.insideLandmarkIds()).toEqual([]);
  });

  it('basis path P3: not inside and an accurate fix inside the radius enters', () =>
  {
    const evaluator = new GeofenceEvaluator();
    expect(evaluator.evaluate(fixAt(5, 0), [chijmes])).toEqual([{ type: 'enter', landmarkId: 'chijmes', at: 0, distanceMeters: expect.closeTo(5, 0) }]);
    expect(evaluator.insideLandmarkIds()).toEqual(['chijmes']);
  });

  it('basis path P4: inside and within the exit radius stays inside', () =>
  {
    const evaluator = insideEvaluator();
    expect(evaluator.evaluate(fixAt(40, 1000), [chijmes])).toEqual([]);
    expect(evaluator.insideLandmarkIds()).toEqual(['chijmes']);
  });

  it('basis path P5: inside and the first fix beyond the exit radius does not exit yet', () =>
  {
    const evaluator = insideEvaluator();
    expect(evaluator.evaluate(fixAt(60, 1000), [chijmes])).toEqual([]);
    expect(evaluator.insideLandmarkIds()).toEqual(['chijmes']);
  });

  it('basis path P6: inside and the second fix beyond the exit radius exits', () =>
  {
    const evaluator = insideEvaluator();
    evaluator.evaluate(fixAt(60, 1000), [chijmes]);
    expect(evaluator.evaluate(fixAt(60, 2000), [chijmes])).toEqual([{ type: 'exit', landmarkId: 'chijmes', at: 2000 }]);
    expect(evaluator.insideLandmarkIds()).toEqual([]);
  });

  it('basis path P7: inside a landmark that is no longer a target forgets it without a transition', () =>
  {
    const evaluator = insideEvaluator();
    expect(evaluator.evaluate(fixAt(5, 1000), [])).toEqual([]);
    expect(evaluator.insideLandmarkIds()).toEqual([]);
  });
});
