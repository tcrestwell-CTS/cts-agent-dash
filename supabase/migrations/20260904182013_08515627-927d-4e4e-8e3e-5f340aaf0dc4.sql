insert into public.training_user_progress (user_id, module_id, phase_id, status, percent_complete, completed_at, last_viewed_at)
select p.user_id, m.id, m.phase_id, 'completed', 100, now(), now()
from public.training_modules_v2 m
join public.training_user_progress p on p.lesson_id in (select l.id from public.training_lessons l where l.module_id = m.id)
group by p.user_id, m.id, m.phase_id
having count(distinct p.lesson_id) filter (where p.status = 'completed')
     = (select count(*) from public.training_lessons l where l.module_id = m.id)
   and not exists (
     select 1 from public.training_user_progress mp
     where mp.user_id = p.user_id and mp.module_id = m.id and mp.lesson_id is null
   );

update public.training_user_progress mp
set status = 'completed', percent_complete = 100, completed_at = coalesce(completed_at, now())
where mp.lesson_id is null and mp.module_id is not null and mp.status <> 'completed'
  and (select count(*) from public.training_lessons l where l.module_id = mp.module_id) > 0
  and (select count(*) from public.training_lessons l where l.module_id = mp.module_id)
    = (select count(*) from public.training_user_progress lp
       join public.training_lessons l2 on l2.id = lp.lesson_id
       where lp.user_id = mp.user_id and l2.module_id = mp.module_id and lp.status = 'completed');