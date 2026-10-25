import { contrastRatio, parseHexColor } from './contrast';
import { NON_TEXT_PAIRS, TEXT_ON_BACKGROUND_PAIRS, colors, touchTargets } from './tokens';

describe('theme contrast (NFR 4.2, WCAG AA)', () =>
{
  it('computes known ratios', () =>
  {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
    expect(() => parseHexColor('rgba(0,0,0,1)')).toThrow();
  });

  it.each(TEXT_ON_BACKGROUND_PAIRS)('%s on %s meets 4.5:1', (foreground, background) =>
  {
    expect(contrastRatio(colors[foreground], colors[background])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)('%s on %s meets 3:1 for icons and map graphics', (foreground, background) =>
  {
    expect(contrastRatio(colors[foreground], colors[background])).toBeGreaterThanOrEqual(3);
  });

  it('route line, boundary line and user dot stand out from the light basemap (3:1 for graphics)', () =>
  {
    const basemapLand = '#F2EFE9';
    expect(contrastRatio(colors.mapRoute, basemapLand)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.mapBoundaryLine, basemapLand)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.mapUserDot, basemapLand)).toBeGreaterThanOrEqual(3);
  });
});

describe('touch targets (NFR 4.3)', () =>
{
  it('meet platform minimums and are larger for player controls', () =>
  {
    expect(touchTargets.minimum).toBeGreaterThanOrEqual(48);
    expect(touchTargets.player).toBeGreaterThanOrEqual(56);
    expect(touchTargets.playerPrimary).toBeGreaterThan(touchTargets.player);
  });
});
