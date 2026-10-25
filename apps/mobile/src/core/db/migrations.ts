import type { DbAdapter } from './DbAdapter';

export interface Migration
{
  version: number;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      'create table meta (key text primary key, value text not null)',
      `create table parks (id text primary key, slug text not null, name text not null, district text not null,
        short_description text not null, center_lat real not null, center_lng real not null, boundary_json text,
        thumbnail_url text, landmark_count integer not null, pack_bytes integer not null, attribution text not null)`,
      `create table landmarks (id text primary key, park_id text not null, slug text not null, name text not null,
        aliases_json text not null, category text not null, lat real not null, lng real not null,
        geofence_radius_m integer not null, short_description text not null, thumbnail_url text, built_year integer,
        architectural_style text, sort_order integer not null, attribution text not null)`,
      'create index landmarks_park on landmarks(park_id)',
      `create table podcasts (id text primary key, landmark_id text not null, title text not null, audio_url text not null,
        duration_seconds integer not null, file_size_bytes integer not null, voice text, accent text, length_class text,
        has_transcript integer not null)`,
      'create index podcasts_landmark on podcasts(landmark_id)',
      'create table landmark_detail (landmark_id text primary key, description text not null, image_url text, image_local_path text)',
      'create table podcast_detail (podcast_id text primary key, transcript text)',
      `create table downloads (park_id text primary key, state text not null check (state in
        ('not_downloaded','downloading','paused','downloaded','failed','update_available')),
        pack_etag text, total_bytes integer not null default 0, done_bytes integer not null default 0,
        error_code text, updated_at text not null, completed_at text)`,
      `create table download_files (park_id text not null, url text not null, kind text not null, bytes integer not null,
        md5 text, sha256 text, local_path text not null,
        state text not null check (state in ('pending','active','paused','done','failed')),
        resume_savable text, podcast_id text, landmark_id text, primary key (park_id, url))`,
      `create table audio_session (id integer primary key check (id = 1), session_id text not null, podcast_id text not null,
        landmark_id text not null, position_ms integer not null, playback_state text not null, rate real not null,
        source text not null check (source in ('local','stream')), updated_at text not null)`,
      `create table flow_cache (id integer primary key check (id = 1),
        mode text not null check (mode in ('empty','route_editor','route_in_progress')),
        payload_json text not null, updated_at text not null)`,
      'create table preferences (key text primary key, value_json text not null)',
      `create table itineraries (id text primary key, title text not null, landmark_ids_json text not null,
        is_draft integer not null, auto_ordered integer not null default 0, created_at text not null, updated_at text not null)`,
      `create table saved_items (id text primary key, item_type text not null check (item_type in ('landmark','itinerary')),
        reference_id text not null, saved_at text not null, unique (item_type, reference_id))`,
      `create table tour_history (id text primary key, itinerary_id text, landmark_ids_json text not null, title text not null,
        started_at text not null, ended_at text not null,
        completion_status text not null check (completion_status in ('completed','abandoned')),
        completed_landmark_ids_json text not null)`,
      `create table diagnostics_log (id integer primary key autoincrement, at text not null, level text not null,
        code text not null, detail text)`,
      `create trigger diagnostics_ring after insert on diagnostics_log begin
        delete from diagnostics_log where id <= new.id - 500; end`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.reduce((max, migration) => Math.max(max, migration.version), 0);

export async function readSchemaVersion(db: DbAdapter): Promise<number>
{
  const row = await db.first('pragma user_version');
  if (row !== null && typeof row === 'object' && 'user_version' in row && typeof row.user_version === 'number')
  {
    return row.user_version;
  }
  return 0;
}

export async function migrate(db: DbAdapter, migrations: readonly Migration[] = MIGRATIONS): Promise<number>
{
  const current = await readSchemaVersion(db);
  const pending = [...migrations].filter((migration) => migration.version > current).sort((a, b) => a.version - b.version);
  for (const migration of pending)
  {
    await db.transaction(async (transaction) =>
    {
      for (const statement of migration.statements)
      {
        await transaction.exec(statement);
      }
      await transaction.exec(`pragma user_version = ${migration.version}`);
    });
  }
  return pending.length === 0 ? current : (pending[pending.length - 1]?.version ?? current);
}
