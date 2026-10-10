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
- **Recipes**: paste a recipe, type ingredients one per line, or upload a recipe text file. The app reads amounts like `1 ½ cups`, `200g`, `2 large eggs` or `1 (15 oz) can`, matches each ingredient against a built-in table of about 170 common foods (typical USDA values), and shows protein and calories per serving and for the whole recipe. Add the cooked weight to see grams per serving and to log by weight. Tap any ingredient to correct it: pick another food, set its weight, search [Open Food Facts](https://world.openfoodfacts.org) for branded products, or type the numbers yourself. **Import from TikTok**: paste a video link and the app fetches its caption through TikTok's public embed endpoint (or paste the caption yourself if TikTok doesn't share it), then strips hashtags and emojis, keeps the ingredient lines, and shows any protein or calories the creator listed next to its own estimate. Log servings of a recipe from the Recipes list, or pick a recipe in the Add protein screen.
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

Entries are saved only in the browser on the device you use (in `localStorage`). Nothing is uploaded anywhere. That means:

- On iPhone, **Safari and the home-screen app have separate storage**. Entries you add in one don't show up in the other.
- Data is erased if you clear the site's data. On iPhone that's Settings → Safari → **Clear History and Website Data**, or Advanced → Website Data. It's also erased if you delete the home-screen app or the browser.
- Safari can delete data for sites you haven't opened in 7 days. Apps added to the home screen are exempt.
- Private browsing tabs don't keep anything.

Use **Backup → Export data** regularly and save the file to Files or iCloud Drive. To move your log to another device or browser, export it there and use **Import data**.
