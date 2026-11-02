import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { spacing, touchTargets } from '../theme/tokens';
import { Chip } from './Chip';

// Reads the rendered chip height and hit slop for one test ID.
function chipGeometry(testID: string)
{
  const { hitSlop, style } = screen.getByTestId(testID).props;
  return { hitSlop, minHeight: StyleSheet.flatten(style).minHeight as number };
}

describe('Chip touch target (D6, NFR 4.3)', () =>
{
  it('pressable chip: onPress set gives 4 dp top and bottom hit slop, reaching the 48 dp minimum', async () =>
  {
    await render(<Chip testID="chip" label="Slow" onPress={jest.fn()} />);
    const { hitSlop, minHeight } = chipGeometry('chip');
    expect(hitSlop).toEqual({ top: 4, bottom: 4 });
    expect(minHeight).toBe(40);
    expect(minHeight + hitSlop.top + hitSlop.bottom).toBe(touchTargets.minimum);
  });

  it('label chip: no onPress stays disabled with no hit slop', async () =>
  {
    await render(<Chip testID="chip" label="Next up" />);
    const chip = screen.getByTestId('chip');
    expect(chip.props.accessibilityState).toMatchObject({ disabled: true });
    expect(chip.props.accessibilityRole).toBe('text');
    expect(chipGeometry('chip').hitSlop).toBeUndefined();
    expect(chipGeometry('chip').minHeight).toBe(40);
  });

  it('wrapped rows: hit slop of adjacent rows meets in the 8 dp gap without overlapping', async () =>
  {
    await render(<Chip testID="chip" label="Slow" onPress={jest.fn()} />);
    const { hitSlop } = chipGeometry('chip');
    expect(hitSlop.bottom + hitSlop.top).toBeLessThanOrEqual(spacing.sm);
  });
});
