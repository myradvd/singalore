import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet, View } from 'react-native';
import type { CatalogLandmark } from '@singalore/shared';
import type { AppServices } from '@/composition/container';
import { applyCatalogSnapshot } from '@/modules/catalog/catalogStore';
import type { DownloadRecord } from '@/modules/offline/DownloadsRepository';
import { useDownloadsStore } from '@/modules/offline/downloadsStore';
import { catalogFixture, LANDMARK_CHIJMES, LANDMARK_MARKET, LANDMARK_SHELTER, PARK_CIVIC } from '@test/support/catalogFixture';
import { createTestServices, renderWithServices } from '@test/support/renderWithProviders';
import { COPY } from '../../copy';
import { SummaryCard } from './SummaryCard';
import { useLandmarkDetail } from './useLandmarkDetail';

const catalog = catalogFixture();
const chijmes = catalog.landmarks.find((landmark) => landmark.id === LANDMARK_CHIJMES);
const shelter = catalog.landmarks.find((landmark) => landmark.id === LANDMARK_SHELTER);

const LOCAL_IMAGE = 'file:///packs/civic/image-chijmes.jpg';
const FULL_TEXT = 'The full history of CHIJMES, as downloaded with the park.';

// Stores one downloaded landmark row the way a park download does.
async function storeDetail(services: AppServices, landmarkId: string, description: string, imageLocalPath: string | null): Promise<void>
{
  await services.packDetails.storeDetails({ schemaVersion: 1, parkId: PARK_CIVIC, etag: '"x"', generatedAt: '2026-10-12T00:00:00.000Z', totalBytes: 0, landmarks: [{ landmarkId, description, imageUrl: null }], podcasts: [], files: [] });
  await services.packDetails.setLandmarkImageLocalPath(landmarkId, imageLocalPath);
}

// Renders the card with the hook result, as HomeScreen does.
function DetailCard({ landmark }: { landmark: CatalogLandmark })
{
  const detail = useLandmarkDetail(landmark.id);
  return <SummaryCard landmark={landmark} parkName={null} podcastSeconds={null} description={detail.description} imageUri={detail.imageUri} onClose={jest.fn()} />;
}

// Finds a catalog fixture landmark or fails the test.
function fixtureLandmark(landmarkId: string): CatalogLandmark
{
  const landmark = catalog.landmarks.find((candidate) => candidate.id === landmarkId);
  if (landmark === undefined)
  {
    throw new Error('fixture missing');
  }
  return landmark;
}

// Reads the description and image URI the card is showing.
function shownContent(): { text: unknown; uri: unknown }
{
  return { text: screen.getByTestId('summary-description').props.children, uri: screen.getByTestId('summary-thumbnail').props.source[0].uri };
}

