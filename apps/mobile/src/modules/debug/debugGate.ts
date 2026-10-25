export const DEBUG_GATE_TAPS = 7;
export const DEBUG_GATE_WINDOW_MS = 3000;

export class DebugGate
{
  private taps: number[] = [];

  constructor(private readonly toolsAvailable: boolean)
  {
  }

  registerTap(at: number): boolean
  {
    if (!this.toolsAvailable)
    {
      return false;
    }
    this.taps = [...this.taps.filter((tap) => at - tap < DEBUG_GATE_WINDOW_MS), at];
    if (this.taps.length >= DEBUG_GATE_TAPS)
    {
      this.taps = [];
      return true;
    }
    return false;
  }
}
