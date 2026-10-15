# Valtireo product website

An independent Astro site in the Valtireo repository. `client/` remains the React application and `server/` remains the Laravel API. This project builds public, crawlable pages without loading the application bundle or requiring a running API.

## Local development

Requires Node >=22.19 (Node 24 recommended) and npm >=9.6.5.

Astro 7.3.8 is pinned. Its dependency tree requires a newer runtime than the system's Node 22.15. Development was verified with the existing Codex-bundled Node 24.19 runtime; use a supported Node version on development and deployment machines. Fonts are self-hosted and do not use remote font providers.

```sh
cd website
npm ci
npm run dev
```

Open the local URL printed by Astro. `npm run build` generates `dist/`; `npm run preview` serves that build.

## Structure

- `src/pages/`: home, platform, approach, contact, and 404.
- `src/layouts/SiteLayout.astro`: shared metadata, navigation, and footer.
- `src/components/`: reusable product illustration, icons, and call to action.
- `src/data/site.ts`: product content and destination configuration.
- `src/styles/global.css`: responsive visual system.
- `public/`: existing Valtireo favicon and self-hosted Manrope fonts with license.
- `reference/`: preserved earlier HTML draft, excluded from generated output.

## Design decisions

Saasive's locally supplied `index.html` (Desktop/demo/saasive-html) informs the generous typography, split hero, layered visual, rounded panels, feature progression, setup narrative, FAQs, and closing CTA. It is a visual reference, not an application dependency. The website is rebuilt with Astro components, Valtireo's existing mark and pine palette, lightweight CSS, and native disclosure elements instead of the template's jQuery/GSAP/plugin stack. No template photos, fictional testimonials, customer logos, or statistics are republished.

The workspace visual is an authored illustration with clearly labeled sample data, not a screenshot or an interactive application. Module descriptions follow the repository's implemented areas. No payment execution, statutory compliance guarantee, unverified integrations, or planned AI functionality is advertised.

## Destinations and deployment

Copy `.env.example` to `.env` for local settings. Configure these in the deployment provider before building:

- `SITE_URL`: final public website origin; enables canonical and Open Graph URL metadata.
- `PUBLIC_APP_URL`: complete verified sign-in URL.
- `PUBLIC_DEMO_URL`: verified booking URL or `mailto:` destination.

Unset action destinations lead to an honest availability page. There is no lead form and no simulated submission. Do not launch this as a lead-generation website until the contact destination is configured. Pricing, legal policies, and any customer claims require approved content before adding them. Add a production sitemap and social image once the domain is confirmed.

For Vercel or an equivalent static host: project root `website`, install `npm ci`, build `npm run build`, output `dist`. Deploy independently from the application. No SPA catch-all rewrite is needed. The intended domain arrangement is the public root domain for this site and an app subdomain for the existing client; final domains are not yet provided.

This work does not publish the site or change application deployments.
