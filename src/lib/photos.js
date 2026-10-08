import { auth, PHOTO_URL } from '../firebase.js';

// Photos are stored in Google Drive by the K-Doc photo script
// (apps-script/Code.gs). Every request carries the signed-in teacher's
// Firebase ID token; the script uses it to ask Firestore whether this person
// can see (or edit) the class, so the same sharing rules protect the photos.

export const photosEnabled = Boolean(PHOTO_URL);

async function call(action, payload) {
  if (!PHOTO_URL) throw new Error('Photo storage is not set up.');
  const idToken = await auth.currentUser.getIdToken();
  // text/plain keeps this a "simple" request that Apps Script can answer.
  const res = await fetch(PHOTO_URL, { method: 'POST', body: JSON.stringify({ action, idToken, ...payload }) });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Unexpected response from the photo service.');
  }
  if (!data.ok) throw new Error(data.error || 'Photo request failed.');
  return data;
}

export async function uploadPhoto(ownerId, classId, dataUrl) {
  const { photoId } = await call('upload', { ownerId, classId, imageData: dataUrl });
  cache.set(photoId, Promise.resolve(dataUrl));
  return photoId;
}

export async function deletePhoto(ownerId, classId, photoId) {
  cache.delete(photoId);
  await call('delete', { ownerId, classId, photoId });
}

export async function deleteClassPhotos(ownerId, classId) {
  await call('deleteClass', { ownerId, classId });
}

// --- Loading, with a small cache and at most 4 requests at a time ---

const cache = new Map(); // photoId -> Promise<dataURL>
const queue = [];
let active = 0;

function pump() {
  while (active < 4 && queue.length) {
    const job = queue.shift();
    active++;
    job().finally(() => {
      active--;
      pump();
    });
  }
}

export function loadPhoto(ownerId, classId, photoId) {
  if (cache.has(photoId)) return cache.get(photoId);
  const p = new Promise((resolve, reject) => {
    queue.push(() =>
      call('get', { ownerId, classId, photoId })
        .then((d) => resolve(`data:${d.mime};base64,${d.data}`))
        .catch(reject)
    );
    pump();
  });
  p.catch(() => cache.delete(photoId)); // allow a retry later
  cache.set(photoId, p);
  return p;
}

export function clearPhotoCache() {
  cache.clear();
}

// Shrinks a camera photo to at most `maxW` pixels wide (never enlarges)
// and returns a JPEG data URL.
export function compressImage(file, maxW = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a photo this browser can read.'));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
