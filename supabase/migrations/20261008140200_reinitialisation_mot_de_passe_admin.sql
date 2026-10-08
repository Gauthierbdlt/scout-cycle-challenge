-- =====================================================================
-- Réinitialisation d'un mot de passe par un admin
--
-- Le serveur d'e-mails par défaut de Supabase n'envoie qu'aux membres de
-- l'équipe Supabase : un scout ne recevrait pas l'e-mail « mot de passe
-- oublié » tant qu'un serveur SMTP n'est pas configuré. Un admin peut donc
-- définir un mot de passe temporaire pour un scout depuis la page admin.
--
-- Garde-fous : réservé aux admins ; impossible de modifier le mot de passe
-- d'un autre admin ; 6 caractères minimum.
-- =====================================================================

create or replace function public.admin_set_password(_user_id uuid, _password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Interdit';
  end if;
  if _password is null or length(_password) < 6 or length(_password) > 72 then
    raise exception 'Le mot de passe doit faire entre 6 et 72 caractères';
  end if;
  if _user_id <> auth.uid() and public.has_role(_user_id, 'admin') then
    raise exception 'Impossible de modifier le mot de passe d''un autre admin';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = _user_id;

  if not found then
    raise exception 'Compte introuvable';
  end if;
end; $$;

revoke execute on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
