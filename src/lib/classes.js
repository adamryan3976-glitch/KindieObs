import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';

// Every K-Doc class lives at kdocUsers/{ownerId}/classes/{classId} -- kept
// separate from FDK Letters' users/{uid}/classes, even though both apps share
// one Firebase project. Firestore security rules (see firestore.rules)
// restrict that whole path to the class's owner plus anyone listed in its
// `collaborators` map. `userId` below is always the OWNER's uid.
//
// A class document holds the roster and sharing info; observations live in
// a subcollection (see observations.js) so a class never hits Firestore's
// 1 MB document limit no matter how many observations it collects.

function classesRef(userId) {
  return collection(db, 'kdocUsers', userId, 'classes');
}

export async function listClasses(userId) {
  const snap = await getDocs(query(classesRef(userId), orderBy('createdAt', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getClass(userId, classId) {
  const snap = await getDoc(doc(db, 'kdocUsers', userId, 'classes', classId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createClass(userId, teacherName, className) {
  const ref = doc(classesRef(userId));
  const data = {
    teacherName,
    className,
    createdAt: Date.now(),
    students: [],
    collaborators: {},
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
}

// Live view of one class (roster + sharing), so a roster change made by a
// co-teacher shows up without a refresh.
export function watchClass(userId, classId, onChange, onError) {
  return onSnapshot(
    doc(db, 'kdocUsers', userId, 'classes', classId),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

// Writes only the roster field, so it can never overwrite sharing changes
// made at the same time.
export function saveStudents(userId, classId, students) {
  return updateDoc(doc(db, 'kdocUsers', userId, 'classes', classId), { students });
}

export async function deleteClass(userId, classId) {
  await deleteDoc(doc(db, 'kdocUsers', userId, 'classes', classId));
}
