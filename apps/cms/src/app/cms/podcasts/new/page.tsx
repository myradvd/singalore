import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireManager } from '@/server/auth';
import { savePodcast } from '../../actions';
import { CmsShell, Messages } from '../../_components/CmsChrome';
import { PodcastFields } from '../../_components/PodcastFields';

export default async function NewPodcastPage({ searchParams }: PageProps<'/cms/podcasts/new'>)
{
  const manager = await requireManager();
  const query = await searchParams;
  const landmarkId = z.uuid().safeParse(query.landmarkId);
  if (!landmarkId.success)
  {
    notFound();
  }
  const landmark = await manager.content.landmark(landmarkId.data);
  if (landmark === null)
  {
    notFound();
  }
  return (
    <CmsShell displayName={manager.displayName}>
      <p><Link href={`/cms/landmarks/${landmark.id}`}>{`Back to ${landmark.name}`}</Link></p>
      <h1>New podcast</h1>
      <Messages searchParams={query} />
      <form action={savePodcast.bind(null, null)} className="form card">
        <PodcastFields landmarkId={landmark.id} podcast={null} />
        <button type="submit" className="button-primary">Create draft</button>
      </form>
    </CmsShell>
  );
}
