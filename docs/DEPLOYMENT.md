# Deployment

Two very different targets are supported. Keep them separate.

## A. Static demonstration (synthetic data only)

A public or static host serves the demo-mode build. There is no backend; all data is fictional and browser-local.

```bash
VITE_DATA_MODE=demo VITE_BASE_PATH=/bsa-project-compass/ npm run build
cp dist/index.html dist/404.html   # SPA fallback for GitHub Pages
```

Or run the manual **Deploy static demo** GitHub Action (`.github/workflows/deploy-demo.yml`), then enable Pages for the repository with *Source: GitHub Actions*. Never point a demo build at a real backend, and never load real content into a demo site.

## B. Secure application (recommended approach)

**Recommended hosting:** serve the SPA from a private, SSO-protected host that integrates with the organization identity provider. For example:

- Azure Static Web Apps with Entra ID authentication, restricted to the BSA tenant; or
- Cloudflare Pages with Cloudflare Access (Entra ID), or an internal web host behind the corporate SSO proxy.

Pair it with **Supabase** (managed Postgres, Auth, Storage, Edge Functions) in a region and plan that meets the organization's data-residency and contractual requirements. A self-hosted Supabase is also possible.

### Steps

1. **Create the Supabase project** (separate staging and production).
2. **Apply the schema:**
   ```bash
   supabase link --project-ref <ref>
   supabase db push            # applies supabase/migrations
   ```
3. **Configure authentication.** Enable the Entra ID (`azure`) provider or SAML SSO. Set the site URL and redirect URL to the app origin. Disable email sign-up.
4. **Register people and the first administrator** with the SQL editor (service role):
   ```sql
   insert into organizations (name) values ('BSA') returning id;
   insert into people (name, email, organization, is_system_admin)
   values ('Platform Admin', 'admin@bsa.example', 'BSA', true);
   ```
   Project administrators then manage teams through the app.
5. **Deploy the API function and secrets:**
   ```bash
   supabase functions deploy api
   supabase secrets set ALLOWED_ORIGIN=https://compass.bsa.example
   # Optional, only with an organization-approved provider agreement:
   supabase secrets set AI_PROVIDER=anthropic ANTHROPIC_API_KEY=... AI_MODEL=claude-sonnet-5-5 AI_ALLOWED_CONFIDENTIALITY=public,internal
   ```
6. **Build the web app:**
   ```bash
   VITE_DATA_MODE=supabase VITE_SUPABASE_URL=https://<ref>.supabase.co \
   VITE_SUPABASE_ANON_KEY=<anon> VITE_IDENTITY_PROVIDER=azure npm run build
   ```
   Deploy `dist/` to the private host with an SPA fallback to `index.html`. Set a strict Content-Security-Policy, for example: `default-src 'self'; connect-src 'self' https://<ref>.supabase.co; img-src 'self' data: blob: https://<ref>.supabase.co; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'`.
7. **Verify before any real content:** follow the checklist in [SECURITY.md](SECURITY.md#threats-to-re-verify-when-deploying), then sign in as users with different roles and confirm isolation.

### Migrating from demo mode

Demo data is synthetic and should **not** be migrated into production. Create real projects in the secure app (*New project*) and add actual sources there. If a sandbox structure (principles and drivers without confidential content) needs to be reused, export the register and re-create it in the secure app. A guarded admin import tool is on the roadmap ([ARCHITECTURE.md](ARCHITECTURE.md)).

## Never commit

Confidential documents, secrets, database credentials, API keys, production exports or real project datasets. `.gitignore` excludes `.env*`, `*.pptx`, `*.xlsx`, `/exports` and `/private`.
