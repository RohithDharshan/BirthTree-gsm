import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './config';

// We use synthetic emails so users only need a username + password.
// NOTE: this domain is internal-only and must stay @birthtree.app —
// every existing Auth account was created with it; changing it would
// lock all current users out.
const toEmail = (username) => `${username.toLowerCase().trim()}@birthtree.app`;

export const registerUser = async (username, password) => {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
    throw new Error('Username must be 3–20 chars (letters, numbers, underscore)');

  // Check username uniqueness (best-effort: rules may block unauthenticated
  // reads — Firebase Auth still guarantees uniqueness via the synthetic email)
  try {
    const taken = await getDoc(doc(db, 'usernames', username.toLowerCase()));
    if (taken.exists()) throw new Error('Username already taken');
  } catch (err) {
    if (err.message === 'Username already taken') throw err;
    if (err.message?.includes('offline') || err.code === 'unavailable')
      throw new Error('Cannot reach database — make sure Firestore is enabled in your Firebase Console (Firestore Database → Create database).');
    if (err.code !== 'permission-denied') throw err;
    // permission-denied: skip pre-check, Auth signup below enforces uniqueness
  }

  let user;
  try {
    ({ user } = await createUserWithEmailAndPassword(auth, toEmail(username), password));
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') throw new Error('Username already taken');
    if (err.code === 'auth/weak-password') throw new Error('Password must be at least 6 characters');
    throw err;
  }
  await updateProfile(user, { displayName: username });

  // Store user profile
  try {
    await setDoc(doc(db, 'users', user.uid), {
      username,
      uid: user.uid,
      familyId: null,
      createdAt: new Date(),
    });

    // Reserve username → uid mapping
    await setDoc(doc(db, 'usernames', username.toLowerCase()), { uid: user.uid, username });
  } catch (err) {
    if (err.code === 'permission-denied')
      throw new Error('Account created, but Firestore rules blocked saving your profile. Update your Firestore security rules to allow signed-in users to write their own data.');
    throw err;
  }

  return user;
};

export const loginUser = async (username, password) => {
  const { user } = await signInWithEmailAndPassword(auth, toEmail(username), password);
  return user;
};

export const logoutUser = () => signOut(auth);

export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
};

export const getUserByUsername = async (username) => {
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  if (!snap.exists()) return null;
  return getUserProfile(snap.data().uid);
};

// merge:true so this also repairs profiles that failed to be created at signup
export const setUserFamilyId = (uid, familyId) =>
  setDoc(doc(db, 'users', uid), { familyId }, { merge: true });

export const updateUserPhone = (uid, phone) =>
  updateDoc(doc(db, 'users', uid), { phone });

export const updateUserCallMeBot = (uid, phone, callmebotKey) =>
  updateDoc(doc(db, 'users', uid), { phone, callmebotKey });

export const updateUserNotificationSettings = (uid, settings) =>
  updateDoc(doc(db, 'users', uid), settings);

