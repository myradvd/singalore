import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/tokens';
import { PrimaryButton, SecondaryButton, TextButton } from './Buttons';
import { Card } from './Card';
import { Chip } from './Chip';

const LONG_LABEL = 'Download Nanyang Technological University';

// Flattens the style of the label Text and its row inside a button.
function labelLayout(label: string)
{
  const text = screen.getByText(label);
  let row = text.parent;
  while (row !== null && StyleSheet.flatten(row.props.style)?.flexDirection !== 'row')
  {
    row = row.parent;
  }
  return { text: StyleSheet.flatten(text.props.style), row: StyleSheet.flatten(row?.props.style) };
}

describe('buttons stay inside their container (narrow width, large font)', () =>
{
  it.each([
    ['primary', <PrimaryButton key="p" testID="b" label={LONG_LABEL} icon="download" onPress={jest.fn()} />],
    ['secondary', <SecondaryButton key="s" testID="b" label={LONG_LABEL} icon="download" onPress={jest.fn()} />],
  ])('%s button: label and icon row can shrink and the pill never exceeds its parent', async (_kind, element) =>
  {
    await render(<View style={{ width: 200 }}>{element}</View>);
    const { text, row } = labelLayout(LONG_LABEL);
    expect(text.flexShrink).toBe(1);
    expect(text.textAlign).toBe('center');
    expect(row.flexShrink).toBe(1);
    expect(row.maxWidth).toBe('100%');
    expect(StyleSheet.flatten(screen.getByTestId('b').props.style).maxWidth).toBe('100%');
  });

  it('text button label can shrink', async () =>
  {
    await render(<TextButton testID="t" label="Use approximate straight line guide" onPress={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByText('Use approximate straight line guide').props.style).flexShrink).toBe(1);
    expect(StyleSheet.flatten(screen.getByTestId('t').props.style).maxWidth).toBe('100%');
  });

  it('chip label can shrink inside a capped chip', async () =>
  {
    await render(<Chip testID="c" label="Next up: Chinese Heritage Centre" />);
    expect(StyleSheet.flatten(screen.getByText('Next up: Chinese Heritage Centre').props.style).flexShrink).toBe(1);
    expect(StyleSheet.flatten(screen.getByTestId('c').props.style).maxWidth).toBe('100%');
  });
});

describe('Card surface', () =>
{
  it('is opaque so map controls and pins cannot show through', async () =>
  {
    await render(<Card testID="card"><Text>body</Text></Card>);
    const background = StyleSheet.flatten(screen.getByTestId('card').props.style).backgroundColor;
    expect(background).toBe(colors.surface);
    expect(background).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
