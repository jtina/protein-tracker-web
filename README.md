# Protein Tracker (Web)

Web version of the Protein Tracker iPhone app, built to look and behave like the native app in a phone browser.

It's plain HTML, CSS and JavaScript with no build step and no dependencies.

## Features (same as the iOS app)

- Week strip centered on the selected day: swipe to move one day, tap a day to scroll to it
- Month grid view, a **Today** button, and per-day protein totals on every day cell
- Daily total with **+** / **−** buttons and an **Add protein** button
- Add/remove sheets with an optional name and an amount in grams. A removal can't be larger than the day's total.
- Per-day log: swipe a row left to **edit** or **delete** it
- Accent color picker with 9 colors
- Data is saved in the browser's `localStorage`, under the same keys the app uses (`proteinTracker.entries`, `accentColor`)
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
