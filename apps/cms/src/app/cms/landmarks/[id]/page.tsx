import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireManager } from '@/server/auth';
import { saveLandmark, setLandmarkStatus } from '../../actions';
import { CmsShell, Messages, StatusBadge } from '../../_components/CmsChrome';
import { LandmarkFields } from '../../_components/LandmarkFields';

export default async function EditLandmarkPage({ params, searchParams }: PageProps<'/cms/landmarks/[id]'>)
{
  const manager = await requireManager();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
  {
    notFound();
  }
  const [parks, landmark, podcasts] = await Promise.all([manager.content.parks(), manager.content.landmark(id), manager.content.podcastsFor(id)]);
  if (landmark === null)
  {
    notFound();
  }
  const nextStatus = landmark.status === 'published' ? 'draft' : 'published';
  return (
    <CmsShell displayName={manager.displayName}>
      <h1>{landmark.name} <StatusBadge status={landmark.status} /></h1>
      <Messages searchParams={await searchParams} />
      <form action={setLandmarkStatus.bind(null, landmark.id, nextStatus)} className="inline-form">
        <button type="submit" className={nextStatus === 'published' ? 'button-primary' : 'button-secondary'}>
          {nextStatus === 'published' ? 'Publish' : 'Unpublish'}
        </button>
        <span className="muted">Published landmarks appear in the app after the next catalog sync.</span>
      </form>
      <form action={saveLandmark.bind(null, landmark.id)} className="form card">
        <LandmarkFields parks={parks} landmark={landmark} />
        <button type="submit" className="button-primary">Save changes</button>
      </form>
      <section className="card">
        <h2>Podcasts</h2>
        {podcasts.length === 0 && <p className="muted">No podcasts yet. Visitors will see the landmark without a Listen button.</p>}
        <ul className="list">
          {podcasts.map((podcast) => (
            <li key={podcast.id}>
              <Link href={`/cms/podcasts/${podcast.id}`}>{podcast.title}</Link> <StatusBadge status={podcast.status} />
              <span className="muted">{podcast.duration_seconds === null ? ' no audio yet' : ` ${podcast.duration_seconds} s`}</span>
            </li>
          ))}
        </ul>
        <p><Link href={`/cms/podcasts/new?landmarkId=${landmark.id}`} className="button-secondary">Add podcast</Link></p>
      </section>
    </CmsShell>
  );
}
