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
- Public leaderboard is served by the `leaderboard(_from,_to)` security-definer RPC exposing only names/patrols/km. Why: profiles (phones) stay private.
- Activity status is set by a DB trigger (Strava link → approved, screenshot → pending). Why: users can't self-approve.
- Initial admin is granted by email in the `handle_new_user` trigger; further admins via `set_admin_by_email` RPC.
