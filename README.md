# Driver Ledger

A private weekly dashboard for an Uber driver to record business finances: revenue, fixed costs, variable costs, logged hours, miles, trips, notes, and calculated net performance.

## Free Cloud Stack

- Frontend hosting: Netlify Free or Vercel Hobby.
- Backend: Supabase Free for authentication, Postgres storage, and Row Level Security.
- Build step: none. This is a static site.

## Setup

1. Create a free Supabase project.
2. In Supabase, open **SQL Editor** and run `supabase-schema.sql`.
3. In Supabase, open **Authentication > Providers > Email** and keep email/password enabled.
4. Copy your project URL and public anon key from **Project Settings > API**.
5. Put those values in `config.js`:

```js
window.DRIVER_LEDGER_CONFIG = {
  supabaseUrl: "https://your-project.supabase.co",
  supabaseAnonKey: "your-public-anon-key"
};
```

The anon key is designed to be public in browser apps. The data is protected by Supabase Auth plus the Row Level Security policies in `supabase-schema.sql`.

## Deploy for Free

### Netlify

1. Create a free Netlify account.
2. Add this folder as a new site using drag-and-drop, Git import, or Netlify Drop.
3. No build command is needed.
4. Publish directory is the project root.

### Vercel

1. Create a Vercel Hobby account.
2. Import this folder from Git.
3. Framework preset: Other.
4. Build command: leave empty.
5. Output directory: `.`.

## Local Preview

Because this is a static site, you can open `index.html` directly in a browser after configuring Supabase. For a localhost preview:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Security Notes

- Every finance row is tied to `auth.users.id`.
- Row Level Security is enabled on the table.
- Users can only select, insert, update, and delete rows where `user_id` equals their authenticated user id.
- Do not place a Supabase service role key in this frontend. Only use the anon key.
