const COORDINATE_PAIR = /-?\d{1,3}\.\d{3,}\s*[,/ ]\s*-?\d{1,3}\.\d{3,}/g;
const PRECISE_DECIMAL = /-?\d{1,3}\.\d{4,}/g;

export function redactCoordinates(text: string): string
{
  return text.replace(COORDINATE_PAIR, '[redacted]').replace(PRECISE_DECIMAL, '[redacted]');
}
