import { describe, expect, it } from 'vitest';
import type { DurationMatrix } from '../src';
import { autoOrder, EXACT_SOLVER_MAX_STOPS, pathCost, solveOrderExact, solveOrderHeuristic } from '../src';

function seededRandom(seed: number): () => number
{
  let state = seed >>> 0;
  return () =>
  {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomPlanarMatrix(size: number, random: () => number): number[][]
{
  const points = Array.from({ length: size }, () => ({ x: random() * 2000, y: random() * 2000 }));
  return points.map((from) => points.map((to) => Math.hypot(from.x - to.x, from.y - to.y)));
}

function permutations(values: number[]): number[][]
{
  if (values.length <= 1)
  {
    return [values];
  }
  const result: number[][] = [];
  values.forEach((value, index) =>
  {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const tail of permutations(rest))
    {
      result.push([value, ...tail]);
    }
  });
  return result;
}

function bruteForceBest(matrix: DurationMatrix): number
{
  const stops = Array.from({ length: matrix.length - 1 }, (_, index) => index + 1);
  return Math.min(...permutations(stops).map((order) => pathCost(matrix, 0, order)));
}

describe('solveOrderExact', () =>
{
  it('handles zero and one stop', () =>
  {
    expect(solveOrderExact([[0]]).stopOrder).toEqual([]);
    expect(solveOrderExact([[0, 5], [5, 0]]).stopOrder).toEqual([1]);
  });

  it('matches brute force on random matrices up to 7 stops', () =>
  {
    const random = seededRandom(42);
    for (let trial = 0; trial < 30; trial += 1)
    {
      const size = 2 + (trial % 7);
      const matrix = randomPlanarMatrix(size, random);
      const result = solveOrderExact(matrix);
      expect(result.algorithm === 'exact' || result.algorithm === 'trivial').toBe(true);
      expect(result.totalCost).toBeCloseTo(bruteForceBest(matrix), 6);
      expect([...result.stopOrder].sort((a, b) => a - b)).toEqual(Array.from({ length: size - 1 }, (_, index) => index + 1));
    }
  });

  it('respects asymmetric durations and a free end', () =>
  {
    const matrix = [
      [0, 10, 1, 100],
      [10, 0, 100, 1],
      [1, 1, 0, 100],
      [100, 100, 100, 0],
    ];
    expect(solveOrderExact(matrix).stopOrder).toEqual([2, 1, 3]);
  });

  it('treats unreachable pairs as very expensive', () =>
  {
    const matrix = [
      [0, null, 5],
      [5, 0, 5],
      [5, 5, 0],
    ];
    expect(solveOrderExact(matrix).stopOrder).toEqual([2, 1]);
  });

  it('refuses more stops than it supports', () =>
  {
    const matrix = randomPlanarMatrix(EXACT_SOLVER_MAX_STOPS + 2, seededRandom(1));
    expect(() => solveOrderExact(matrix)).toThrow();
  });

  it('rejects non square matrices', () =>
  {
    expect(() => solveOrderExact([[0, 1], [1]])).toThrow('square');
  });
});

describe('solveOrderHeuristic', () =>
{
  it('stays within 10 percent of optimal on random 8 stop planar instances', () =>
  {
    const random = seededRandom(7);
    for (let trial = 0; trial < 15; trial += 1)
    {
      const matrix = randomPlanarMatrix(9, random);
      const optimal = solveOrderExact(matrix).totalCost;
      expect(solveOrderHeuristic(matrix).totalCost).toBeLessThanOrEqual(optimal * 1.1 + 1e-6);
    }
  });

  it('visits every stop once for large inputs', () =>
  {
    const matrix = randomPlanarMatrix(12, seededRandom(3));
    const result = solveOrderHeuristic(matrix);
    expect(new Set(result.stopOrder).size).toBe(11);
  });
});

describe('autoOrder', () =>
{
  it('uses the exact solver up to the limit and the heuristic above it', () =>
  {
    expect(autoOrder(randomPlanarMatrix(EXACT_SOLVER_MAX_STOPS + 1, seededRandom(5))).algorithm).toBe('exact');
    expect(autoOrder(randomPlanarMatrix(EXACT_SOLVER_MAX_STOPS + 2, seededRandom(5))).algorithm).toBe('heuristic');
  });
});
