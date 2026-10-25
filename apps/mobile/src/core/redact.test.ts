import { redactCoordinates } from './redact';

describe('redactCoordinates', () =>
{
  it('removes coordinate pairs and precise decimals', () =>
  {
    expect(redactCoordinates('fix at 1.29512, 103.85201 ok')).toBe('fix at [redacted] ok');
    expect(redactCoordinates('lat=1.295123 lng=103.852011')).toBe('lat=[redacted] lng=[redacted]');
  });

  it('keeps ordinary numbers', () =>
  {
    expect(redactCoordinates('status 504 after 3.2 s, retry 2')).toBe('status 504 after 3.2 s, retry 2');
  });
});
