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
- `activities` is readable by logged-in members only. Public pages read the `activities_public` view (km, D+, date, status, sport tag, group id only — no GPX, Strava link, photo or free note).
- Password recovery: e-mail link to `/nouveau-mot-de-passe` (needs custom SMTP in Supabase to reach scouts) and `admin_set_password` RPC for admins (cannot target another admin).
- Activity status is set by the `set_activity_status` DB trigger (Strava link → approved, screenshot → pending; only admins may change it). Why: users can't self-approve.
- `profiles.is_admin` mirrors `user_roles` (trigger) and cannot be changed by non-admins; policies use `has_role` only.
- « Peloton » ranking (group rides): `group_rides` + `group_ride_members` (members-only); each participant links their OWN activity via `activities.group_ride_id`. The `check_activity_group` trigger drops the link unless the author is a member, same date and sport, one activity per group. Group size = approved linked activities; points computed client-side in `src/lib/peloton.ts`. Why: nobody earns points from someone else's unproven ride.
- Birthdays: optional `profiles.birth_day` + `birth_month` only (never the year — scouts are minors). Not in `profiles_public`; members read them only through the `upcoming_birthdays(_days)` RPC (authenticated only, today → +7 days, Europe/Brussels).
- Festive theme: settings in `site_settings` (readable by everyone, writable by admins only via `has_role`): `theme` (default | automne | halloween | noel | valentin | paques | printemps | ete | course24h), `theme_mode` (auto = calendar in `themeForDate()` of `src/lib/seasonalTheme.ts`, or manuel), `theme_intensity` (festif | discret = no animation), `background:<theme>` (https URL of a hero photo in the public `backgrounds` bucket, admin-only upload). Applied as `<html data-theme>`; colors override the shadcn CSS variables in `src/styles.css`, decorations live in `SeasonalDecor.tsx` (`HeaderTrim` hangs under the header). Dark themes (halloween, noel, course24h) also enable the `dark:` variant. Admin preview is per-tab (sessionStorage); visitors can switch animations off (localStorage); `prefers-reduced-motion` hides particles.
- Storage `proofs`: files are named `<user_id>_<timestamp>.<ext>` or `proposed_<user_id>_…`; users manage only their own prefix, admins all.
- DB changes go in `supabase/migrations/` and are tested locally with `supabase/tests/` before being applied.
- Initial admin is granted by email in the `handle_new_user` trigger; further admins via `set_admin_by_email` RPC.
