# CDM Social

An AI social media manager by CDM Technologies: it plans and writes posts for Facebook Pages, Instagram, LinkedIn and X,
and posts them on schedule **only after an owner or approver approves each post**.

- Website: https://cdmtechnologies.github.io/cdm-social/ (this repo, GitHub Pages; React + Vite + Tailwind)
- Server: the CDM Studio Supabase project. The database changes (`20261121120000_social.sql`) and the functions
  `social-ai`, `social-connect` and `social-publish` live in **cdmtechnologies/cdm-studio** and deploy from there.
- One account and one credit balance with CDM Studio.

## Setting up the networks (owner, once)
Secrets on the CDM Studio Supabase project: `META_APP_ID`, `META_APP_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
`X_CLIENT_ID`, `X_CLIENT_SECRET`. Redirect / callback address to register with each network:
`https://vkrnrupiidbnqxrehrty.supabase.co/functions/v1/social-connect/callback`.
In Supabase Auth > URL configuration add `https://cdmtechnologies.github.io/cdm-social/**` to the redirect URLs.

## Safety
- Nothing is posted without approval; any edit after approval needs approval again (enforced in the database).
- Network tokens are kept in Supabase Vault and never sent to browsers.
- Only CDM sites can receive people back after connecting an account.
