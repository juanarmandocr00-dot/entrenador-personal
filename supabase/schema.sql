-- Mi Entrenador: base de datos con acceso solo para tu usuario y verificación en dos pasos obligatoria.
-- Ejecuta este archivo completo en Supabase > SQL Editor.

create table if not exists public.docs (
  user_id    uuid not null references auth.users(id) on delete cascade,
  path       text not null check (path ~ '^(perfil|semanas|pesos|molestias)/[A-Za-z0-9_-]{1,40}$'),
  data       jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 65536),
  updated_at timestamptz not null default now(),
  primary key (user_id, path)
);

alter table public.docs enable row level security;
alter table public.docs force row level security;

-- Sin acceso para visitantes anónimos. Solo usuarios con sesión.
revoke all on public.docs from anon, public;
grant select, insert, update, delete on public.docs to authenticated;

create policy docs_select_own on public.docs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy docs_insert_own on public.docs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy docs_update_own on public.docs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy docs_delete_own on public.docs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Verificación en dos pasos obligatoria: sin código TOTP el token no pasa de aal1 y no ve nada.
create policy docs_require_mfa on public.docs as restrictive for all to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2')
  with check (((select auth.jwt()) ->> 'aal') = 'aal2');

-- Tope de filas por usuario y fecha de actualización.
create or replace function public.docs_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and (select count(*) from public.docs where user_id = new.user_id) >= 3000 then
    raise exception 'limite de documentos alcanzado';
  end if;
  return new;
end $$;
revoke all on function public.docs_guard() from public, anon, authenticated;

drop trigger if exists docs_guard_trg on public.docs;
create trigger docs_guard_trg before insert or update on public.docs
  for each row execute function public.docs_guard();

-- Límite diario de consultas al coach. Solo lo usa la función del servidor (service_role).
create table if not exists public.coach_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default ((now() at time zone 'utc')::date),
  n       int  not null default 0,
  primary key (user_id, day)
);
alter table public.coach_usage enable row level security;
revoke all on public.coach_usage from anon, authenticated, public;

create or replace function public.coach_hit(p_user uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  insert into public.coach_usage (user_id, day, n)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set n = public.coach_usage.n + 1
  returning n into v;
  return v <= p_limit;
end $$;
revoke all on function public.coach_hit(uuid, int) from public, anon, authenticated;
grant execute on function public.coach_hit(uuid, int) to service_role;
