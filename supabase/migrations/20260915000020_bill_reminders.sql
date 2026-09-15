-- Bill / subscription due reminders (§6.10 follow-up).
--
-- The activity notifications in migration 19 are all row-trigger driven — they
-- fire on a member action. A due-date reminder has NO user action to hang a
-- trigger on, so a daily pg_cron job scans bills and writes into the SAME
-- notifications feed (bell / badge / toast / realtime already handle the rest).
--
-- Fires ONCE per cycle, when a bill is exactly LEAD_DAYS out. Matching an exact
-- calendar day (current_date + 3) means the reminder lands on a single day, so
-- there's no daily-duplicate problem; the not-exists guard only protects against
-- a same-day double run of the job. Only 'out' bills (money owed) are reminded.
--
-- ponytail: LEAD_DAYS is hard-coded to 3 in TWO places — the `+ 3` below and the
-- i18n copy `notifications.msg.bill_due_soon` ("...in 3 days"). Change both together.
-- Reminders key off the UTC calendar date; households far from UTC may see it fire
-- a few hours early/late. Fine for v1; wire per-household tz if it ever matters.

create extension if not exists pg_cron;

create or replace function public.notify_bills_due_soon()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (household_id, actor_id, actor_name, type, subject)
  select b.household_id, null, 'Talvori', 'bill_due_soon', b.name
  from public.bills b
  where b.is_active
    and b.direction = 'out'
    and b.next_due_date = current_date + 3
    and not exists (
      select 1 from public.notifications n
      where n.household_id = b.household_id
        and n.type = 'bill_due_soon'
        and n.subject = b.name
        and n.created_at >= current_date
    );
end;
$$;

-- Run once a day at 07:00 UTC. Idempotent: drop any prior schedule first so
-- re-applying this migration doesn't stack duplicate jobs.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'bills-due-soon') then
    perform cron.unschedule('bills-due-soon');
  end if;
end $$;

select cron.schedule('bills-due-soon', '0 7 * * *', $$select public.notify_bills_due_soon()$$);
