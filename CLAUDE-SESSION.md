# Claude Session Log

> Paste this file's contents at the start of a new Claude session to continue where we left off.

---

## Project Overview

**SupperSafe** - Toronto restaurant health inspection lookup tool
- Frontend: Static HTML/CSS/JS hosted on Cloudflare Pages
- Backend: Supabase (database, edge functions, auth)
- Transactional Email: Resend (domain verified, sends from @suppersafe.com)
- Domain: suppersafe.com

---

## Last Session: Nov 30, 2025

### Completed

**SEO & Crawlability**
- Created `robots.txt` (allows all crawlers)
- Created `sitemap.xml` (4 pages)
- Disabled Cloudflare AI bot blocking (ClaudeBot, GPTBot now allowed)
- Added canonical URL to index.html

**Open Graph / Social Sharing**
- Created OG image with correct 1.89:1 aspect ratio (logo, headline, CTA)
- Optimized meta tags: title 53 chars, description 143 chars
- Cache buster added (`?v=2`) to force social platforms to refresh

**Email Deliverability**
- Verified suppersafe.com domain in Resend
- Added DNS records: DKIM, SPF (MX + TXT), DMARC
- Test emails now land in inbox (not spam)
- Updated error-alert edge function to send from `hello@suppersafe.com`

**Dynamic Content**
- Created GitHub Action to auto-update violation count in meta tags
- Runs daily at 3am EST (queries Supabase, commits updated number)
- Workflow file: `.github/workflows/update-violation-count.yml`
- Script: `.github/scripts/update-violation-count.js`
- GitHub secrets added: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### Next Steps
1. **Google Workspace email ($6/mo)** - Still pending, user encountered errors during setup
   - Sign up at workspace.google.com with suppersafe.com
   - Add DNS records in Cloudflare (MX, TXT verification, SPF, DKIM)
   - Create hello@suppersafe.com inbox
   - Reason: Better deliverability to Gmail users

---

## Key Files
- `index.html` - Main landing page (all CSS/JS inline)
- `supabase/functions/error-alert/index.ts` - Error notification emails (sends from hello@suppersafe.com)
- `waitlist.html` - Waitlist signup page
- `robots.txt` - Crawler permissions
- `sitemap.xml` - Page listing for search engines
- `og-image.png` - Social share image (1.89:1 ratio)
- `.github/workflows/update-violation-count.yml` - Daily meta tag updater

## Credentials & Services
- Supabase project ID: `txxkimndpqprbqhlknrk`
- Resend: Domain verified, API key in Supabase secrets
- Cloudflare: Hosting + DNS, bot protection disabled
- GitHub Actions: Secrets configured for Supabase access

---

## How to Use This File

1. At session end, ask Claude to update this file with completed work and next steps
2. At session start, paste contents or say "read CLAUDE-SESSION.md and continue"
