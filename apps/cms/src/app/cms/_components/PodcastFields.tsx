import type { PodcastRecord } from '@/server/contentRepository';

export function PodcastFields({ landmarkId, podcast }: { landmarkId: string; podcast: PodcastRecord | null })
{
  return (
    <>
      <input type="hidden" name="landmarkId" value={landmarkId} />
      <label>
        Title
        <input name="title" defaultValue={podcast?.title ?? ''} maxLength={200} required />
      </label>
      <div className="row">
        <label>
          Voice (for example Male or Female)
          <input name="voice" defaultValue={podcast?.voice ?? ''} />
        </label>
        <label>
          Accent (for example British)
          <input name="accent" defaultValue={podcast?.accent ?? ''} />
        </label>
      </div>
      <label>
        {podcast?.audio_path === null || podcast === null ? 'Audio file (M4A, AAC or MP3, up to 50 MB)' : 'Replace audio file (optional)'}
        <input name="audio" type="file" accept="audio/mp4,audio/x-m4a,audio/aac,audio/mpeg" />
      </label>
      <label>
        Transcript
        <textarea name="transcript" defaultValue={podcast?.transcript ?? ''} rows={10} />
      </label>
    </>
  );
}
