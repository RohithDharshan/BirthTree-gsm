import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './config';

// We use synthetic emails so users only need a username + password.
const toEmail = (username) => `${username.toLowerCase().trim()}@birthtree.app`;

export const registerUser = async (username, password) => {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
    throw new Error('Username must be 3–20 chars (letters, numbers, underscore)');

  // Check username uniqueness
  let taken;
  try {
    taken = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  } catch (err) {
    if (err.message?.includes('offline') || err.code === 'unavailable')
      throw new Error('Cannot reach database — make sure Firestore is enabled in your Firebase Console (Firestore Database → Create database).');
    throw err;
  }
  if (taken.exists()) throw new Error('Username already taken');

  const { user } = await createUserWithEmailAndPassword(auth, toEmail(username), password);
  await updateProfile(user, { displayName: username });

  // Store user profile
  await setDoc(doc(db, 'users', user.uid), {
    username,
    uid: user.uid,
    familyId: null,
    createdAt: new Date(),
  });

  // Reserve username → uid mapping
  await setDoc(doc(db, 'usernames', username.toLowerCase()), { uid: user.uid, username });

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

export const setUserFamilyId = (uid, familyId) =>
  updateDoc(doc(db, 'users', uid), { familyId });

export const updateUserPhone = (uid, phone) =>
  updateDoc(doc(db, 'users', uid), { phone });

export const updateUserCallMeBot = (uid, phone, callmebotKey) =>
  updateDoc(doc(db, 'users', uid), { phone, callmebotKey });
