import { Directory, DownloadTask, File, Paths, type DownloadPauseState } from 'expo-file-system';
import type { FileTransport, TransferResult } from './FileTransport';

function packDirectory(parkId: string): Directory
{
  return new Directory(Paths.document, 'packs', parkId);
}

export class ExpoFileTransport implements FileTransport
{
  private active: DownloadTask | null = null;

  ensureDirectory(parkId: string): string
  {
    const directory = packDirectory(parkId);
    if (!directory.exists)
    {
      directory.create({ intermediates: true, idempotent: true });
    }
    return directory.uri;
  }

  async download(url: string, localPath: string, resumeData: string | null, onProgress: (bytesWritten: number) => void): Promise<TransferResult>
  {
    const options = { onProgress: (progress: { bytesWritten: number }) => onProgress(progress.bytesWritten) };
    try
    {
      let task: DownloadTask;
      if (resumeData !== null)
      {
        task = DownloadTask.fromSavable(JSON.parse(resumeData) as DownloadPauseState, options);
      }
      else
      {
        const existing = new File(localPath);
        if (existing.exists)
        {
          existing.delete();
        }
        task = File.createDownloadTask(url, existing, options);
      }
      this.active = task;
      const file = resumeData !== null ? await task.resumeAsync() : await task.downloadAsync();
      this.active = null;
      if (file === null)
      {
        return { kind: 'interrupted', resumeData: JSON.stringify(task.savable()) };
      }
      return { kind: 'done' };
    }
    catch (error)
    {
      const task = this.active;
      this.active = null;
      if (task !== null)
      {
        try
        {
          return { kind: 'interrupted', resumeData: JSON.stringify(task.savable()) };
        }
        catch
        {
          return { kind: 'interrupted', resumeData: null };
        }
      }
      return { kind: 'failed', reason: error instanceof Error ? error.message : 'download_failed' };
    }
  }

  async cancelActive(): Promise<string | null>
  {
    const task = this.active;
    if (task === null)
    {
      return null;
    }
    await task.pauseAsync();
    return JSON.stringify(task.savable());
  }

  fileInfo(localPath: string, withMd5: boolean): { exists: boolean; size: number | null; md5: string | null }
  {
    const file = new File(localPath);
    if (!file.exists)
    {
      return { exists: false, size: null, md5: null };
    }
    const info = file.info({ md5: withMd5 });
    return { exists: true, size: info.size ?? null, md5: info.md5 ?? null };
  }

  deleteFile(localPath: string): void
  {
    const file = new File(localPath);
    if (file.exists)
    {
      file.delete();
    }
  }

  deleteDirectory(parkId: string): void
  {
    const directory = packDirectory(parkId);
    if (directory.exists)
    {
      directory.delete();
    }
  }

  availableBytes(): number
  {
    return Paths.availableDiskSpace;
  }
}
