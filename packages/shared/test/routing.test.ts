import { describe, expect, it } from 'vitest';
import {
  adjustedWalkSeconds,
  buildManeuverInstruction,
  buildManeuverWithDistance,
  formatClock,
  formatDistance,
  formatDurationLong,
  formatDurationShort,
  formatEpisodeLength,
  maneuverArrow,
  straightLineWalkSeconds,
  totalTourSeconds,
} from '../src';

describe('ETA', () =>
{
  it('applies pace factors', () =>
  {
    expect(adjustedWalkSeconds(1000, 'normal')).toBe(1000);
    expect(adjustedWalkSeconds(1000, 'slow')).toBe(1250);
    expect(adjustedWalkSeconds(1000, 'fast')).toBe(850);
  });

  it('estimates straight line walking at 4.5 km/h', () =>
  {
    expect(straightLineWalkSeconds(4500, 'normal')).toBe(3600);
  });

  it('adds podcast durations to the total', () =>
  {
    expect(totalTourSeconds(1500, [300, 240])).toBe(2040);
    expect(totalTourSeconds(1500, [])).toBe(1500);
  });
});

describe('formatting', () =>
{
  it('formats metric distances in metres below 1 km and kilometres above', () =>
  {
    expect(formatDistance(347, 'metric')).toBe('350 m');
    expect(formatDistance(1849, 'metric')).toBe('1.8 km');
    expect(formatDistance(-5, 'metric')).toBe('0 m');
  });

  it('formats imperial distances', () =>
  {
    expect(formatDistance(100, 'imperial')).toBe('330 ft');
    expect(formatDistance(3218.7, 'imperial')).toBe('2.0 mi');
  });

  it('formats durations', () =>
  {
    expect(formatDurationShort(1500)).toBe('25 min');
    expect(formatDurationShort(4320)).toBe('1 h 12 min');
    expect(formatEpisodeLength(23)).toBe('23 s');
    expect(formatEpisodeLength(0.4)).toBe('1 s');
    expect(formatEpisodeLength(90)).toBe('2 min');
    expect(formatEpisodeLength(0)).toBeNull();
    expect(formatDurationShort(7200)).toBe('2 h');
    expect(formatClock(284)).toBe('4:44');
    expect(formatDurationLong(284)).toBe('4 min 44 sec');
    expect(formatDurationLong(42)).toBe('42 sec');
    expect(formatDurationLong(120)).toBe('2 min');
  });
});

describe('maneuver text', () =>
{
  const cases: [Parameters<typeof buildManeuverInstruction>[0], string][] = [
    [{ type: 'depart', name: 'Tiong Bahru Road' }, 'Head out along Tiong Bahru Road'],
    [{ type: 'depart', name: '' }, 'Head out'],
    [{ type: 'turn', modifier: 'left', name: 'Eng Hoon Street' }, 'Turn left onto Eng Hoon Street'],
    [{ type: 'turn', modifier: 'slight right', name: '' }, 'Bear right'],
    [{ type: 'turn', modifier: 'sharp left', name: 'Seng Poh Road' }, 'Turn sharp left onto Seng Poh Road'],
    [{ type: 'turn', modifier: 'uturn', name: '' }, 'Make a U-turn'],
    [{ type: 'continue', modifier: 'straight', name: 'Telok Ayer Street' }, 'Continue along Telok Ayer Street'],
    [{ type: 'new name', name: 'Stamford Road' }, 'Continue along Stamford Road'],
    [{ type: 'end of road', modifier: 'right', name: 'North Bridge Road' }, 'Turn right onto North Bridge Road'],
    [{ type: 'roundabout', exit: 2, name: 'Bras Basah Road' }, 'At the roundabout, take the 2nd exit onto Bras Basah Road'],
    [{ type: 'roundabout', exit: 11, name: '' }, 'At the roundabout, take the 11th exit'],
    [{ type: 'roundabout', name: '' }, 'Go through the roundabout'],
    [{ type: 'exit roundabout', name: 'Hill Street' }, 'Exit the roundabout onto Hill Street'],
    [{ type: 'arrive', name: 'Chijmes' }, 'You have arrived at your stop'],
    [{ type: 'mystery', name: '' }, 'Continue'],
  ];

  it.each(cases)('builds the instruction for %o', (input, expected) =>
  {
    expect(buildManeuverInstruction(input)).toBe(expected);
  });

  it('prefixes the distance except on arrival', () =>
  {
    expect(buildManeuverWithDistance({ type: 'turn', modifier: 'left', name: 'Hill Street' }, 120, 'metric'))
      .toBe('In 120 m, turn left onto Hill Street');
    expect(buildManeuverWithDistance({ type: 'arrive', name: '' }, 5, 'metric')).toBe('You have arrived at your stop');
  });

  it('maps maneuvers to arrow glyphs', () =>
  {
    expect(maneuverArrow({ type: 'turn', modifier: 'left', name: '' })).toBe('left');
    expect(maneuverArrow({ type: 'turn', modifier: 'slight right', name: '' })).toBe('slight-right');
    expect(maneuverArrow({ type: 'roundabout', name: '' })).toBe('roundabout');
    expect(maneuverArrow({ type: 'arrive', name: '' })).toBe('arrive');
    expect(maneuverArrow({ type: 'depart', name: '' })).toBe('straight');
  });
});
