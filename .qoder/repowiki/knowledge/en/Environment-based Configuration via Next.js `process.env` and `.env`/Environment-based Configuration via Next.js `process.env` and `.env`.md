---
kind: configuration_system
name: Environment-based Configuration via Next.js `process.env` and `.env`
category: configuration_system
scope:
    - '**'
source_files:
    - .env
    - src/api/client.js
    - components/reseller/ResellerSignup.tsx
    - components/reseller/resellerFgtPass.tsx
    - next.config.ts
---

## What system/approach is used

The application uses a minimal, environment-variable-driven configuration approach built on top of Next.js's built-in `process.env` runtime. There is no dedicated configuration library (no dotenv loader, no YAML/TOML/JSON config files, no feature-flag framework). All runtime settings are supplied through the root `.env` file and consumed directly as `process.env.NEXT_PUBLIC_*` variables.

## Key files and packages

- `.env` — the single source of truth for all environment variables in this repo.
- `src/api/client.js` — creates the Supabase client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `components/reseller/ResellerSignup.tsx` — validates that `NEXT_PUBLIC_SUPABASE_ANON_KEY` is present and not a placeholder at runtime.
- `components/reseller/resellerFgtPass.tsx` — same validation check for the forgot-password flow.
- `next.config.ts` — holds only Next.js build/runtime options (`experimental.optimizePackageImports`, `reactStrictMode`); no application-level configuration loading.
- `.gitignore` — ensures `.env` is not committed to version control.

## Architecture and conventions

1. **Single `.env` file at the repository root.**
   The `.env` file contains three variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   Two of them are commented out (a previous project's values) while the active set is defined below. This pattern is used to keep old values around as documentation rather than deleting them.

2. **Only `NEXT_PUBLIC_*` variables are used.**
   Every variable referenced in the codebase is prefixed with `NEXT_PUBLIC_`, which means they are all exposed to the browser bundle by Next.js. There are no server-only secrets in this repo; the Supabase anonymous key is intentionally public-facing.

3. **Supabase client is instantiated once and shared.**
   `src/api/client.js` calls `createClient()` from `@supabase/supabase-js` exactly once at module load time, passing the two env-derived values. All other API services import this singleton client rather than re-reading env vars themselves.

4. **Runtime guardrails for missing keys.**
   Both `ResellerSignup.tsx` and `resellerFgtPass.tsx` perform an inline check:
   ```ts
   if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('dummy')) {
       // throw error about missing/invalid key
   }
   ```
   This enforces that development builds fail fast when the key is absent or still contains a placeholder value (the string `'dummy'`).

5. **No layered configuration.**
   There is no distinction between development, staging, and production environments beyond swapping `.env` contents. No `.env.local`, `.env.development`, `.env.production`, or conditional loading logic exists.

6. **Next.js config is purely build-time.**
   `next.config.ts` does not reference any external configuration files or environment variables; it only declares Next.js-specific options.

## Conventions and constraints

- **Convention:** All application configuration lives in the root `.env` file under the `NEXT_PUBLIC_` namespace. New settings should follow this naming convention so they are available in both client and server code.
- **Constraint enforced by code:** The reseller signup and forgot-password flows will throw an error at runtime if `NEXT_PUBLIC_SUPABASE_ANON_KEY` is falsy or contains the substring `dummy`. This is a hard guard, not optional behavior.
- **Constraint enforced by VCS:** `.env` is listed in `.gitignore`, so environment secrets are never committed to the repository.
- **Constraint observed in practice:** Only three environment variables are used across the entire codebase, all related to Supabase initialization. No other configuration concerns (feature flags, UI theme toggles, third-party service URLs) are present.
- **No schema/validation layer:** Environment variables are consumed as raw strings with no type checking, default-value resolution, or schema validation beyond the two explicit checks mentioned above.