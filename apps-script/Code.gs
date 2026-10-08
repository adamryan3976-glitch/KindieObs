/**
 * K-DOC PHOTO SERVICE v3.0
 *
 * Stores observation photos in Google Drive for the K-Doc web app.
 * Everything else (classes, rosters, observations, sharing) lives in Firebase.
 *
 * HOW ACCESS WORKS
 *   Every request carries the teacher's Firebase sign-in token. Before doing
 *   anything, this script asks Firestore to read the class document *as that
 *   teacher*. Firestore's own security rules decide whether that's allowed,
 *   so a person can only see photos for classes they own or that were shared
 *   with them -- and only owners and editors can add or delete photos.
 *   Photos are never shared publicly.
 *
 * SETUP (one time) -- see README.md for the full walkthrough:
 *   1. Project Settings (gear) -> Script Properties -> Add property
 *        FIREBASE_PROJECT_ID = your Firebase project id (same as FDK Letters)
 *   2. Deploy -> New deployment -> Web app
 *        Execute as: Me      Who has access: Anyone
 *   3. Copy the Web app URL into the K-Doc repo secret VITE_KDOC_PHOTO_URL.
 *
 * Photos are saved under a "K-Doc Photos" folder in the Drive of whoever
 * deploys this script, one sub-folder per class.
 */

const ROOT_FOLDER_NAME = 'K-Doc Photos';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function doGet() {
  return json({ ok: true, service: 'K-Doc photos', configured: Boolean(projectId_()) });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'Bad request.' });
  }

  try {
    const access = checkAccess_(req.idToken, req.ownerId, req.classId);

    switch (req.action) {
      case 'upload': {
        requireRole_(access, ['owner', 'editor']);
        return json({ ok: true, photoId: savePhoto_(req.ownerId, req.classId, req.imageData) });
      }
      case 'get': {
        const file = fileInClass_(req.ownerId, req.classId, req.photoId);
        const blob = file.getBlob();
        return json({ ok: true, mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) });
      }
      case 'delete': {
        requireRole_(access, ['owner', 'editor']);
        fileInClass_(req.ownerId, req.classId, req.photoId).setTrashed(true);
        return json({ ok: true });
      }
      case 'deleteClass': {
        requireRole_(access, ['owner']);
        const folder = classFolder_(req.ownerId, req.classId, false);
        if (folder) folder.setTrashed(true);
        return json({ ok: true });
      }
      default:
        return json({ ok: false, error: 'Unknown action.' });
    }
  } catch (err) {
    return json({ ok: false, error: err.message || String(err) });
  }
}

// ------------------------------------------------------------------ Access

/**
 * Reads the class document from Firestore using the caller's own token.
 * Firestore applies the security rules, so success means "this person may
 * see this class". Returns { uid, role } where role is owner/editor/viewer.
 * Results are cached for 10 minutes per token+class to keep photos fast.
 */
function checkAccess_(idToken, ownerId, classId) {
  if (!idToken || typeof idToken !== 'string') throw new Error('Not signed in.');
  validId_(ownerId);
  validId_(classId);

  const cacheKey = 'acc_' + sha256_(idToken + '|' + ownerId + '|' + classId);
  const cache = CacheService.getScriptCache();
  const hit = cache.get(cacheKey);
  if (hit) return JSON.parse(hit);

  const pid = projectId_();
  if (!pid) throw new Error('FIREBASE_PROJECT_ID is not set in Script Properties.');

  const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(pid) +
    '/databases/(default)/documents/kdocUsers/' + ownerId + '/classes/' + classId +
    '?mask.fieldPaths=collaborators';
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + idToken },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code === 401) throw new Error('Your sign-in has expired. Refresh the page.');
  if (code !== 200) throw new Error('You do not have access to this class.');

  // Firestore has verified the token's signature, so its claims can be trusted.
  const uid = tokenClaims_(idToken).user_id;
  let role = 'viewer';
  if (uid === ownerId) {
    role = 'owner';
  } else {
    const doc = JSON.parse(res.getContentText());
    const entry = (((doc.fields || {}).collaborators || {}).mapValue || {}).fields || {};
    const mine = entry[uid] && entry[uid].mapValue && entry[uid].mapValue.fields;
    role = (mine && mine.role && mine.role.stringValue) || 'viewer';
  }

  const access = { uid: uid, role: role };
  cache.put(cacheKey, JSON.stringify(access), 600);
  return access;
}

function requireRole_(access, roles) {
  if (roles.indexOf(access.role) === -1) throw new Error('Your access to this class is view-only.');
}

function tokenClaims_(idToken) {
  let part = idToken.split('.')[1] || '';
  while (part.length % 4) part += '=';
  return JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(part)).getDataAsString());
}

function validId_(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Invalid class.');
}

// ------------------------------------------------------------------ Drive

function savePhoto_(ownerId, classId, imageData) {
  const s = String(imageData || '');
  const m = s.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) throw new Error('No photo received.');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('Photo is too large.');

  const ext = m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg';
  const blob = Utilities.newBlob(bytes, m[1], 'KDoc_' + Date.now() + '.' + ext);
  const file = classFolder_(ownerId, classId, true).createFile(blob);
  return file.getId();
}

// Returns the photo only if it lives in this class's folder, so a valid
// class token can't be used to read any other file in Drive.
function fileInClass_(ownerId, classId, photoId) {
  if (typeof photoId !== 'string' || !/^[-\w]{20,}$/.test(photoId)) throw new Error('Invalid photo.');
  const folder = classFolder_(ownerId, classId, false);
  if (!folder) throw new Error('Photo not found.');
  const file = DriveApp.getFileById(photoId);
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folder.getId()) return file;
  }
  throw new Error('Photo not found.');
}

function rootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PHOTO_ROOT_ID');
  if (id) {
    try {
      const f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (e) { /* recreate below */ }
  }
  const folder = DriveApp.createFolder(ROOT_FOLDER_NAME);
  props.setProperty('PHOTO_ROOT_ID', folder.getId());
  return folder;
}

function classFolder_(ownerId, classId, create) {
  const name = ownerId + '__' + classId;
  const props = PropertiesService.getScriptProperties();
  const key = 'F_' + name;
  const id = props.getProperty(key);
  if (id) {
    try {
      const f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (e) { /* fall through */ }
  }
  const root = rootFolder_();
  const existing = root.getFoldersByName(name);
  let folder = existing.hasNext() ? existing.next() : null;
  if (!folder) {
    if (!create) return null;
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const again = root.getFoldersByName(name);
      folder = again.hasNext() ? again.next() : root.createFolder(name);
    } finally {
      lock.releaseLock();
    }
  }
  props.setProperty(key, folder.getId());
  return folder;
}

// ------------------------------------------------------------------ Helpers

function projectId_() {
  return PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
}

function sha256_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s));
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run once from the editor (select it, click Run) to grant Drive and
 * external-request permissions and create the "K-Doc Photos" folder.
 */
function setup() {
  Logger.log('Photo folder: ' + rootFolder_().getUrl());
  Logger.log('Firebase project: ' + (projectId_() || 'NOT SET -- add FIREBASE_PROJECT_ID in Script Properties'));
  UrlFetchApp.fetch('https://firestore.googleapis.com/', { muteHttpExceptions: true });
}
