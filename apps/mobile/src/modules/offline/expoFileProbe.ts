import { File } from 'expo-file-system';
import type { FileProbe } from './DownloadedMediaResolver';

export const expoFileProbe: FileProbe = {
  size: (localPath) =>
  {
    const file = new File(localPath);
    return file.exists ? file.size : null;
  },
};
