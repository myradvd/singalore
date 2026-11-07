import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Banner } from './Banner';

describe('Banner at narrow width or large font', () =>
{
  it('keeps the message at least 140 dp wide and wraps the actions onto their own line', async () =>
  {
    await render(<Banner testID="banner" icon="map-marker-alert" message="Simulated location active" actions={[{ label: 'Restore real location', onPress: jest.fn() }]} />);
    expect(StyleSheet.flatten(screen.getByTestId('banner').props.style).flexWrap).toBe('wrap');
    expect(StyleSheet.flatten(screen.getByText('Simulated location active').props.style)).toMatchObject({ flexShrink: 1, minWidth: 140 });
    expect(StyleSheet.flatten(screen.getByTestId('banner-actions').props.style)).toMatchObject({ flexWrap: 'wrap', marginLeft: 'auto' });
  });
});
