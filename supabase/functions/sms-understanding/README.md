# sms-understanding Edge Function

OpenAI-backed SMS enrichment for Astra.

## What it does

- Receives already-parsed bank SMS drafts from the app
- Uses recent user-labeled transaction history as personalization context
- Calls OpenAI Responses API with structured JSON output
- Returns:
  - normalized merchant name
  - normalized bank name
  - category label
  - confidence
  - recurring flag
  - short reason

If `OPENAI_API_KEY` is not set, the function falls back to Astra's server-side heuristic classifier so SMS sync still works.

## Required secrets

- `OPENAI_API_KEY`

Optional:

- `OPENAI_SMS_MODEL` (`gpt-4o-mini` by default)

Supabase runtime keys used automatically:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (recommended)

## Deploy

```bash
npx supabase functions deploy sms-understanding --project-ref dbcsfoezxznyprkrduld
```

## Local serve

```bash
npx supabase functions serve sms-understanding --env-file .env
```
