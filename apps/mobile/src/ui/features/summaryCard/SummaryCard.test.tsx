import { fireEvent, render, screen } from '@testing-library/react-native';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_SHELTER } from '@test/support/catalogFixture';
import { COPY } from '../../copy';
import { SummaryCard } from './SummaryCard';

const catalog = catalogFixture();
const chijmes = catalog.landmarks.find((landmark) => landmark.id === LANDMARK_CHIJMES);
const shelter = catalog.landmarks.find((landmark) => landmark.id === LANDMARK_SHELTER);

describe('SummaryCard (UC 1.2.2)', () =>
{
  it('shows name, category, park, podcast duration, image and description', async () =>
  {
    if (chijmes === undefined)
    {
      throw new Error('fixture missing');
    }
    await render(<SummaryCard landmark={chijmes} parkName="Civic District" podcastSeconds={240} description={null} onClose={jest.fn()} />);
    expect(screen.getByText('CHIJMES')).toBeTruthy();
    expect(screen.getByText('RELIGIOUS HERITAGE')).toBeTruthy();
    expect(screen.getByText(/Civic District/)).toBeTruthy();
    expect(screen.getByText(/Podcast 4 min/)).toBeTruthy();
    expect(screen.getByTestId('summary-thumbnail')).toBeTruthy();
    expect(screen.getByTestId('summary-description').props.children).toBe(chijmes.shortDescription);
  });

  it('falls back to a placeholder image and "Description unavailable." (UC 1.2.2.2)', async () =>
  {
    if (shelter === undefined)
    {
      throw new Error('fixture missing');
    }
    await render(<SummaryCard landmark={shelter} parkName={null} podcastSeconds={null} description={null} onClose={jest.fn()} />);
    expect(screen.getByTestId('summary-thumbnail-placeholder')).toBeTruthy();
    expect(screen.getByText(COPY.descriptionUnavailable)).toBeTruthy();
    expect(screen.queryByTestId('summary-caption')).toBeNull();
    expect(screen.queryByTestId('summary-read-more')).toBeNull();
  });

  it('shows short episodes in seconds instead of 0 min', async () =>
  {
    if (chijmes === undefined)
    {
      throw new Error('fixture missing');
    }
    await render(<SummaryCard landmark={chijmes} parkName="Civic District" podcastSeconds={23} description={null} onClose={jest.fn()} />);
    expect(screen.getByTestId('summary-caption').props.children).toBe('Civic District  ·  Podcast 23 s');
  });

  it('expands long text with Read more and closes', async () =>
  {
    if (chijmes === undefined)
    {
      throw new Error('fixture missing');
    }
    const onClose = jest.fn();
    const longText = 'A long history. '.repeat(30);
    await render(<SummaryCard landmark={chijmes} parkName={null} podcastSeconds={null} description={longText} onClose={onClose} />);
    expect(screen.getByTestId('summary-description').props.numberOfLines).toBe(3);
    await fireEvent.press(screen.getByTestId('summary-read-more'));
    expect(screen.getByTestId('summary-description').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('Show less')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('close-summary'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
