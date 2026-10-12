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

- Keep the ERP shell and identity/data provider in shared components; each navigation destination has a separate TanStack leaf route for direct navigation and page metadata.
- Store factory workflow mutations in the authenticated transactional `factory_action` PostgreSQL function; deny direct quantity writes to keep allocation, production, dispatch and payroll consistent.
- All operational records belong to one shared factory workspace accessible to authenticated accounts, matching the PRD; separate protected user_roles stores administrative permissions.
- Use manifest-only installability and a dedicated messaging worker, not an app-shell caching worker; offline use was not requested.
- Native push uses Worker-compatible Web Crypto and durable server-only VAPID keys, so the application needs no third-party notification account.
- Pre-optimize shared browser dependencies and reject outdated optimized-module requests in Vite; mixed React optimizer generations cause null hook dispatchers during preview updates.
