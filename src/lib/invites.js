import { collection, doc, getDocs, setDoc, deleteDoc, updateDoc, query, where, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../firebase.js';

// Invitations live in a top-level `kdocInvites` collection, with a deterministic
// document id of `${classId}__${invitedEmail}` (see firestore.rules for the
// full data-model explanation and why this is safe). That id scheme is why
// every function below normalizes emails the same way before using them.

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function inviteDocId(classId, invitedEmail) {
  return `${classId}__${normalizeEmail(invitedEmail)}`;
}

function invitesRef() {
  return collection(db, 'kdocInvites');
}

// Creates (or resets, if one already exists for this class + email) a
// pending invitation. Only the class owner is allowed to do this -- enforced
// by firestore.rules, not just by this function.
export async function createInvite({ ownerId, ownerEmail, ownerName, classId, className, invitedEmail, role }) {
  const email = normalizeEmail(invitedEmail);
  if (!email || !email.includes('@')) {
    throw new Error('Enter a valid email address.');
  }
  if (email === normalizeEmail(ownerEmail)) {
    throw new Error("You can't share a class with yourself.");
  }
  const id = inviteDocId(classId, email);
  const data = {
    classId,
    ownerId,
    ownerEmail: normalizeEmail(ownerEmail),
    ownerName: ownerName || '',
    className,
    invitedEmail: email,
    role, // 'editor' | 'viewer'
    status: 'pending',
    collaboratorUid: null,
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'kdocInvites', id), data);
  return { id, ...data };
}

// All invites (pending and accepted) that a class owner has sent for one of
// their own classes -- used to show "who's already invited" while managing
// sharing for that class.
export async function listInvitesForClass(ownerId, classId) {
  const snap = await getDocs(query(invitesRef(), where('ownerId', '==', ownerId), where('classId', '==', classId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// All invites addressed to the signed-in user's own email -- both invitations
// still waiting for a response, and ones they've already accepted (used to
// find "classes shared with you").
export async function listMyInvites(myEmail) {
  const email = normalizeEmail(myEmail);
  const snap = await getDocs(query(invitesRef(), where('invitedEmail', '==', email)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Owner cancelling an outgoing invite (pending or already-accepted).
export async function cancelInvite(inviteId) {
  await deleteDoc(doc(db, 'kdocInvites', inviteId));
}

// Invited person declining/dismissing an invitation addressed to them.
export async function declineInvite(inviteId) {
  await deleteDoc(doc(db, 'kdocInvites', inviteId));
}

// Accepting an invite is a two-part write: add yourself to the class
// document's `collaborators` map (this is the part that actually grants
// access -- firestore.rules only allows it when a matching pending invite
// exists), and mark the invite itself as accepted. Both happen in one atomic
// batch so the two documents never fall out of sync with each other.
export async function acceptInvite(invite, myUid, myEmail, myDisplayName) {
  const batch = writeBatch(db);
  const classRef = doc(db, 'kdocUsers', invite.ownerId, 'classes', invite.classId);
  batch.update(classRef, {
    [`collaborators.${myUid}`]: {
      email: normalizeEmail(myEmail),
      displayName: myDisplayName || '',
      role: invite.role,
      addedAt: Date.now(),
    },
  });
  const inviteRef = doc(db, 'kdocInvites', invite.id);
  batch.update(inviteRef, { status: 'accepted', collaboratorUid: myUid });
  await batch.commit();
}

// Owner removing someone else's access to their class. Also best-effort
// deletes the matching invite doc so it doesn't linger as "accepted" forever
// -- if that delete fails for any reason, access has still been revoked.
export async function revokeCollaborator(ownerId, classId, collaboratorUid, collaboratorEmail) {
  const classRef = doc(db, 'kdocUsers', ownerId, 'classes', classId);
  await updateDoc(classRef, { [`collaborators.${collaboratorUid}`]: deleteField() });
  if (collaboratorEmail) {
    try {
      await deleteDoc(doc(db, 'kdocInvites', inviteDocId(classId, collaboratorEmail)));
    } catch {
      // Best-effort cleanup only -- access has already been revoked above.
    }
  }
}

// A collaborator removing themselves from a class they no longer want to be
// part of. Also best-effort cleans up their own invite doc.
export async function leaveClass(ownerId, classId, myUid, inviteId) {
  const classRef = doc(db, 'kdocUsers', ownerId, 'classes', classId);
  await updateDoc(classRef, { [`collaborators.${myUid}`]: deleteField() });
  if (inviteId) {
    try {
      await deleteDoc(doc(db, 'kdocInvites', inviteId));
    } catch {
      // Best-effort cleanup only -- they've already left the class above.
    }
  }
}
