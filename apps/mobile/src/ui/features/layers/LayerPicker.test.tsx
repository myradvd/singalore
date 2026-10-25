import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { LayerPicker } from './LayerPicker';

const layers = { baseLayer: 'standard' as const, showHeritageBoundaries: true };

describe('LayerPicker sheet', () =>
{
  it('changes the base layer and closes after the scrim is pressed', async () =>
  {
    const onChange = jest.fn();
    const onClose = jest.fn();
    await render(<LayerPicker visible layers={layers} satelliteAvailable onChange={onChange} onClose={onClose} />);
    expect(screen.getByTestId('layer-picker')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('layer-satellite'));
    expect(onChange).toHaveBeenCalledWith({ baseLayer: 'satellite' });
    await fireEvent.press(screen.getByLabelText('Close map layers'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
