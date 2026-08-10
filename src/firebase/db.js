import {
  doc, collection, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, onSnapshot, serverTimestamp, arrayUnion,
  query, orderBy, limit, writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { setUserFamilyId } from './auth';

// ─── Family ───────────────────────────────────────────────────────────────────
export const createFamily = async (familyName, creatorUid, creatorUsername) => {
  const ref = doc(collection(db, 'families'));
  await setDoc(ref, {
    name: familyName,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    memberUids: [creatorUid],
    memberDetails: {
      [creatorUid]: { username: creatorUsername, role: 'admin', joinedAt: new Date().toISOString() },
    },
  });
  // Initialise empty tree
  await setDoc(doc(db, 'families', ref.id, 'tree', 'main'), {
    personNodes: [], updatedAt: serverTimestamp(),
  });
  await setUserFamilyId(creatorUid, ref.id);
  await writeLog(ref.id, creatorUid, creatorUsername, 'created_family', `Created family "${familyName}"`);
  return ref.id;
};

// ─── Join requests (admin-approved membership) ─────────────────────────────────
// A non-member cannot read a family or write to it. All they may do is drop a
// request into families/{id}/joinRequests/{their-uid}. A family admin approves it,
// which is the only thing that adds them to memberUids.
const pendingPointer = (uid, familyId) =>
  setDoc(doc(db, 'users', uid), { pendingFamilyId: familyId }, { merge: true });

export const requestToJoinFamily = async (familyId, userUid, username) => {
  const id = familyId.trim();
  if (!id) throw new Error('Enter a Family ID');
  try {
    await setDoc(doc(db, 'families', id, 'joinRequests', userUid), {
      uid: userUid,
      username,
      status: 'pending',
      requestedAt: serverTimestamp(),
    });
  } catch (err) {
    // The create rule requires the family to exist, so a bad ID surfaces here.
    if (err.code === 'permission-denied')
      throw new Error('No family found with that ID — double-check it with the admin.');
    throw err;
  }
  await pendingPointer(userUid, id);
};

// The requester watches their own request doc so they learn when it's decided.
export const subscribeToMyJoinRequest = (familyId, userUid, cb) =>
  onSnapshot(doc(db, 'families', familyId, 'joinRequests', userUid),
    snap => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => cb(null));

// Once approved, the requester (already in memberUids) claims the family on their
// own profile, then clears the pending pointer and tidies up the request doc.
export const adoptApprovedFamily = async (familyId, userUid) => {
  await setUserFamilyId(userUid, familyId);
  await setDoc(doc(db, 'users', userUid), { pendingFamilyId: null }, { merge: true });
  await deleteDoc(doc(db, 'families', familyId, 'joinRequests', userUid)).catch(() => {});
};

// The requester withdraws (or acknowledges a rejection).
export const cancelJoinRequest = async (familyId, userUid) => {
  await deleteDoc(doc(db, 'families', familyId, 'joinRequests', userUid)).catch(() => {});
  await setDoc(doc(db, 'users', userUid), { pendingFamilyId: null }, { merge: true });
};

// ── Admin side ──
export const subscribeToJoinRequests = (familyId, cb) =>
  onSnapshot(collection(db, 'families', familyId, 'joinRequests'), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === 'pending'))
  );

export const approveJoinRequest = async (familyId, req, adminUid, adminUsername) => {
  // Add them to the family first (admin is a member, so this is allowed) …
  await updateDoc(doc(db, 'families', familyId), {
    memberUids: arrayUnion(req.uid),
    [`memberDetails.${req.uid}`]: { username: req.username, role: 'member', joinedAt: new Date().toISOString() },
  });
  // … then flag the request approved so the requester's app can claim it.
  await updateDoc(doc(db, 'families', familyId, 'joinRequests', req.uid), { status: 'approved' });
  await writeLog(familyId, adminUid, adminUsername, 'approved_member', `Approved ${req.username} to join`);
};

export const rejectJoinRequest = async (familyId, req, adminUid, adminUsername) => {
  await deleteDoc(doc(db, 'families', familyId, 'joinRequests', req.uid));
  await writeLog(familyId, adminUid, adminUsername, 'rejected_member', `Declined ${req.username}'s request`);
};

export const subscribeToFamily = (familyId, cb) =>
  onSnapshot(doc(db, 'families', familyId), snap => snap.exists() && cb({ id: snap.id, ...snap.data() }));

// ─── Events (Calendar) ───────────────────────────────────────────────────────
export const subscribeToEvents = (familyId, cb) =>
  onSnapshot(collection(db, 'families', familyId, 'events'), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );

