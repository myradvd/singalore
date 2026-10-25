import type { DistanceUnit } from './format';
import { formatDistance } from './format';

export interface ManeuverInput
{
  type: string;
  modifier?: string | undefined;
  name: string;
  exit?: number | undefined;
}

const MODIFIER_PHRASES: Record<string, string> = {
  'uturn': 'Make a U-turn',
  'sharp right': 'Turn sharp right',
  'right': 'Turn right',
  'slight right': 'Bear right',
  'straight': 'Continue straight',
  'slight left': 'Bear left',
  'left': 'Turn left',
  'sharp left': 'Turn sharp left',
};

function ordinal(value: number): string
{
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13)
  {
    return `${value}th`;
  }
  switch (value % 10)
  {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function onto(name: string): string
{
  return name.trim().length > 0 ? ` onto ${name.trim()}` : '';
}

function along(name: string): string
{
  return name.trim().length > 0 ? ` along ${name.trim()}` : '';
}

export function buildManeuverInstruction(input: ManeuverInput): string
{
  const modifierPhrase = input.modifier !== undefined ? MODIFIER_PHRASES[input.modifier] : undefined;
  switch (input.type)
  {
    case 'depart':
      return `Head out${along(input.name)}`;
    case 'arrive':
      return 'You have arrived at your stop';
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return input.exit !== undefined
        ? `At the roundabout, take the ${ordinal(input.exit)} exit${onto(input.name)}`
        : `Go through the roundabout${onto(input.name)}`;
    case 'exit roundabout':
    case 'exit rotary':
      return `Exit the roundabout${onto(input.name)}`;
    case 'continue':
    case 'new name':
      return input.modifier === undefined || input.modifier === 'straight'
        ? `Continue${along(input.name)}`
        : `${modifierPhrase ?? 'Continue'}${onto(input.name)}`;
    case 'end of road':
    case 'fork':
    case 'turn':
    case 'on ramp':
    case 'off ramp':
    case 'merge':
      return `${modifierPhrase ?? 'Continue'}${onto(input.name)}`;
    case 'notification':
    default:
      return modifierPhrase !== undefined ? `${modifierPhrase}${onto(input.name)}` : `Continue${along(input.name)}`;
  }
}

export function buildManeuverWithDistance(input: ManeuverInput, distanceMeters: number, unit: DistanceUnit): string
{
  if (input.type === 'arrive')
  {
    return buildManeuverInstruction(input);
  }
  return `In ${formatDistance(distanceMeters, unit)}, ${lowerFirst(buildManeuverInstruction(input))}`;
}

function lowerFirst(text: string): string
{
  return text.length === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

export type ManeuverArrow = 'straight' | 'left' | 'right' | 'slight-left' | 'slight-right' | 'sharp-left' | 'sharp-right' | 'uturn' | 'arrive' | 'roundabout';

export function maneuverArrow(input: ManeuverInput): ManeuverArrow
{
  if (input.type === 'arrive')
  {
    return 'arrive';
  }
  if (input.type.includes('roundabout') || input.type.includes('rotary'))
  {
    return 'roundabout';
  }
  switch (input.modifier)
  {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'slight left':
      return 'slight-left';
    case 'slight right':
      return 'slight-right';
    case 'sharp left':
      return 'sharp-left';
    case 'sharp right':
      return 'sharp-right';
    case 'uturn':
      return 'uturn';
    default:
      return 'straight';
  }
}
