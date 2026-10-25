import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireManager } from '@/server/auth';
import { savePodcast, setPodcastStatus } from '../../actions';
import { CmsShell, Messages, StatusBadge } from '../../_components/CmsChrome';
import { PodcastFields } from '../../_components/PodcastFields';

export default async function EditPodcastPage({ params, searchParams }: PageProps<'/cms/podcasts/[id]'>)
{
  const manager = await requireManager();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
  {
    notFound();
  }
  const podcast = await manager.content.podcast(id);
  if (podcast === null)
  {
    notFound();
  }
  const nextStatus = podcast.status === 'published' ? 'draft' : 'published';
  return (
    <CmsShell displayName={manager.displayName}>
      <p><Link href={`/cms/landmarks/${podcast.landmark_id}`}>Back to landmark</Link></p>
      <h1>{podcast.title} <StatusBadge status={podcast.status} /></h1>
      <Messages searchParams={await searchParams} />
      <p className="muted">
        {podcast.audio_path === null
          ? 'No audio uploaded yet. Upload a file before publishing.'
          : `Audio: ${podcast.duration_seconds ?? 0} s, ${Math.round((podcast.file_size_bytes ?? 0) / 1024)} KB. Duration and checksums are computed on the server.`}
      </p>
      <form action={setPodcastStatus.bind(null, podcast.id, nextStatus)} className="inline-form">
        <button type="submit" className={nextStatus === 'published' ? 'button-primary' : 'button-secondary'}>
          {nextStatus === 'published' ? 'Publish' : 'Unpublish'}
        </button>
      </form>
      <form action={savePodcast.bind(null, podcast.id)} className="form card">
        <PodcastFields landmarkId={podcast.landmark_id} podcast={podcast} />
        <button type="submit" className="button-primary">Save changes</button>
      </form>
    </CmsShell>
  );
}
