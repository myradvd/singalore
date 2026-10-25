import Link from 'next/link';
import { requireManager } from '@/server/auth';
import { CmsShell, Messages, StatusBadge } from './_components/CmsChrome';

export default async function DashboardPage({ searchParams }: PageProps<'/cms'>)
{
  const manager = await requireManager();
  const [parks, landmarks] = await Promise.all([manager.content.parks(), manager.content.landmarks()]);
  return (
    <CmsShell displayName={manager.displayName}>
      <h1>Landmarks</h1>
      <Messages searchParams={await searchParams} />
      <p><Link href="/cms/landmarks/new" className="button-primary">New landmark</Link></p>
      {parks.map((park) =>
      {
        const parkLandmarks = landmarks.filter((landmark) => landmark.park_id === park.id);
        return (
          <section key={park.id} className="card">
            <h2>{park.name} <StatusBadge status={park.status} /></h2>
            {parkLandmarks.length === 0 && <p className="muted">No landmarks yet.</p>}
            <ul className="list">
              {parkLandmarks.map((landmark) => (
                <li key={landmark.id}>
                  <Link href={`/cms/landmarks/${landmark.id}`}>{landmark.name}</Link> <StatusBadge status={landmark.status} />
                  <span className="muted">{` updated ${new Date(landmark.updated_at).toLocaleString('en-SG')}`}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </CmsShell>
  );
}
