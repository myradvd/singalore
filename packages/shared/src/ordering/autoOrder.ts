export type DurationMatrix = readonly (readonly (number | null)[])[];

export interface OrderingResult
{
  stopOrder: number[];
  totalCost: number;
  algorithm: 'exact' | 'heuristic' | 'trivial';
}

export const EXACT_SOLVER_MAX_STOPS = 9;
const UNREACHABLE_COST = 1e9;

function costBetween(matrix: DurationMatrix, from: number, to: number): number
{
  const value = matrix[from]?.[to];
  return value === null || value === undefined ? UNREACHABLE_COST : value;
}

export function pathCost(matrix: DurationMatrix, startIndex: number, stopOrder: readonly number[]): number
{
  let total = 0;
  let previous = startIndex;
  for (const stop of stopOrder)
  {
    total += costBetween(matrix, previous, stop);
    previous = stop;
  }
  return total;
}

function validateSquare(matrix: DurationMatrix): number
{
  const size = matrix.length;
  for (const row of matrix)
  {
    if (row.length !== size)
    {
      throw new Error('Duration matrix must be square');
    }
  }
  return size;
}

export function solveOrderExact(matrix: DurationMatrix): OrderingResult
{
  const size = validateSquare(matrix);
  const stopCount = size - 1;
  if (stopCount <= 1)
  {
    return { stopOrder: stopCount === 1 ? [1] : [], totalCost: stopCount === 1 ? costBetween(matrix, 0, 1) : 0, algorithm: 'trivial' };
  }
  if (stopCount > EXACT_SOLVER_MAX_STOPS)
  {
    throw new Error(`Exact solver supports at most ${EXACT_SOLVER_MAX_STOPS} stops`);
  }
  const fullMask = (1 << stopCount) - 1;
  const stateCount = (fullMask + 1) * stopCount;
  const best = new Float64Array(stateCount).fill(Infinity);
  const parent = new Int32Array(stateCount).fill(-1);
  const stateIndex = (mask: number, last: number): number => mask * stopCount + last;

  for (let stop = 0; stop < stopCount; stop += 1)
  {
    best[stateIndex(1 << stop, stop)] = costBetween(matrix, 0, stop + 1);
  }
  for (let mask = 1; mask <= fullMask; mask += 1)
  {
    for (let last = 0; last < stopCount; last += 1)
    {
      if ((mask & (1 << last)) === 0)
      {
        continue;
      }
      const currentCost = best[stateIndex(mask, last)] ?? Infinity;
      if (currentCost === Infinity)
      {
        continue;
      }
      for (let next = 0; next < stopCount; next += 1)
      {
        if ((mask & (1 << next)) !== 0)
        {
          continue;
        }
        const nextMask = mask | (1 << next);
        const candidate = currentCost + costBetween(matrix, last + 1, next + 1);
        const target = stateIndex(nextMask, next);
        if (candidate < (best[target] ?? Infinity))
        {
          best[target] = candidate;
          parent[target] = last;
        }
      }
    }
  }
  let bestLast = 0;
  let bestCost = Infinity;
  for (let last = 0; last < stopCount; last += 1)
  {
    const cost = best[stateIndex(fullMask, last)] ?? Infinity;
    if (cost < bestCost)
    {
      bestCost = cost;
      bestLast = last;
    }
  }
  const reversed: number[] = [];
  let mask = fullMask;
  let current = bestLast;
  while (current !== -1)
  {
    reversed.push(current + 1);
    const previous = parent[stateIndex(mask, current)] ?? -1;
    mask &= ~(1 << current);
    current = previous;
  }
  return { stopOrder: reversed.reverse(), totalCost: bestCost, algorithm: 'exact' };
}

export function solveOrderHeuristic(matrix: DurationMatrix): OrderingResult
{
  const size = validateSquare(matrix);
  const remaining = new Set<number>();
  for (let index = 1; index < size; index += 1)
  {
    remaining.add(index);
  }
  const order: number[] = [];
  let current = 0;
  while (remaining.size > 0)
  {
    let nearest = -1;
    let nearestCost = Infinity;
    for (const candidate of remaining)
    {
      const cost = costBetween(matrix, current, candidate);
      if (cost < nearestCost)
      {
        nearestCost = cost;
        nearest = candidate;
      }
    }
    order.push(nearest);
    remaining.delete(nearest);
    current = nearest;
  }
  let improved = true;
  let bestCost = pathCost(matrix, 0, order);
  while (improved)
  {
    improved = false;
    for (let left = 0; left < order.length - 1; left += 1)
    {
      for (let right = left + 1; right < order.length; right += 1)
      {
        const candidate = [
          ...order.slice(0, left),
          ...order.slice(left, right + 1).reverse(),
          ...order.slice(right + 1),
        ];
        const candidateCost = pathCost(matrix, 0, candidate);
        if (candidateCost + 1e-9 < bestCost)
        {
          order.splice(0, order.length, ...candidate);
          bestCost = candidateCost;
          improved = true;
        }
      }
    }
  }
  return { stopOrder: order, totalCost: bestCost, algorithm: 'heuristic' };
}

export function autoOrder(matrix: DurationMatrix): OrderingResult
{
  const stopCount = validateSquare(matrix) - 1;
  return stopCount <= EXACT_SOLVER_MAX_STOPS ? solveOrderExact(matrix) : solveOrderHeuristic(matrix);
}
