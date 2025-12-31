# checkin-family-app
Check in for essential recurring tasks.

## Local usage
Open `index.html` in a browser (or run a local server such as `python -m http.server`)
to start managing recurring check-ins. Data is stored locally in your browser.

## Install on iOS (PWA)
1. Run a local server: `python -m http.server`
2. Visit `http://<your-computer-ip>:8000` on your iPhone (same Wi-Fi network).
3. Tap the share icon and choose **Add to Home Screen**.

## Alternative: host it once and install from Safari
If you don’t want to run a local server each time, you can host the files and add
the app from Safari:

1. Create a new GitHub repo and push these files (`index.html`, `styles.css`,
   `app.js`, `manifest.json`, `sw.js`).
2. In GitHub, go to **Settings → Pages**, set **Source** to `main` and `/ (root)`.
3. Open the Pages URL on your iPhone and tap **Share → Add to Home Screen**.

This uses your hosted URL so the app installs like a PWA and can be opened
offline (after the first load).