describe('SummaryCard with downloaded content (UC 1.4.2)', () =>
{
  let services: AppServices;
  const landmark = fixtureLandmark(LANDMARK_CHIJMES);
  const remote = landmark.thumbnailUrl;

  beforeEach(async () =>
  {
    applyCatalogSnapshot(catalogFixture());
    useDownloadsStore.setState({ records: {} });
    services = await createTestServices();
  });

  it('downloaded: a row with description and local path gives the local URI and full text', async () =>
  {
    await storeDetail(services, LANDMARK_CHIJMES, FULL_TEXT, LOCAL_IMAGE);
    await renderWithServices(services, <DetailCard landmark={landmark} />);
    await act(async () => undefined);
    expect(shownContent()).toEqual({ text: FULL_TEXT, uri: LOCAL_IMAGE });
  });

  it('description only: a row with a null path gives the remote image and full text', async () =>
  {
    await storeDetail(services, LANDMARK_CHIJMES, FULL_TEXT, null);
    await renderWithServices(services, <DetailCard landmark={landmark} />);
    await act(async () => undefined);
    expect(shownContent()).toEqual({ text: FULL_TEXT, uri: remote });
  });

  it('not downloaded: no row gives the short description and remote image', async () =>
  {
    await renderWithServices(services, <DetailCard landmark={landmark} />);
    await act(async () => undefined);
    expect(shownContent()).toEqual({ text: landmark.shortDescription, uri: remote });
  });

  it.each([['empty', ''], ['whitespace only', '   ']])('%s description: the row maps to null and the short description shows', async (_name, description) =>
  {
    await storeDetail(services, LANDMARK_CHIJMES, description, null);
    await renderWithServices(services, <DetailCard landmark={landmark} />);
    await act(async () => undefined);
    expect(shownContent().text).toBe(landmark.shortDescription);
    expect(screen.queryByText(COPY.descriptionUnavailable)).toBeNull();
  });

  it('exception flow: a rejected query gives the short description without a crash', async () =>
  {
    jest.spyOn(services.packDetails, 'landmarkDetail').mockRejectedValue(new Error('db closed'));
    await renderWithServices(services, <DetailCard landmark={landmark} />);
    await act(async () => undefined);
    expect(shownContent()).toEqual({ text: landmark.shortDescription, uri: remote });
  });

  it('changing landmark ignores the earlier query when it resolves late', async () =>
  {
    let resolveEarlier: (row: { description: string; imageUrl: null; imageLocalPath: string }) => void = () => undefined;
    const earlier = new Promise<{ description: string; imageUrl: null; imageLocalPath: string }>((resolve) =>
    {
      resolveEarlier = resolve;
    });
    jest.spyOn(services.packDetails, 'landmarkDetail').mockImplementation((landmarkId) => (landmarkId === LANDMARK_CHIJMES ? earlier : Promise.resolve({ description: 'Market history', imageUrl: null, imageLocalPath: null })));
    const market = fixtureLandmark(LANDMARK_MARKET);
    const view = await renderWithServices(services, <DetailCard landmark={landmark} />);
    await view.rerender(<DetailCard landmark={market} />);
    await act(async () => undefined);
    await act(async () => resolveEarlier({ description: FULL_TEXT, imageUrl: null, imageLocalPath: LOCAL_IMAGE }));
    expect(screen.getByTestId('summary-description').props.children).toBe('Market history');
  });

  it('changing landmark shows no content of the earlier landmark while the new query runs', async () =>
  {
    await storeDetail(services, LANDMARK_CHIJMES, FULL_TEXT, LOCAL_IMAGE);
    const market = fixtureLandmark(LANDMARK_MARKET);
    const view = await renderWithServices(services, <DetailCard landmark={landmark} />);
    await act(async () => undefined);
    jest.spyOn(services.packDetails, 'landmarkDetail').mockReturnValue(new Promise(() => undefined));
    await view.rerender(<DetailCard landmark={market} />);
    expect(screen.getByTestId('summary-description').props.children).toBe(market.shortDescription);
  });

  it('removing the download while the card is open goes back to the remote image', async () =>
  {
    const downloaded: DownloadRecord = { parkId: PARK_CIVIC, state: 'downloaded', packEtag: '"x"', totalBytes: 0, doneBytes: 0, errorCode: null, completedAt: null };
    useDownloadsStore.setState({ records: { [PARK_CIVIC]: downloaded } });
    await storeDetail(services, LANDMARK_CHIJMES, FULL_TEXT, LOCAL_IMAGE);
    await renderWithServices(services, <DetailCard landmark={landmark} />);
    await act(async () => undefined);
    expect(shownContent().uri).toBe(LOCAL_IMAGE);
    await services.packDetails.setLandmarkImageLocalPath(LANDMARK_CHIJMES, null);
    await act(async () => useDownloadsStore.setState({ records: {} }));
    expect(shownContent().uri).toBe(remote);
  });

  it.each([[139, false], [140, false], [141, true]])('Read more with a %i character description: shown is %s', async (length, shown) =>
  {
    await render(<SummaryCard landmark={landmark} parkName={null} podcastSeconds={null} description={'x'.repeat(length)} onClose={jest.fn()} />);
    expect(screen.queryByTestId('summary-read-more') !== null).toBe(shown);
  });
});

