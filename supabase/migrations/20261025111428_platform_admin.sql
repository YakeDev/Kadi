begin;
create schema if not exists kadi_private;
revoke all on schema kadi_private from public, anon, authenticated;
grant usage on schema kadi_private to service_role;

create table kadi_private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  grant_reason text not null check (length(grant_reason) between 1 and 500),
  revoked_at timestamptz check (revoked_at is null or revoked_at >= granted_at)
);
create table kadi_private.platform_activity_days (
  activity_day date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key(activity_day,user_id)
);
create table kadi_private.platform_config (
  singleton boolean primary key default true check(singleton),
  activity_tracking_started_at timestamptz not null default now()
);
insert into kadi_private.platform_config default values;
alter table kadi_private.platform_admins enable row level security;
alter table kadi_private.platform_activity_days enable row level security;
alter table kadi_private.platform_config enable row level security;
revoke all on all tables in schema kadi_private from public,anon,authenticated,service_role;
grant select on kadi_private.platform_admins,kadi_private.platform_config to service_role;
grant select,insert,update on kadi_private.platform_activity_days to service_role;

create function public.kadi_platform_admin_status(p_actor_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from kadi_private.platform_admins where user_id=p_actor_id and revoked_at is null);
$$;

create function public.kadi_platform_session(p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare tenant uuid; business_day date := (now() at time zone 'Africa/Lubumbashi')::date;
begin
  select tenant_id into tenant from public.profiles where id=p_actor_id;
  if tenant is null then raise exception using errcode='PT403',message='Profil entreprise introuvable.'; end if;
  insert into kadi_private.platform_activity_days(activity_day,user_id,tenant_id)
    values(business_day,p_actor_id,tenant)
    on conflict(activity_day,user_id) do update set last_seen_at=excluded.last_seen_at
    where kadi_private.platform_activity_days.last_seen_at < now()-interval '10 minutes';
  return jsonb_build_object('is_super_admin',public.kadi_platform_admin_status(p_actor_id));
end $$;

create function public.kadi_platform_overview(p_actor_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  zone text := 'Africa/Lubumbashi';
  start_at timestamptz; end_at timestamptz; start_utc timestamp; end_utc timestamp;
  day_counts jsonb; period_counts jsonb;
begin
  if not public.kadi_platform_admin_status(p_actor_id) then
    raise exception using errcode='PT403',message='Accès réservé au Super administrateur.';
  end if;
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>365 or p_to>(now() at time zone zone)::date then
    raise exception using errcode='PT400',message='Choisissez une période valide de 366 jours au maximum, sans date future.';
  end if;
  start_at := p_from::timestamp at time zone zone;
  end_at := (p_to+1)::timestamp at time zone zone;
  -- Legacy timestamp-without-time-zone columns were written in UTC.
  start_utc := start_at at time zone 'UTC'; end_utc := end_at at time zone 'UTC';
  with events as (
    select ((created_at at time zone 'UTC') at time zone zone)::date as day,'companies_registered' as metric,count(*) as n
      from public.tenants where created_at>=start_utc and created_at<end_utc group by 1
    union all select ((created_at at time zone 'UTC') at time zone zone)::date,'users_registered',count(*)
      from public.profiles where created_at>=start_utc and created_at<end_utc group by 1
    union all select ((created_at at time zone 'UTC') at time zone zone)::date,'invoices_created',count(*)
      from public.invoices where created_at>=start_utc and created_at<end_utc group by 1
    union all select (issued_at at time zone zone)::date,'invoices_issued',count(*)
      from public.invoices where issued_at>=start_at and issued_at<end_at group by 1
    union all select (created_at at time zone zone)::date,'quotes_created',count(*)
      from public.quotes where created_at>=start_at and created_at<end_at group by 1
    union all select (converted_at at time zone zone)::date,'quotes_converted',count(*)
      from public.quotes where converted_at>=start_at and converted_at<end_at group by 1
    union all select (created_at at time zone zone)::date,'receipts_recorded',count(*)
      from public.invoice_payments where created_at>=start_at and created_at<end_at group by 1
    union all select activity_day,'users_active',count(distinct user_id)
      from kadi_private.platform_activity_days where activity_day between p_from and p_to group by 1
    union all select activity_day,'companies_active',count(distinct tenant_id)
      from kadi_private.platform_activity_days where activity_day between p_from and p_to group by 1
  ), days as (
    select generate_series(p_from::timestamp,p_to::timestamp,interval '1 day')::date as date
  ), daily as (
    select d.date,
      coalesce(sum(n) filter(where metric='companies_registered'),0)::bigint as companies_registered,
      coalesce(sum(n) filter(where metric='users_registered'),0)::bigint as users_registered,
      coalesce(sum(n) filter(where metric='invoices_created'),0)::bigint as invoices_created,
      coalesce(sum(n) filter(where metric='invoices_issued'),0)::bigint as invoices_issued,
      coalesce(sum(n) filter(where metric='quotes_created'),0)::bigint as quotes_created,
      coalesce(sum(n) filter(where metric='quotes_converted'),0)::bigint as quotes_converted,
      coalesce(sum(n) filter(where metric='receipts_recorded'),0)::bigint as receipts_recorded,
      coalesce(sum(n) filter(where metric='users_active'),0)::bigint as users_active,
      coalesce(sum(n) filter(where metric='companies_active'),0)::bigint as companies_active
    from days d left join events e on e.day=d.date group by d.date
  )
  select jsonb_agg(to_jsonb(daily) order by date),jsonb_build_object(
    'companies_registered',sum(companies_registered),'users_registered',sum(users_registered),
    'invoices_created',sum(invoices_created),'invoices_issued',sum(invoices_issued),
    'quotes_created',sum(quotes_created),'quotes_converted',sum(quotes_converted),
    'receipts_recorded',sum(receipts_recorded),
    'users_active',(select count(distinct user_id) from kadi_private.platform_activity_days where activity_day between p_from and p_to),
    'companies_active',(select count(distinct tenant_id) from kadi_private.platform_activity_days where activity_day between p_from and p_to)
  ) into day_counts,period_counts from daily;
  return jsonb_build_object(
    'generated_at',now(),'range',jsonb_build_object('from',p_from,'to',p_to,'time_zone',zone),
    'totals',jsonb_build_object('companies',(select count(*) from public.tenants),'users',(select count(*) from public.profiles),
      'invoices',(select count(*) from public.invoices),'quotes',(select count(*) from public.quotes)),
    'period',period_counts,'daily',day_counts,
    'invoice_statuses',(select coalesce(jsonb_object_agg(category,n),'{}'::jsonb) from (
      select case when status not in('draft','paid') and total_amount>paid_amount and due_date<(now() at time zone zone)::date then 'overdue' else status end as category,count(*) as n
      from public.invoices group by 1) s),
    'activity_tracking_started_at',(select activity_tracking_started_at from kadi_private.platform_config),
    'historical_issued_without_timestamp',(select count(*) from public.invoices where status<>'draft' and issued_at is null)
  );
end $$;

revoke all on function public.kadi_platform_admin_status(uuid),public.kadi_platform_session(uuid),public.kadi_platform_overview(uuid,date,date) from public,anon,authenticated;
grant execute on function public.kadi_platform_admin_status(uuid),public.kadi_platform_session(uuid),public.kadi_platform_overview(uuid,date,date) to service_role;
create index invoices_platform_created_idx on public.invoices(created_at);
create index invoices_platform_issued_idx on public.invoices(issued_at) where issued_at is not null;
commit;
