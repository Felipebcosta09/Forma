-- FORMA 2.2 — Execute uma vez no SQL Editor do seu projeto Supabase.
-- Email e senha são administrados pelo Supabase Auth; nunca armazenamos senhas na tabela.

create table if not exists public.forma_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint forma_profile_is_object check (jsonb_typeof(profile_data) = 'object')
);

create index if not exists forma_profiles_updated_at_idx on public.forma_profiles(updated_at desc);

alter table public.forma_profiles enable row level security;

-- Só pessoas autenticadas podem manipular sua própria linha.
revoke all on table public.forma_profiles from anon, authenticated;
grant select, insert, update on table public.forma_profiles to authenticated;

drop policy if exists "forma_select_own" on public.forma_profiles;
create policy "forma_select_own" on public.forma_profiles
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "forma_insert_own" on public.forma_profiles;
create policy "forma_insert_own" on public.forma_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "forma_update_own" on public.forma_profiles;
create policy "forma_update_own" on public.forma_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Nenhuma política de DELETE. O botão Limpar registros restaura o JSON da própria conta.
-- Nunca coloque a service_role key no HTML, no JavaScript ou no Netlify público.
