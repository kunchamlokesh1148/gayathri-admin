import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, isMock } from '../firebase/config';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to load profile from Firestore or Mock
  const fetchAdminProfile = async (email, uid) => {
    if (isMock) {
      const list = JSON.parse(localStorage.getItem('wholesale_admins')) || [
        { id: 'admin_default', name: 'System Admin', email: 'admin@srigayathri.com', role: 'Super Admin', createdAt: new Date().toISOString() }
      ];
      // Find matching mock admin
      const matched = list.find(a => a.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        return matched;
      }
      return null;
    } else {
      try {
        // 1. Try to fetch by document ID (uid)
        const docRef = doc(db, 'adminCredentials', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() };
        }
        // 2. Fallback: Query by email (for legacy entries)
        const q = query(collection(db, 'adminCredentials'), where('email', '==', email));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          return { id: querySnap.docs[0].id, ...querySnap.docs[0].data() };
        }
      } catch (e) {
        console.error("Firestore fetch admin profile failed:", e);
      }
      return null;
    }
  };

  useEffect(() => {
    if (isMock) {
      // Mock mode session check
      const session = localStorage.getItem('wholesale_admin_session');
      if (session) {
        const parsed = JSON.parse(session);
        setUser({ email: parsed.email, uid: parsed.id });
        setAdminProfile(parsed);
      } else {
        setUser(null);
        setAdminProfile(null);
      }
      setLoading(false);
    } else {
      // Firebase Auth listener
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const profile = await fetchAdminProfile(firebaseUser.email, firebaseUser.uid);
            if (profile && profile.status !== 'inactive') {
              setUser(firebaseUser);
              setAdminProfile(profile);
            } else {
              // Not an admin or inactive, sign out immediately
              await signOut(auth);
              setUser(null);
              setAdminProfile(null);
            }
          } catch (err) {
            console.error("Auth state profile fetch failed:", err);
            setUser(null);
            setAdminProfile(null);
          }
        } else {
          setUser(null);
          setAdminProfile(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      if (isMock) {
        const list = JSON.parse(localStorage.getItem('wholesale_admins')) || [
          { id: 'admin_default', name: 'System Admin', email: 'admin@srigayathri.com', role: 'Super Admin', createdAt: new Date().toISOString() }
        ];
        const matched = list.find(a => a.email.toLowerCase() === email.trim().toLowerCase());
        if (!matched) {
          throw { code: 'auth/user-not-found' };
        }
        // Check password matching
        const expectedPassword = matched.password || 'admin123';
        if (password !== expectedPassword) {
          throw { code: 'auth/wrong-password' };
        }
        if (matched.status === 'inactive') {
          throw new Error('Access denied.');
        }
        localStorage.setItem('wholesale_admin_session', JSON.stringify(matched));
        setUser({ email: matched.email, uid: matched.id });
        setAdminProfile(matched);
        return matched;
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const firebaseUser = userCredential.user;
        const profile = await fetchAdminProfile(firebaseUser.email, firebaseUser.uid);
        
        if (!profile) {
          await signOut(auth);
          throw new Error("No account found with the provided credentials.");
        }
        
        if (profile.status === 'inactive') {
          await signOut(auth);
          throw new Error("Access denied.");
        }

        setUser(firebaseUser);
        setAdminProfile(profile);
        return profile;
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (isMock) {
        localStorage.removeItem('wholesale_admin_session');
      } else {
        await signOut(auth);
      }
      setUser(null);
      setAdminProfile(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, adminProfile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
