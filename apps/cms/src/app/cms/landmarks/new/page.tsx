import { requireManager } from '@/server/auth';
import { saveLandmark } from '../../actions';
import { CmsShell, Messages } from '../../_components/CmsChrome';
import { LandmarkFields } from '../../_components/LandmarkFields';

export default async function NewLandmarkPage({ searchParams }: PageProps<'/cms/landmarks/new'>)
{
  const manager = await requireManager();
  const parks = await manager.content.parks();
  return (
    <CmsShell displayName={manager.displayName}>
      <h1>New landmark</h1>
      <Messages searchParams={await searchParams} />
      <form action={saveLandmark.bind(null, null)} className="form card">
        <LandmarkFields parks={parks} landmark={null} />
        <button type="submit" className="button-primary">Create draft</button>
      </form>
    </CmsShell>
  );
}
