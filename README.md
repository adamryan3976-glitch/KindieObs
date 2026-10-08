# K-Doc

A web app for kindergarten educators to capture learning observations (a
photo, the children involved, the Kindergarten Program frame and
expectations, and a note), then review them by class, check coverage, and
print a learning portfolio for each child.

K-Doc works the same way as **FDK Letters**: teachers sign in with Google,
each teacher only ever sees their own classes, and a class can be shared with
an ECE (Editor) or an administrator (Viewer). It runs in the **same Firebase
project** as FDK Letters, in its own separate collections.

## How it works

- **Hosting:** GitHub Pages, built and deployed by a GitHub Actions workflow
  every time you push to `main`.
- **Sign-in:** Firebase Authentication with Google, the same as FDK Letters.
- **Data:** Firestore. Each class is stored at
  `kdocUsers/{owner's uid}/classes/{classId}` (roster and sharing), and its
  observations at `.../classes/{classId}/observations/{id}`. Invitations are
  stored at `kdocInvites/{id}`. These paths are separate from FDK Letters'
  `users/...` and `invites/...`, so the two apps never touch each other's data.
- **Photos:** Google Drive, through a small Apps Script web app
  (`apps-script/Code.gs`). For every photo request, the script asks Firestore
  whether the signed-in person may see the class, using that person's own
  sign-in, so the photos follow the same sharing rules. Photos are never
  shared publicly.
- **Offline:** class lists and observations are kept on the device. When the
  Wi-Fi drops, a text observation still saves and syncs once the device is
  back online. Photos need a connection to upload. If an upload fails, the
  teacher can try again or save the observation without its photo.

### Roles

| | Owner | Editor (e.g. ECE) | Viewer (e.g. Principal/VP) |
|---|---|---|---|
| Capture observations | ✓ | ✓ | |
| Delete observations | ✓ | ✓ | |
| Edit the roster | ✓ | ✓ | |
| View observations, coverage, portfolios | ✓ | ✓ | ✓ |
| Share the class / delete the class | ✓ | | |

Sharing is set up under **Classes → share icon**, exactly as in FDK Letters.

### Tabs

- **Capture:** take a photo, tap the children, choose a frame and
  expectations, and write a note.
- **Observations:** every observation for the school year, filterable by
  child, frame, or a word in the notes. **Export** downloads a CSV.
- **Coverage:** a table of children × frames that flags anyone not observed in
  the last 14 days (`STALE_DAYS` in `src/constants.js`).
- **Portfolio:** a printable record for one child. Use **Print → Save as PDF**
  to send it to families.
- **Roster:** add children one at a time, or use **Paste list** to add a
  column of names copied from a spreadsheet.

To change the frames or the expectation lists, edit `FRAMES` in
`src/constants.js`. Each observation stores the expectation text itself, so
editing the list later won't change older observations.

---

## One-time setup

You already have the Firebase project from FDK Letters. Google sign-in is
already turned on there, and you can reuse its six config values.

### 1. Update the Firestore rules (covers both apps)

In the Firebase console, go to **Firestore Database → Rules**. Replace
everything there with the contents of [`firestore.rules`](./firestore.rules)
from this repo, then click **Publish**.

This file contains the FDK Letters rules unchanged, with K-Doc's rules added
near the bottom. A Firebase project has only one rules file, so **copy this
same file into the FDK Letters repo as well**. That way, publishing from
either repo later won't remove the other app's rules.

### 2. Set up the photo script

1. Sign in to Google with the account whose Drive should hold the photos.
   This should ideally be your school Google account. Then go to
   [script.google.com](https://script.google.com) and create a **New project**
   called "K-Doc Photos".
2. Replace the contents of `Code.gs` with
   [`apps-script/Code.gs`](./apps-script/Code.gs).
3. Go to **Project Settings** (the gear icon) → **Script Properties** → **Add
   script property**:
   - Property: `FIREBASE_PROJECT_ID`
   - Value: your Firebase project ID (the same value as
     `VITE_FIREBASE_PROJECT_ID`)
4. Back in the editor, select the `setup` function and click **Run**.
   Approve the permissions it asks for (Drive and external requests). It
   creates a **K-Doc Photos** folder in your Drive.
5. Click **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**

   "Anyone" only means the script can be reached. It still refuses any
   request that doesn't come with a valid sign-in for that class.
6. Copy the **Web app URL**, which ends in `/exec`.

If you change `Code.gs` later, go to **Deploy → Manage deployments → Edit →
Version: New version**. This keeps the same URL.

### 3. Fill in your config locally (optional, for testing)

```bash
cp .env.example .env
```

Fill in the six Firebase values (the same as FDK Letters' `.env`) and
`VITE_KDOC_PHOTO_URL`. Then run:

```bash
npm install
npm run dev
```

---

## Publishing from GitHub

1. Push this project to the K-Doc repo. It replaces the old `index.html` and
   `reports.html`.
2. In the repo, go to **Settings → Secrets and variables → Actions** and add
   seven repository secrets. The first six are the same values as in the
   FDK Letters repo:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_KDOC_PHOTO_URL` (the Apps Script URL from setup step 2)
3. Go to **Settings → Pages → Build and deployment → Source** and choose
   **GitHub Actions**.
4. Push to `main`. When the workflow finishes, the app is live.
5. In Firebase, go to **Authentication → Settings → Authorized domains** and
   add the domain the app is served from: `<username>.github.io`, or your
   custom domain. Google sign-in won't work on a domain until it's listed
   there.

### Using a custom domain (like FDK Letters)

To serve K-Doc at its own subdomain (for example `kdoc.winchesterps.ca`):

1. Create `public/CNAME` containing that domain.
2. Add a DNS CNAME record pointing it to `<username>.github.io`.
3. Enter the domain under **Settings → Pages → Custom domain** and turn on
   **Enforce HTTPS** once GitHub offers it.
4. Add the domain to Firebase's **Authorized domains**.

The build uses relative paths, so it works either at a domain root or under
`/repo-name/`.

---

## Project structure

```
src/
  firebase.js            Firebase app/auth/Firestore (with offline cache)
  constants.js           Frames + expectations, roles, tabs
  utils.js               CSV export, dates, school-year helpers
  hooks/useAuth.js       Google sign-in state (same as FDK Letters)
  lib/classes.js         Class documents (roster + sharing)
  lib/invites.js         Sharing invitations (same flow as FDK Letters)
  lib/observations.js    Observation reads/writes
  lib/photos.js          Talks to the Drive photo script
  components/
    ClassroomApp.jsx     App shell: loads the class, live updates
    Header.jsx           Header + tabs
    ClassModal.jsx       Create / switch / share / delete classes
    CaptureView.jsx      The capture form
    ObservationsView.jsx Observation feed + filters + CSV
    CoverageView.jsx     Children x frames coverage table
    PortfolioView.jsx    Printable per-child portfolio
    RosterView.jsx       Roster editing
    shared.jsx           Chips, badges, photo loader, cards
apps-script/Code.gs      Drive photo service
firestore.rules          Combined rules for FDK Letters + K-Doc
```

## Cost

Everything stays on free tiers. Firestore's free Spark plan covers a school's
worth of classes, and photos live in Google Drive rather than paid Firebase
Storage. Each school year's observations are loaded separately, which keeps
the number of daily reads low.
