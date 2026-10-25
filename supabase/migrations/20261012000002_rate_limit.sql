create table api_rate_limits (
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (key_hash, window_start)
);
alter table api_rate_limits enable row level security;

create function rate_limit_hit(p_key_hash text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into api_rate_limits (key_hash, window_start, request_count)
  values (p_key_hash, v_window, 1)
  on conflict (key_hash, window_start) do update set request_count = api_rate_limits.request_count + 1
  returning request_count into v_count;

  delete from api_rate_limits where window_start < now() - make_interval(secs => p_window_seconds * 10);

  return v_count <= p_max;
end $$;

revoke all on function rate_limit_hit(text, integer, integer) from public, anon, authenticated;
