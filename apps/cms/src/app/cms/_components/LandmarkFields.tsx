import { LANDMARK_CATEGORIES } from '@singalore/shared';
import type { LandmarkRecord, ParkSummary } from '@/server/contentRepository';

export function LandmarkFields({ parks, landmark }: { parks: ParkSummary[]; landmark: LandmarkRecord | null })
{
  return (
    <>
      <label>
        Heritage park
        <select name="parkId" defaultValue={landmark?.park_id ?? ''} required>
          <option value="" disabled>Choose a park</option>
          {parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
        </select>
      </label>
      <label>
        Name
        <input name="name" defaultValue={landmark?.name ?? ''} maxLength={120} required />
      </label>
      <label>
        Slug (leave empty to generate from the name)
        <input name="slug" defaultValue={landmark?.slug ?? ''} pattern="[a-z0-9-]*" maxLength={80} />
      </label>
      <label>
        Category
        <select name="category" defaultValue={landmark?.category ?? 'other'}>
          {LANDMARK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <div className="row">
        <label>
          Latitude
          <input name="lat" type="number" step="any" defaultValue={landmark?.lat ?? ''} required />
        </label>
        <label>
          Longitude
          <input name="lng" type="number" step="any" defaultValue={landmark?.lng ?? ''} required />
        </label>
        <label>
          Geofence radius (m, 15 to 100)
          <input name="geofenceRadiusM" type="number" min={15} max={100} defaultValue={landmark?.geofence_radius_m ?? 30} required />
        </label>
      </div>
      <label>
        Short description (shown on the summary card)
        <textarea name="shortDescription" defaultValue={landmark?.short_description ?? ''} maxLength={280} rows={3} />
      </label>
      <label>
        Full description
        <textarea name="description" defaultValue={landmark?.description ?? ''} rows={8} />
      </label>
      <div className="row">
        <label>
          Built year
          <input name="builtYear" type="number" min={1000} max={2100} defaultValue={landmark?.built_year ?? ''} />
        </label>
        <label>
          Architectural style
          <input name="architecturalStyle" defaultValue={landmark?.architectural_style ?? ''} />
        </label>
      </div>
    </>
  );
}
