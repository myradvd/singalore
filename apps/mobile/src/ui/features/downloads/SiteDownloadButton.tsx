import { useAppServices } from '@/composition/AppServicesContext';
import { useDownloadsStore } from '@/modules/offline/downloadsStore';
import { COPY, siteDownloadLabel } from '../../copy';
import { SecondaryButton } from '../../primitives/Buttons';
import { startParkDownload } from './PackActionButton';

// Offers the download of a site's park (packs are per park) on the site card.
export function SiteDownloadButton({ parkId, parkName }: { parkId: string; parkName: string })
{
  const services = useAppServices();
  const state = useDownloadsStore((store) => store.records[parkId]?.state ?? 'not_downloaded');
  if (state === 'downloaded')
  {
    return null;
  }
  if (state === 'downloading')
  {
    return <SecondaryButton testID="site-download" label={COPY.downloadingShort} icon="download" disabled onPress={() => undefined} />;
  }
  const label = state === 'paused' ? COPY.resumeDownload : siteDownloadLabel(parkName);
  return <SecondaryButton testID="site-download" label={label} icon="download" onPress={() => void startParkDownload(services, parkId)} />;
}
