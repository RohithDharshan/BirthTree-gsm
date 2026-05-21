import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyAcmEN8xK5BcsSCRmybX5sbSAGn4LNURw4",
  authDomain:        "birthday-5739f.firebaseapp.com",
  projectId:         "birthday-5739f",
  storageBucket:     "birthday-5739f.firebasestorage.app",
  messagingSenderId: "176372941662",
  appId:             "1:176372941662:web:79b4f84c47face631285cf",
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
