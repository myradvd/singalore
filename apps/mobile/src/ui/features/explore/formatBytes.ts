export function formatBytes(bytes: number): string
{
  if (bytes < 1024)
  {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024)
  {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Formats bytes always in megabytes with one decimal, for the download progress label.
export function formatMegabytes(bytes: number): string
{
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
