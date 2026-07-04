# Atarah Quiz — Live Scoreboard (Firebase edition)

Same scoreboard — Host a Room / Join a Room, editable team names, editable
round names, live totals and ranking — but now backed by a real database
(Firebase Realtime Database), so it works as a normal hosted website with
real cross-device sync, no Claude.ai required.

## Files

| File                | Purpose                                                    |
|---------------------|-------------------------------------------------------------|
| `main.html`          | Page markup, loads CSS + Firebase SDK + your config + app JS |
| `main.css`           | All styling (colors, fonts, layout, crest background)       |
| `img.jpg`            | Atarah crest artwork used as the background                 |
| `firebase-config.js` | **You edit this** — your Firebase project credentials       |
| `main.js`            | App logic — rooms, scoring, real-time sync                  |
| `README.md`          | This file                                                    |

Keep all files in the same folder.

## Step 1 — Create a free Firebase project (5 minutes)

1. Go to **https://console.firebase.google.com** and sign in with any Google account.
2. Click **Add project** → name it anything (e.g. "atarah-quiz") → you can
   skip Google Analytics → **Create project**.
3. In the left sidebar: **Build → Realtime Database → Create Database**.
   - Pick any region.
   - Choose **Start in test mode** (this allows open read/write for now —
     fine for a one-off event; see the security note below).
4. Still in the console, click the **gear icon → Project settings**.
5. Scroll to **Your apps** → click the **</> (Web)** icon → give it any
   nickname → **Register app**. Firebase will show you a config object.
6. Copy that config into `firebase-config.js`, replacing the placeholder
   values. It looks like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "atarah-quiz.firebaseapp.com",
     databaseURL: "https://atarah-quiz-default-rtdb.firebaseio.com",
     projectId: "atarah-quiz",
     storageBucket: "atarah-quiz.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

   `databaseURL` is the important one — make sure it's filled in correctly,
   since that's what the app actually reads/writes to.

## Step 2 — Open it

Just double-click `main.html`, or drag it into a browser tab. As soon as
`firebase-config.js` has your real credentials, Host/Join rooms will sync
live across any device that opens this same set of files (or the hosted
version — see below).

## Step 3 — (Optional) Put it online so others don't need the files

Any static host works, since all the real-time logic lives in Firebase,
not on a server you run:

- **Firebase Hosting** (free, and it's already your project):
  ```
  npm install -g firebase-tools
  firebase login
  firebase init hosting   # point it at this folder
  firebase deploy
  ```
  You'll get a URL like `https://atarah-quiz.web.app` to share.

- **Netlify / Vercel**: drag-and-drop this folder onto their dashboard —
  works immediately, no config needed since Firebase handles the backend.

- **GitHub Pages**: push these files to a repo, enable Pages in settings.

## Security note

"Test mode" Realtime Database rules allow **anyone with your database URL**
to read and write to it — there's no login. That's fine for a one-off quiz
night, but if you want to lock it down afterward, go to **Realtime
Database → Rules** in the Firebase console and tighten them, e.g.:

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true,
      "$roomCode": {
        ".validate": "newData.hasChildren(['numRounds','roundNames','teams'])"
      }
    }
  }
}
```

Test mode rules also **expire after 30 days** by default — Firebase will
email you a reminder, and you can just re-enable "test mode" or set rules
like the above to keep it running indefinitely.

## How the sync works

Each room is one entry in the database at `rooms/{ROOMCODE}`, holding the
full state (team names, scores, round names). The app listens for live
updates on that path, so every device viewing the same room code gets
pushed changes within a second or two — no polling, no page refresh
needed.
