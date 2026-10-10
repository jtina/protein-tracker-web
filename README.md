# Protein Tracker (Web)

Web version of the Protein Tracker iPhone app, built to look and behave like the native app in a phone browser.

It's plain HTML, CSS and JavaScript with no build step and no dependencies.

## Features (same as the iOS app)

- Week strip centered on the selected day: swipe to move one day, tap a day to scroll to it
- Month grid view, a **Today** button, and per-day protein totals on every day cell
- Daily total with **+** / **−** buttons
- Add/remove sheets with an optional name and an amount in grams. A removal can't be larger than the day's total.
- Per-day log: tap a row to **edit** it, or swipe it left to **edit** or **delete** it
- Accent color picker with 9 colors
- Data is saved in the browser's `localStorage`, under the same keys the app uses (`proteinTracker.entries`, `accentColor`)
- **Add a single food**: on the + screen, type a food with its amount (`200g chicken breast`, `2 eggs`, `1 cup greek yogurt`) and the protein is filled in for you.
- **Recipes**: paste a recipe, type ingredients one per line, or upload a recipe text file. The app reads amounts like `1 ½ cups`, `200g`, `2 large eggs` or `1 (15 oz) can`, matches each ingredient against a built-in table of about 170 common foods (typical USDA values), and shows protein and calories per serving and for the whole recipe. Add the cooked weight to see grams per serving and to log by weight. Tap any ingredient to correct it: pick another food, set its weight, search [Open Food Facts](https://world.openfoodfacts.org) for branded products, or type the numbers yourself. **Import from link**: paste a recipe website link (the ingredients, servings and any nutrition the site lists are read from the page's recipe data; on a page that lists recipes, pick one) or a TikTok link (its caption is fetched through TikTok's public embed endpoint, then hashtags and emojis are stripped). If a link doesn't work, paste the recipe or caption text instead. Log servings of a recipe from the Recipes list, or pick a recipe in the Add protein screen.
- **Tags and search**: give recipes tags (type and press Enter or a comma; existing tags are suggested), then search recipes by name or tag, or tap tags to filter, in the Recipes list and on the + screen.
- **Cloud sync (Supabase)**: sign in with an emailed code to save your log and recipes to your own Supabase project and keep every device in sync. See *Cloud sync setup* below.
- **Backup** (arrows button in the header): export all entries and recipes to a JSON file, or import one, either merging it in or replacing everything
- Installable as a home-screen web app with an offline cache

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Host on GitHub Pages

Go to Settings → Pages → Build and deployment, choose **Deploy from a branch**, pick `main` / `(root)`, and save.
The app will be served at `https://<user>.github.io/protein-tracker-web/`.

On iPhone, open the URL in Safari and choose **Share → Add to Home Screen**. It then launches full-screen like the native app.

## Where your data lives

Entries are saved in the browser on the device you use (in `localStorage`). Unless you turn on cloud sync, nothing is uploaded anywhere. That means:

- On iPhone, **Safari and the home-screen app have separate storage**. Entries you add in one don't show up in the other.
- Data is erased if you clear the site's data. On iPhone that's Settings → Safari → **Clear History and Website Data**, or Advanced → Website Data. It's also erased if you delete the home-screen app or the browser.
- Safari can delete data for sites you haven't opened in 7 days. Apps added to the home screen are exempt.
- Private browsing tabs don't keep anything.

Use **Backup → Export data** regularly and save the file to Files or iCloud Drive. To move your log to another device or browser, export it there and use **Import data**.

## Website import helper (Vercel)

Browsers can't read other websites directly, so recipe websites are fetched by a small serverless function, `api/fetch-page.js`. It only fetches public `http`/`https` pages (no private or local addresses, standard ports only, 10-second timeout, 3 MB limit) and only lets this app's GitHub Pages site call it from another domain.

1. On vercel.com, **Add New → Project**, import `jtina/protein-tracker-web`, keep the defaults (framework: Other, no build command) and **Deploy**.
2. The whole app also works at the Vercel address, with website import built in.
3. To turn website import on for the GitHub Pages copy, set `HELPER_ORIGIN` in `app.js` to the Vercel address (e.g. `https://protein-tracker-web.vercel.app`).

Without the helper, website import shows a message and you can paste the recipe text instead. TikTok captions don't use the helper.

## Cloud sync setup (Supabase)

Sync saves your log and recipes to your own Supabase project. The app still works offline: changes are kept on the device and uploaded when you're back online. If the same entry is changed on two devices, the newest change wins. Deletions sync too.

1. In [Supabase](https://supabase.com), open your project (an existing one is fine: the app uses its own `pt_` tables).
2. **SQL Editor → New query**: paste `supabase/schema.sql` and **Run**. It creates the `pt_entries` and `pt_recipes` tables with row-level security, so each account only sees its own data. It's safe to run again.
3. **Authentication → Emails → Magic Link** template: add the code, e.g. `<p>Your code: {{ .Token }}</p>`. The app signs in with this 6-digit code, because on iPhone an email link opens Safari instead of the home-screen app.
4. **Authentication → URL Configuration**: add `https://jtina.github.io/protein-tracker-web/` to **Redirect URLs** (used if you tap the link in the email instead).
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
6. In the app: **⇅ (Backup & Sync) → Cloud sync**, paste both, tap **Connect**, enter your email, then the code from the email.

To skip step 6's URL and key on every device, put them in `SUPABASE_URL` and `SUPABASE_ANON_KEY` at the top of the cloud sync section in `app.js`. The anon key is designed to be public; the row-level security policies are what keep the data private.

The first time a device signs in, everything already on it is uploaded and merged with the account. Signing out keeps the data on the device.
