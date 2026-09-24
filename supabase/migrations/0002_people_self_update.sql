-- Editing an existing person's data normally has to go through
-- change_requests + creator approval (see 0001_init.sql). Your own
-- auto-provisioned node is a narrow, safe exception: you are both the
-- creator and the claimant of that one row, so requiring your own
-- approval to edit your own name would be pointless ceremony.
create policy "you can edit your own claimed profile"
  on public.people for update
  using (auth.uid() = claimed_by_user_id and auth.uid() = created_by)
  with check (auth.uid() = claimed_by_user_id and auth.uid() = created_by);
