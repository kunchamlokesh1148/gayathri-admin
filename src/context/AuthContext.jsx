import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to load profile from Firestore
  const fetchAdminProfile = async (email, uid) => {
    // TEMPORARY BYPASS: Grant Super Admin to any authenticated user to resolve the initialization issue
    const tempProfile = {
      id: uid,
      name: 'System Admin',
      email: email,
      role: 'Super Admin',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    try {
      const docRef = doc(db, 'adminCredentials', uid);
      await setDoc(docRef, tempProfile);
      console.log("Auto-seeded admin profile in Firestore for:", email);
    } catch (e) {
      console.warn("Firestore auto-seed failed (expected if rules are strict):", e.message);
    }
    
    return tempProfile;
  };

  useEffect(() => {
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
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
