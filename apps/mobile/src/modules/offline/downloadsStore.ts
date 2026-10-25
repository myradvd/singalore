import { create } from 'zustand';
import type { ConnectivityMonitor, ConnectivityState } from './ConnectivityMonitor';
import type { DownloadManager } from './DownloadManager';
import type { DownloadRecord } from './DownloadsRepository';

interface DownloadsState
{
  records: Record<string, DownloadRecord>;
  connectivity: ConnectivityState;
}

export const useDownloadsStore = create<DownloadsState>(() => ({
  records: {},
  connectivity: { online: null, wifi: false, recentFailures: 0, unstable: false, bannerVisible: false },
}));

export function bindDownloadsStore(manager: DownloadManager, connectivity: ConnectivityMonitor): () => void
{
  const apply = (records: DownloadRecord[]) => useDownloadsStore.setState({ records: Object.fromEntries(records.map((record) => [record.parkId, record])) });
  void manager.records().then(apply);
  const unsubscribeManager = manager.subscribe(apply);
  useDownloadsStore.setState({ connectivity: connectivity.getState() });
  const unsubscribeConnectivity = connectivity.subscribe((state) => useDownloadsStore.setState({ connectivity: state }));
  return () =>
  {
    unsubscribeManager();
    unsubscribeConnectivity();
  };
}
