import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDD51c_GB1ZZpex8qug3iep43jNLuJOTOs",
  authDomain: "mess-cipher.firebaseapp.com",
  projectId: "mess-cipher",
  storageBucket: "mess-cipher.firebasestorage.app",
  messagingSenderId: "1016151703901",
  appId: "1:1016151703901:web:4bc4fda5c779e4b134a8b4"
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
