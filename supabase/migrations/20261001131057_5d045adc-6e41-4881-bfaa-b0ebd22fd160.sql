revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.activity_status_guard() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, app_role) from public, anon;
revoke execute on function public.set_admin_by_email(text, boolean) from public, anon;