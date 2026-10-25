export interface Clock
{
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

export class ManualClock implements Clock
{
  constructor(private current = 0)
  {
  }

  now(): number
  {
    return this.current;
  }

  advance(milliseconds: number): void
  {
    this.current += milliseconds;
  }

  set(milliseconds: number): void
  {
    this.current = milliseconds;
  }
}
