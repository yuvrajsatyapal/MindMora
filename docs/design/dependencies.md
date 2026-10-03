# Dependency record

Verified 2026-10-03 from npm package metadata and the locked install. All dependencies run locally without paid tiers or accounts. UI packages remain browser-compatible; Zod config and server-only are used on the Node server; tooling runs at development/build time. No external fonts or services are needed.

| Package | Exact version | License | Scope |
|---|---|---|---|
| @tailwindcss/postcss | 4.3.3 | MIT | runtime |
| lucide-react | 1.51.0 | ISC | runtime |
| next | 16.3.8 | MIT | runtime |
| zod | 4.6.5 | MIT | server config runtime |
| server-only | 0.0.1 | MIT | server/client import guard |
| @supabase/auth-js | 2.117.2 | MIT | server auth SDK, request-local storage |
| radix-ui | 1.6.7 | MIT | runtime |
| react | 19.3.0 | MIT | runtime |
| react-dom | 19.3.0 | MIT | runtime |
| tailwindcss | 4.3.3 | MIT | runtime |
| @axe-core/playwright | 4.13.0 | MPL-2.0 | development |
| @eslint/js | 9.39.5 | MIT | development |
| @playwright/test | 1.63.0 | Apache-2.0 | development |
| @testing-library/jest-dom | 7.0.1 | MIT | development |
| @testing-library/react | 16.3.3 | MIT | development |
| @testing-library/user-event | 14.6.7 | MIT | development |
| @types/node | 26.6.4 | MIT | development |
| @types/react | 19.3.0 | MIT | development |
| @types/react-dom | 19.3.0 | MIT | development |
| @vitejs/plugin-react | 6.1.1 | MIT | development |
| eslint | 9.39.5 | MIT | development |
| eslint-plugin-jsx-a11y | 6.10.2 | MIT | development |
| eslint-plugin-react-hooks | 7.1.1 | MIT | development |
| jsdom | 30.1.1 | MIT | development |
| typescript | 6.0.3 | Apache-2.0 | development |
| typescript-eslint | 8.71.0 | MIT | development |
| vitest | 5.0.3 | MIT | development |

Next/React provide the Node App Router with prerendered public pages. Tailwind exposes semantic token utilities; the UI is built from shared classes. Radix supplies modal/tab/menu/tooltip keyboard and focus behavior. Lucide supplies consistent outline icons. Vitest/RTL test user-visible contracts; Playwright/axe check the runtime-served showcase. TypeScript/ESLint verify source and accessibility rules.

The Next ESLint preset pulled in a braces denial-of-service advisory through fast-glob. It was removed rather than forcing a framework downgrade. ESLint 9.39.5 is pinned because the current JSX accessibility plugin does not yet declare ESLint 10 support. npm marks ESLint 9 unsupported: this is a tooling lifecycle limitation to revisit when plugin compatibility permits. The historical resulting dependency audit reported zero vulnerabilities; see Phase 1 record for current audit evidence.

Official references: [Next static export](https://nextjs.org/docs/app/guides/static-exports), [Tailwind theme variables](https://tailwindcss.com/docs/theme), [Radix accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility).

Source formatted using Prettier 3.9.9 (MIT, Node >=14), invoked as a one-time development tool rather than added to the application dependency graph.

## Runtime boundary and remaining backend target

The inventory includes 1A: Zod 4.6.5 and server-only 0.0.1 metadata verified on 2026-10-03, both MIT. No hosted service, fee, free-tier cap or credit-card requirement applies to these local libraries. Zod supports strict TypeScript 5.5+; actual TypeScript 6.0.3 and Node 22.22.3 validation/build checks pass. Installed Next 16.3.8 requires Node >=20.9.0; project retains >=22.12.0. Pino, Drizzle, Supabase database/Storage clients, TanStack Query, Zustand, nuqs, Redis/BullMQ and API tooling remain planned; verify at installation. Runtime Next.js migration is implemented. No claim that backend hosting or workers are free/unlimited follows from these UI dependencies.

1A references: [Next server-only guidance](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Next self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Zod requirements](https://zod.dev/).


## Milestone 1B dependency verification — 2026-10-04

Official auth-only SDK @supabase/auth-js 2.117.2 (MIT) requires Node >=22.0.0; actual Node 22.22.3 and project >=22.12.0 satisfy it. Exact version locked; no full database/Storage SDK or SSR browser client added. Custom request-local storage is supported by the SDK PKCE flow. The SDK is free local software; hosted Auth has quotas. Supabase Free social OAuth/50k MAU/2 active projects/one-week inactivity pause checked against official pricing. No project provisioning/paid/card action performed. Paid plans require a card; no blanket no-card hosting promise is made. Latest read-only existing-project settings check returned HTTP 200 with Google enabled; live start reached Google’s sign-in page. Live Google callback/session and logout (204 followed by session 401) succeeded. Subsequent live refresh/reuse/concurrency and revoked replay/isolation acceptance passed 13/13; natural JWT expiry was not awaited.

[SDK source](https://github.com/supabase/supabase-js/tree/master/packages/core/auth-js) · [Supabase pricing](https://supabase.com/pricing) · [Billing setup](https://supabase.com/docs/guides/platform/get-set-up-for-billing) · [ADR-020](../decisions/ADR-020-backend-owned-auth-cookies.md)
