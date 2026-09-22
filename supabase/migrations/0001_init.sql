create extension if not exists "uuid-ossp";

create table public.trees (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default uuid_generate_v4(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  full_name text not null,
  photo_url text,
  birth_date date,
  birth_place text,
  death_date date,
  death_place text,
  is_living boolean not null default true,
  attributes jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  claimed_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.relationships (
  id uuid primary key default uuid_generate_v4(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  parent_id uuid not null references public.people(id) on delete cascade,
  child_id uuid not null references public.people(id) on delete cascade,
  type text not null check (type in ('biological', 'adoptive')),
  created_at timestamptz not null default now(),
  unique (parent_id, child_id)
);

create table public.tree_memberships (
  id uuid primary key default uuid_generate_v4(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  unique (tree_id, user_id)
);

create table public.invitations (
  id uuid primary key default uuid_generate_v4(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default now()
);

create table public.change_requests (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references public.people(id) on delete cascade,
  proposed_by uuid not null references auth.users(id),
  proposed_changes jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.change_history (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references public.people(id) on delete cascade,
  change_request_id uuid not null references public.change_requests(id),
  applied_changes jsonb not null,
  proposed_by uuid not null references auth.users(id),
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.trees enable row level security;
alter table public.people enable row level security;
alter table public.relationships enable row level security;
alter table public.tree_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.change_requests enable row level security;
alter table public.change_history enable row level security;

create or replace function public.is_tree_member(target_tree_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.tree_memberships
    where tree_id = target_tree_id and user_id = auth.uid()
  );
$$;

create policy "members can view their trees"
  on public.trees for select
  using (public.is_tree_member(id));

create policy "members can view people in their trees"
  on public.people for select
  using (public.is_tree_member(tree_id));

create policy "members can add people to their trees"
  on public.people for insert
  with check (public.is_tree_member(tree_id) and created_by = auth.uid());

create policy "members can view relationships in their trees"
  on public.relationships for select
  using (public.is_tree_member(tree_id));

create policy "members can add relationships in their trees"
  on public.relationships for insert
  with check (public.is_tree_member(tree_id));

create policy "members can view memberships of their trees"
  on public.tree_memberships for select
  using (public.is_tree_member(tree_id));

create policy "members can view invitations in their trees"
  on public.invitations for select
  using (
    public.is_tree_member(tree_id)
    or email = auth.jwt() ->> 'email'
  );

create policy "members can create invitations in their trees"
  on public.invitations for insert
  with check (public.is_tree_member(tree_id) and invited_by = auth.uid());

create policy "members can view change requests in their trees"
  on public.change_requests for select
  using (
    exists (
      select 1 from public.people
      where people.id = change_requests.person_id
        and public.is_tree_member(people.tree_id)
    )
  );

create policy "members can propose change requests"
  on public.change_requests for insert
  with check (
    proposed_by = auth.uid()
    and exists (
      select 1 from public.people
      where people.id = change_requests.person_id
        and public.is_tree_member(people.tree_id)
    )
  );

create policy "only the node creator can decide a change request"
  on public.change_requests for update
  using (
    exists (
      select 1 from public.people
      where people.id = change_requests.person_id
        and people.created_by = auth.uid()
    )
  );

create policy "members can view change history in their trees"
  on public.change_history for select
  using (
    exists (
      select 1 from public.people
      where people.id = change_history.person_id
        and public.is_tree_member(people.tree_id)
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tree_id uuid;
begin
  insert into public.trees default values returning id into new_tree_id;

  insert into public.people (tree_id, full_name, is_living, created_by, claimed_by_user_id)
  values (
    new_tree_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    true,
    new.id,
    new.id
  );

  insert into public.tree_memberships (tree_id, user_id)
  values (new_tree_id, new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
