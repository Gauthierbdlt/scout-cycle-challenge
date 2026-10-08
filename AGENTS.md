<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Architecture rules

- Data access goes through the browser client with RLS; admin rights are enforced by `has_role` in policies. Why: simple app, security lives in the database.
- `profiles` is private (own row or admin). Public pages read the `profiles_public` view (no email/phone; for visitors without an account the name is masked as « Prénom I. » and `strava_url` is null) or the `leaderboard(_from,_to)` RPC. Why: scouts are minors.
- `activities` is readable by logged-in members only. Public pages read the `activities_public` view (km, D+, date, status, sport tag only — no GPX, Strava link, photo or free note).
- Password recovery: e-mail link to `/nouveau-mot-de-passe` (needs custom SMTP in Supabase to reach scouts) and `admin_set_password` RPC for admins (cannot target another admin).
- Activity status is set by the `set_activity_status` DB trigger (Strava link → approved, screenshot → pending; only admins may change it). Why: users can't self-approve.
- `profiles.is_admin` mirrors `user_roles` (trigger) and cannot be changed by non-admins; policies use `has_role` only.
- Storage `proofs`: files are named `<user_id>_<timestamp>.<ext>` or `proposed_<user_id>_…`; users manage only their own prefix, admins all.
- DB changes go in `supabase/migrations/` and are tested locally with `supabase/tests/` before being applied.
- Initial admin is granted by email in the `handle_new_user` trigger; further admins via `set_admin_by_email` RPC.
