import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getUserProfile } from '../firebase/auth';
import { subscribeToFamily } from '../firebase/db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [familyData,  setFamilyData]  = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        let profile = await getUserProfile(user.uid);
        if (!profile) {
          profile = { username: user.displayName, uid: user.uid, familyId: null };
          await setDoc(doc(db, 'users', user.uid), { ...profile, createdAt: new Date() });
          await setDoc(doc(db, 'usernames', user.displayName.toLowerCase()), { uid: user.uid, username: user.displayName });
        }
        setUserProfile(profile);
      } else {
        setUserProfile(null);
        setFamilyData(null);
      }
      setLoading(false);
    });
  }, []);

  // Live-subscribe to family doc so lock/unlock is instant across all tabs
  useEffect(() => {
    if (!userProfile?.familyId) { setFamilyData(null); return; }
    return subscribeToFamily(userProfile.familyId, setFamilyData);
  }, [userProfile?.familyId]);

  const refreshProfile = async () => {
    if (!currentUser) return;
    const profile = await getUserProfile(currentUser.uid);
    setUserProfile(profile);
  };

  const isAdmin  = !!currentUser && familyData?.createdBy === currentUser.uid;
  const isLocked = familyData?.locked === true;
  const canEdit  = isAdmin || !isLocked;

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, familyData, isAdmin, isLocked, canEdit, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
