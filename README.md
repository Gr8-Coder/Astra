# Astra

Astra is a React Native financial planning app built with Expo.

## Current stack

- Expo SDK 54
- React Native
- Supabase
- TypeScript

## Features in this MVP

- Accounts
- Investments
- Transactions
- Dashboard
- Categories
- Recurring payments
- Email/password auth
- Google sign-in flow wired through Supabase

## Local development

```bash
npm install
npx expo start
```

## Marketing website

Astra's marketing website lives in [`website/`](./website) and contains:

- `index.html` (overview)
- `features.html` (product surfaces)
- `ai.html` (AI roadmap)
- `security.html` (trust and connector model)

Run locally:

```bash
python3 -m http.server 4173 --directory website
```

Then open `http://localhost:4173`.

## Backend

Supabase setup and migrations live in [`supabase/`](./supabase).
