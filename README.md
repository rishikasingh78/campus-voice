# Campus Voice 

Project link - https://campus-voicee.netlify.app/

Lightweight, mobile-first social app with real-time chat and stories built with React + TypeScript and Supabase.

A developer-friendly starter for conversation-focused apps:
- Real-time messaging with Supabase Realtime
- Image upload via Supabase Storage
- Mobile-first responsive UI (Tailwind CSS)
- Clean component primitives and accessibility-minded interactions


[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license) [![Status: WIP](https://img.shields.io/badge/status-WIP-orange.svg)](#roadmap) [![Built with Supabase](https://img.shields.io/badge/built%20with-Supabase-3ecf8e.svg)](#tech-stack)

Lightweight, mobile-first social app focused on conversations, stories and realtime messaging. Built with React + TypeScript, Tailwind CSS and Supabase — optimized for fast iteration and production readiness.

---

Table of contents
- About
- Features
- Demo / Screenshots
- Quick start
- Environment variables
- Development workflow
- Architecture & Tech stack
- Supabase details (Auth, Realtime, Storage)
- UI & Accessibility
- Testing & Linting
- Deployment
- Contributing
- Roadmap
- Troubleshooting
- License & Acknowledgements

---

## About
Campus Voice is a developer-friendly starter for building conversation-centric apps (small groups, campus communities, clubs). It provides a minimal but complete foundation: identity, realtime messaging, image stories, simple permissions, and responsive UI patterns optimized for mobile.

Goals:
- Minimal friction to get a working prototype running locally
- Production patterns for realtime subscriptions and file storage
- Accessible, mobile-first UI primitives you can reuse and extend

## Features
- 1:1 and group conversations (threaded list + conversation view)
- Realtime messages with Supabase Realtime (postgres_changes)
- Image upload for messages & stories (Supabase Storage) with public previews and optional deletion
- Message actions: delete, unsend, remove image via a contextual floating menu
- Presence indicators & typing status (optional)
- Responsive mobile-first layout: single-column on small screens; multi-pane on desktop
- Authentication flows: email magic links + OAuth providers
- Clean TypeScript primitives and composable components

## Screenshots
<img width="1440" height="708" alt="Screenshot 2025-12-08 at 7 22 18 PM" src="https://github.com/user-attachments/assets/b63887d7-8851-417f-8fe7-3229bc030ba5" />
<img width="1440" height="708" alt="Screenshot 2025-12-08 at 7 23 14 PM" src="https://github.com/user-attachments/assets/e62e2628-964e-4d09-8996-4fd16dbaa620" />
<img width="1440" height="708" alt="Screenshot 2025-12-08 at 7 21 40 PM" src="https://github.com/user-attachments/assets/86c18c0d-1250-4a0b-b57a-d45025b828e0" />
<img width="1440" height="708" alt="Screenshot 2025-12-08 at 7 29 33 PM" src="https://github.com/user-attachments/assets/ebc8f185-abcd-4f2b-b29d-445a8ab2e3ab" />
<img width="1440" height="708" alt="Screenshot 2025-12-08 at 7 33 12 PM" src="https://github.com/user-attachments/assets/32483e88-1bff-4148-8cc5-1fae3c8c6b5a" />
<img width="1440" height="708" alt="Screenshot 2025-12-08 at 7 33 59 PM" src="https://github.com/user-attachments/assets/6c6a3ae4-e797-45b0-9173-7c8c9474222b" />
<img width="1440" height="708" alt="Screenshot 2025-12-08 at 7 34 43 PM" src="https://github.com/user-attachments/assets/4279b8a3-2d0d-491a-bd80-0b23f7d398d3" />


## Quick start (local)
Prerequisites: Node 18+, pnpm or npm, Supabase CLI (optional)


1. Install
    pnpm install
    # or
    npm install

2. Configure environment
    cp .env.example .env
    # edit .env (see below)

3. Start dev server
    pnpm dev
    # or
    npm run dev

4. (Optional) Start Supabase locally
    supabase start
    supabase db push --project-ref local

Commands
- pnpm dev — start app in development
- pnpm build — production build
- pnpm start — run production server
- pnpm lint / pnpm test — quality checks



## Development workflow & tips
- Use the storybook / component playground (if included) to preview UI primitives.
- Reuse the provided hooks: useConversation, useMessages, useSupabaseClient for consistent data access.
- Keep database operations in server-side functions (edge/serverless) to protect service keys.
- For quick resets: supabase db reset or run SQL migration scripts in /db/migrations.

## Architecture & Tech stack
- React + TypeScript (strict mode)
- Tailwind CSS (utility-first responsive styles) + optionally Headless UI
- Supabase: Auth, Postgres, Realtime, Storage
- date-fns for formatting dates
- lucide-react for icons
- Optional: Vercel / Netlify deployment, Docker for local stacks

## Supabase notes (Auth, Realtime, Storage)
Realtime
- The UI subscribes to `postgres_changes` for the `messages`, `conversations`, and `presence` tables.
- Reconcile incoming events on the client: insert / update / delete patterns to keep local state stable.
- Use optimistic UI for message send, then reconcile with server results.

Storage
- Images are uploaded to a configured bucket (public or private).
- The app stores public URLs in message rows and extracts storage paths for deletion: remove(path).
- Consider using signed URLs for private media.

Auth & Policies
- Use RLS (row-level security) with policies that restrict access to user-owned conversations and messages.
- Magic link sign-in + OAuth (Google/Github) are supported out of the box.

Schema notes
- messages: id, conversation_id, sender_id, content, image_url, created_at, edited_at, deleted_at
- conversations: id, title, is_group, members (array), last_message_id, updated_at

## UI & Accessibility
- Mobile-first responsive layout; conversation pane collapses to full width on small screens.
- Floating message action menu is positioned with a portal to avoid clipping.
- Focus management: dialogs and menus trap focus and return it on close.
- Use semantic HTML and ARIA attributes for interactive controls.
- Color contrast and reduced-motion preferences are respected.

Customize
- Tailwind config and CSS variables are located in tailwind.config.js and src/styles.
- Theme toggling (dark/light) persists to localStorage.

## Testing & Linting
- Unit tests: vitest / jest (configured)
- E2E: Playwright recommended for flows (auth, messaging)
- Linters: ESLint + Prettier
- Commands:
  pnpm test
  pnpm lint
  pnpm format

## Deployment
- Vercel / Netlify: set environment variables in the platform dashboard (NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY only for server functions).
- Recommended build: pnpm build then pnpm start (or serverless functions for Next.js).
- Ensure CORS and redirect URLs in Supabase Auth are set for your deployment domain(s).

## Contributing
- Fork the repo, create a feature branch, open a focused PR.
- Write clear commit messages and include screenshots or recordings for UI changes.
- Keep accessibility, responsive behavior and small bundle size in mind.
- Suggested PR checklist:
  - Minimal, focused changes
  - Update / add tests
  - Update docs in README or /docs
  - Run lint and format

## Roadmap
Planned enhancements:
- Message reactions and threaded replies
- Read receipts & presence improvements
- Offline support & message queueing
- End-to-end encryption proof-of-concept
- Admin moderation tools and content reporting

## Troubleshooting
- Realtime not receiving events: verify Supabase Realtime is enabled and API keys are correct.
- Image upload fails: check bucket policy (public vs private) and storage CORS settings.
- Auth redirect mismatch: ensure redirect URIs match your environment variables and dashboard settings.

## File structure (high-level)
- src/
  - components/ — UI primitives
  - hooks/ — data and auth hooks
  - pages/ — routes / pages
  - lib/ — supabase client and utilities
- db/ — migrations and seed scripts
- public/ — static assets and demo media
- docs/ — screenshots and design notes

## Data File Structure ( high-level )
  - src/ - components/ - UI primitives
  - hooks/ - data and auth hooks
  - pages/ - routes / pages
  - lib / - supabase client and utilities
- db/ - migrations and seed scripts
- public/ - static assets and demo media
- docs/ - screenshots and design notes

## License
MIT — see LICENSE file.

## Acknowledgements
Built with Supabase and Tailwind CSS. Icons by lucide-react. Thanks to the open-source community for inspiration and reusable patterns.

---

If you want, I can:
- generate a ready-to-use .env.example and sample SQL migration,
- produce a simple Playwright test for the sign-in + send-message flow,
- craft a short demo GIF script for recording the app.

Replace demo placeholders with screenshots or links to deployed previews to make the README interactive and visually appealing.