describe('SummaryCard long text (SRS long descriptions)', () =>
{
  const landmark = fixtureLandmark(LANDMARK_CHIJMES);
  const longText = 'A long history. '.repeat(200);

  it('collapsed long text has no scroll view', async () =>
  {
    await render(<SummaryCard landmark={landmark} parkName={null} podcastSeconds={null} description={longText} onClose={jest.fn()} />);
    expect(screen.queryByTestId('summary-description-scroll')).toBeNull();
    expect(screen.getByTestId('summary-description').props.numberOfLines).toBe(3);
  });

  it('expanded long text scrolls inside a height cap of 20% of the window', async () =>
  {
    await render(<SummaryCard landmark={landmark} parkName={null} podcastSeconds={null} description={longText} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('summary-read-more'));
    const scroll = screen.getByTestId('summary-description-scroll');
    expect(StyleSheet.flatten(scroll.props.style).maxHeight).toBe(Dimensions.get('window').height * 0.2);
    expect(within(scroll).getByTestId('summary-description').props.children).toBe(longText.trim());
  });

  it('expanded long text keeps the title, Close and Show less outside the scroll view', async () =>
  {
    await render(<SummaryCard landmark={landmark} parkName={null} podcastSeconds={null} description={longText} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('summary-read-more'));
    const scroll = within(screen.getByTestId('summary-description-scroll'));
    expect(scroll.queryByText(landmark.name)).toBeNull();
    expect(scroll.queryByTestId('close-summary')).toBeNull();
    expect(scroll.queryByText('Show less')).toBeNull();
    expect(screen.getByTestId('close-summary')).toBeTruthy();
    expect(screen.getByText('Show less')).toBeTruthy();
  });

  it('Show less removes the scroll view again', async () =>
  {
    await render(<SummaryCard landmark={landmark} parkName={null} podcastSeconds={null} description={longText} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('summary-read-more'));
    await fireEvent.press(screen.getByTestId('summary-read-more'));
    expect(screen.queryByTestId('summary-description-scroll')).toBeNull();
  });
});

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

describe('SummaryCard header layout (narrow title regression)', () =>
{
  const landmark = fixtureLandmark(LANDMARK_CHIJMES);
  const headerActions = (
    <>
      <View testID="extra-one" style={{ width: 48, height: 48 }} />
      <View testID="extra-two" style={{ width: 48, height: 48 }} />
    </>
  );

  it('stacks header icons in one column so extra icons take no width from the title', async () =>
  {
    await render(<SummaryCard landmark={landmark} parkName="Nanyang Technological University" podcastSeconds={420} description={null} onClose={jest.fn()} headerActions={headerActions} />);
    const column = screen.getByTestId('summary-header-actions');
    expect(StyleSheet.flatten(column.props.style).flexDirection).toBe('column');
    expect(within(column).getByTestId('close-summary')).toBeTruthy();
    expect(within(column).getByTestId('extra-two')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('summary-title-block').props.style)).toMatchObject({ flex: 1, minWidth: 0 });
  });

  it('puts all card content in a shrinkable scroll view so a height cap never makes the actions unreachable', async () =>
  {
    await render(<SummaryCard landmark={landmark} parkName={null} podcastSeconds={null} description={null} onClose={jest.fn()} actions={<View testID="card-actions" />} />);
    const body = screen.getByTestId('summary-body');
    expect(StyleSheet.flatten(body.props.style).flexShrink).toBe(1);
    expect(within(body).getByTestId('close-summary')).toBeTruthy();
    expect(within(body).getByTestId('summary-description')).toBeTruthy();
    expect(within(body).getByTestId('card-actions')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('summary-card').props.style).flexShrink).toBe(1);
  });
});
