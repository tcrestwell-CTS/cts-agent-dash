UPDATE public.trips SET user_id='28b6ea88-f54b-4723-a6d3-06f5e6f620de'
WHERE id IN ('5943720d-1b5a-4056-8c18-89a3e206b05e','ca3382cd-701b-4274-97ae-fd0aab7f5097','99ff8471-f8f4-4f42-a1f7-f47a9a9f09ce')
   OR parent_trip_id IN ('5943720d-1b5a-4056-8c18-89a3e206b05e','ca3382cd-701b-4274-97ae-fd0aab7f5097','99ff8471-f8f4-4f42-a1f7-f47a9a9f09ce');