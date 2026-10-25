import { act, render, screen } from '@testing-library/react-native';
import { RemoteImage } from './RemoteImage';

describe('RemoteImage', () =>
{
  it('shows a tidy placeholder when there is no image', async () =>
  {
    await render(<RemoteImage testID="photo" uri={null} style={{ width: 72, height: 72 }} accessibilityLabel="Photo of Tiong Bahru Park" />);
    expect(screen.getByTestId('photo-placeholder').props.accessibilityLabel).toBe('No photo available');
    expect(screen.queryByTestId('photo')).toBeNull();
  });

  it('swaps to the placeholder when the image fails to load', async () =>
  {
    await render(<RemoteImage testID="photo" uri="http://10.0.2.2:54321/missing.jpg" style={{ width: 72, height: 72 }} accessibilityLabel="Photo of CHIJMES" />);
    const image = screen.getByTestId('photo');
    await act(async () => image.props.onError({ nativeEvent: { error: 'HTTP 404' } }));
    expect(screen.getByTestId('photo-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('photo')).toBeNull();
  });
});
