import { collection, doc, setDoc, deleteDoc, getDocs, query, where, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';

// Observations live at kdocUsers/{ownerId}/classes/{classId}/observations/{id}.
// Shape: { studentIds: [id...], frame: 'BC'|'SRWB'|'DLMB'|'PSI'|'',
//          expectations: [text...], note, photoId|null,
//          createdAt (ms), createdBy (uid), createdByName }

function obsRef(ownerId, classId) {
  return collection(db, 'kdocUsers', ownerId, 'classes', classId, 'observations');
}

// Live list of a class's observations from one school year (`since` is its
// Sept 1 start, in ms), newest first.
// `onChange` receives (observations, { fromCache }) every time anything
// changes -- including edits made by a co-teacher on another device.
export function watchObservations(ownerId, classId, since, onChange, onError) {
  const until = new Date(new Date(since).getFullYear() + 1, 8, 1).getTime();
  const q = query(obsRef(ownerId, classId), where('createdAt', '>=', since), where('createdAt', '<', until), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), pending: d.metadata.hasPendingWrites }));
      onChange(list, { fromCache: snap.metadata.fromCache });
    },
    onError
  );
}

// Writes immediately to the on-device copy; the returned promise resolves
// once the server has it. Callers shouldn't block the UI on that promise --
// offline, it only resolves after the device reconnects.
export function newObservationId(ownerId, classId) {
  return doc(obsRef(ownerId, classId)).id;
}

export function addObservation(ownerId, classId, id, data) {
  return setDoc(doc(obsRef(ownerId, classId), id), data);
}

export function deleteObservation(ownerId, classId, obsId) {
  return deleteDoc(doc(obsRef(ownerId, classId), obsId));
}

// Used when a whole class is deleted: Firestore doesn't delete subcollections
// on its own, so remove the observations first (in batches of 400).
export async function deleteAllObservations(ownerId, classId) {
  const snap = await getDocs(obsRef(ownerId, classId));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
