/* Elixir — sync configuration.
   ---------------------------------------------------------------------------
   Leave both fields empty and sync stays switched off: no requests, no UI
   beyond a short explanation, and the app behaves exactly as it did before.

   To turn it on:
     1. Create a project at supabase.com (free tier is plenty).
     2. Run elixir/supabase/schema.sql once in the SQL editor.
     3. Settings → API → copy "Project URL" and the "anon / public" key.
     4. Paste them below and deploy.

   The anon key is designed to be public and is safe in a public repo — it is
   what every Supabase browser client ships with. It grants nothing on its own:
   the vaults table denies all direct access, and the two RPC functions each
   demand a vault key the server never hands out.

   Never put the `service_role` key here. That one bypasses every check.
   --------------------------------------------------------------------------- */
window.Elixir = window.Elixir || {};

Elixir.SYNC_CONFIG = {
  url:     "",   // e.g. "https://abcdefghijklm.supabase.co"
  anonKey: ""    // the anon / public key, not service_role
};
