# Astra Supabase Setup

This folder contains the first Astra backend schema for the MVP.

## What is already wired in the Expo app

- `@supabase/supabase-js`
- React Native auth session persistence via `AsyncStorage`
- Expo-safe URL polyfill
- Local environment variables in `.env`

## What you should do in the Supabase dashboard now

1. Rotate the secret key that was shared in chat.
   - Go to `Project Settings -> API Keys`.
   - Create a new secret key.
   - Delete the exposed one after you have replaced it anywhere else.
2. Open `SQL Editor` and run these migrations in order:
   - `supabase/migrations/20260330190000_initial_schema.sql`
   - `supabase/migrations/20260403194000_bank_link_sessions.sql`
   - `supabase/migrations/20260404102000_source_events_and_sync_metrics.sql`
   - `supabase/migrations/20260404214500_connector_bridge_p1.sql`
3. In `Authentication -> URL Configuration`, add the redirect allow list entries for Expo and the installed app:
   - `astra://**`
   - `exp://127.0.0.1:8081/--/**`
4. In `Authentication -> Providers -> Email`, enable email/password sign-ins.
5. In `Authentication -> Providers -> Google`, enable Google and paste your Google OAuth Client ID and Client Secret.
   - Use a Google OAuth client of type `Web application`.
   - Add your Supabase callback URL from the Google provider page as an authorized redirect URI in Google Cloud.
6. Keep all provider secrets out of Expo.
   - Bank aggregator keys
   - investment API keys
   - webhook signing secrets
   - any Supabase secret key

## What to send me next

- The first provider/API docs link
- Sandbox keys for that provider
- Webhook format if the provider sends webhooks

## Later CLI steps if you want me to push schema from this machine

1. Install or use the Supabase CLI.
2. Login with your personal Supabase access token.
3. Link this project:
   - `npx supabase link --project-ref dbcsfoezxznyprkrduld`
4. Push migrations:
   - `npx supabase db push`
5. Deploy the bank-link function:
   - `npx supabase functions deploy bank-link --project-ref dbcsfoezxznyprkrduld`
6. Deploy the OpenAI SMS understanding function:
   - `npx supabase functions deploy sms-understanding --project-ref dbcsfoezxznyprkrduld`
7. Set function secrets (minimum for MVP OTP flow):
   - `npx supabase secrets set BANK_LINK_PROVIDER=mock BANK_LINK_MOCK_OTP=123456 --project-ref dbcsfoezxznyprkrduld`
8. Set the OpenAI SMS secret for the intelligence layer:
   - `npx supabase secrets set OPENAI_API_KEY=your_openai_api_key OPENAI_SMS_MODEL=gpt-4o-mini --project-ref dbcsfoezxznyprkrduld`
9. For real providers, set these too:
   - `npx supabase secrets set BANK_LINK_API_BASE_URL=... BANK_LINK_CLIENT_ID=... BANK_LINK_CLIENT_SECRET=... BANK_LINK_SYNC_ENDPOINT=... BANK_LINK_TRANSACTIONS_ENDPOINT=... --project-ref dbcsfoezxznyprkrduld`
10. Generate database types for the app:
   - `npx supabase gen types typescript --project-id dbcsfoezxznyprkrduld --schema public`