export const addEvent = async (familyId, eventData, uid, username) => {
  const ref = await addDoc(collection(db, 'families', familyId, 'events'), {
    ...eventData, photo: eventData.photo ?? null,
    createdBy: uid ?? null, createdByUsername: username ?? null, createdAt: serverTimestamp(),
  });
  await writeLog(familyId, uid, username, 'added_event',
    `Added ${eventData.type} for ${eventData.name} on ${eventData.date}`);
  return ref.id;
};

export const removeEvent = async (familyId, eventId, eventName, uid, username) => {
  await deleteDoc(doc(db, 'families', familyId, 'events', eventId));
  await writeLog(familyId, uid, username, 'deleted_event', `Deleted: ${eventName}`);
};

// ─── Family Tree ─────────────────────────────────────────────────────────────
export const subscribeToTree = (familyId, cb) =>
  onSnapshot(doc(db, 'families', familyId, 'tree', 'main'), snap =>
    cb(snap.exists() ? snap.data() : { personNodes: [] })
  );

export const saveTree = async (familyId, personNodes, uid, username) => {
  await setDoc(doc(db, 'families', familyId, 'tree', 'main'), {
    personNodes,
    updatedBy: uid ?? null,
    updatedByUsername: username ?? null,
    updatedAt: serverTimestamp(),
  });
  await writeLog(familyId, uid, username, 'updated_tree', 'Updated the family tree');
};

// ─── Family Lock ─────────────────────────────────────────────────────────────
export const toggleFamilyLock = async (familyId, locked, uid, username) => {
  await updateDoc(doc(db, 'families', familyId), { locked });
  await writeLog(familyId, uid, username,
    locked ? 'locked_family' : 'unlocked_family',
    locked ? 'Family locked — only admin can make changes' : 'Family unlocked — all members can edit'
  );
};

// ─── Access Log ──────────────────────────────────────────────────────────────
const writeLog = (familyId, userId, username, action, details) =>
  addDoc(collection(db, 'families', familyId, 'accessLog'), {
    userId: userId ?? null, username: username ?? 'unknown',
    action, details, timestamp: serverTimestamp(),
  }).catch(err => console.warn('Access log write failed:', err));

export const subscribeToAccessLog = (familyId, cb) => {
  const q = query(
    collection(db, 'families', familyId, 'accessLog'),
    orderBy('timestamp', 'desc'),
    limit(60)
  );
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

// ─── Backup / Restore ─────────────────────────────────────────────────────────
// Convert Firestore Timestamp objects to ISO strings so JSON.stringify works
const sanitize = (val) => {
  if (!val) return val;
  if (val?.toDate) return val.toDate().toISOString();
  if (Array.isArray(val)) return val.map(sanitize);
  if (typeof val === 'object') return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, sanitize(v)]));
  return val;
};

export const exportFamilyData = async (familyId) => {
  const [eventsSnap, treeSnap] = await Promise.all([
    getDocs(collection(db, 'families', familyId, 'events')),
    getDoc(doc(db, 'families', familyId, 'tree', 'main')),
  ]);
  return {
    version: 1,
    exportDate: new Date().toISOString(),
    familyId,
    events: eventsSnap.docs.map(d => sanitize({ id: d.id, ...d.data() })),
    tree:   treeSnap.exists() ? sanitize(treeSnap.data()) : { personNodes: [] },
  };
};

export const importFamilyData = async (familyId, backup, uid, username) => {
  // Delete existing events then re-create from backup
  const existingSnap = await getDocs(collection(db, 'families', familyId, 'events'));
  const batch = writeBatch(db);
  existingSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  // Re-add events (in small batches to stay under 500-op limit)
  const events = backup.events || [];
  for (let i = 0; i < events.length; i += 400) {
    const b2 = writeBatch(db);
    events.slice(i, i + 400).forEach(evt => {
      const { id, createdAt, ...data } = evt;
      b2.set(doc(collection(db, 'families', familyId, 'events')), {
        ...data, createdBy: uid, createdByUsername: username, createdAt: serverTimestamp(),
      });
    });
    await b2.commit();
  }

  // Restore tree
  if (backup.tree?.personNodes) {
    await setDoc(doc(db, 'families', familyId, 'tree', 'main'), {
      personNodes: backup.tree.personNodes,
      updatedBy: uid, updatedByUsername: username, updatedAt: serverTimestamp(),
    });
  }

  await writeLog(familyId, uid, username, 'restored_backup',
    `Restored backup from ${new Date(backup.exportDate).toLocaleDateString()}`);
};
