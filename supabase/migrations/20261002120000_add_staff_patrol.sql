-- Add Staff patrol to the patrols table
insert into public.patrols (name, category)
values ('Staff', 'homme')
on conflict (name) do nothing;
