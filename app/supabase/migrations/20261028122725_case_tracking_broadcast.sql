-- Private broadcasts are available only to a short-lived token issued after a
-- trusted server has authorised this exact case. Review other policies on
-- realtime.messages before deployment: permissive policies combine with OR.
create policy "case tracking receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = (select auth.jwt() ->> 'case_topic')
    and (select auth.jwt() ->> 'purpose') = 'case_tracking'
    and (select auth.jwt() ->> 'case_topic') ~ '^case:FMC-[0-9]{3,10}:tracking$'
  );

create policy "case tracking publish" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = (select auth.jwt() ->> 'case_topic')
    and (select auth.jwt() ->> 'purpose') = 'case_tracking'
    and (select auth.jwt() ->> 'tracking_publish') = 'true'
    and (select auth.jwt() ->> 'case_topic') ~ '^case:FMC-[0-9]{3,10}:tracking$'
  );
