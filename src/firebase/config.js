import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD8HkU-GlMjqe0oTHzlKO929676jTaAdYg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gayathri-c0c79.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gayathri-c0c79",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gayathri-c0c79.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "559006653229",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:559006653229:web:37bb35b002b88fcda611a4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, firebaseConfig };
