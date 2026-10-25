export type TransferResult =
  | { kind: 'done' }
  | { kind: 'interrupted'; resumeData: string | null }
  | { kind: 'failed'; reason: string };

export interface FileTransport
{
  ensureDirectory(parkId: string): string;
  download(url: string, localPath: string, resumeData: string | null, onProgress: (bytesWritten: number) => void): Promise<TransferResult>;
  cancelActive(): Promise<string | null>;
  fileInfo(localPath: string, withMd5: boolean): { exists: boolean; size: number | null; md5: string | null };
  deleteFile(localPath: string): void;
  deleteDirectory(parkId: string): void;
  availableBytes(): number;
}
