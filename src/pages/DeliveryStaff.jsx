import { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, AlertCircle, Phone, Check, Mail, Lock, User, RefreshCw } from 'lucide-react';
import { dbService } from '../services/db';
import { firebaseConfig } from '../firebase/config';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { useAuth } from '../context/AuthContext';

const mapAuthError = (error) => {
  console.error("Original Firebase Auth Error:", error);
  const code = error?.code || error?.message || "";
  const errorText = typeof code === 'string' ? code.toLowerCase() : "";

  if (
    errorText.includes("invalid-credential") ||
    errorText.includes("wrong-password") ||
    errorText.includes("invalid-email")
  ) {
    return "Invalid credentials. Please check your email and password and try again.";
  }
  if (errorText.includes("user-not-found")) {
    return "No account found with the provided credentials.";
  }
  if (errorText.includes("email-already-in-use")) {
    return "An account with this email already exists.";
  }
  if (errorText.includes("weak-password")) {
    return "Password must be at least 6 characters long.";
  }
  if (errorText.includes("network-request-failed") || errorText.includes("network")) {
    return "Network error. Please check your internet connection and try again.";
  }
  if (errorText.includes("too-many-requests") || errorText.includes("too-many-login-attempts")) {
    return "Too many failed login attempts. Please try again later.";
  }
  return "Something went wrong. Please try again.";
};

export default function DeliveryStaff() {
  const { adminProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Tabs: 'roster' | 'add'
  const [activeTab, setActiveTab] = useState('roster');

  // Form states for Add Delivery Staff
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Created staff info state to display credentials on success
  const [createdStaffInfo, setCreatedStaffInfo] = useState(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await dbService.getDeliveryStaff();
      setStaff(data);
    } catch (err) {
      console.error("Failed to load delivery crew:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStaff();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (adminProfile?.role !== 'Super Admin') {
      setError("Access Denied: Only Super Admins can manage delivery staff.");
      return;
    }
    setError('');
    setSuccess('');

    if (!fullName.trim()) return setError('Full Name is required');
    if (!email.trim()) return setError('Email is required');
    if (!phone.trim()) return setError('Mobile Number is required');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');

    try {
      setSaving(true);

      // Check if email already exists
      const exists = await dbService.checkEmailExists(email.trim());
      if (exists) {
        setError("This email is already assigned to another delivery account.");
        setSaving(false);
        return;
      }

      let uid;

      // Create user in Firebase Auth using a secondary Firebase App instance
      // This prevents the admin from being signed out
      let secondaryApp;
      try {
        const appName = `SecondaryAuthApp_${Date.now()}`;
        secondaryApp = initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
        uid = userCredential.user.uid;
      } catch (authErr) {
        throw new Error(mapAuthError(authErr));
      } finally {
        if (secondaryApp) {
          await deleteApp(secondaryApp);
        }
      }

      // Save delivery staff document in Firestore
      const staffDoc = {
        uid,
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: "delivery",
        status: "active",
        password: password
      };

      await dbService.addDeliveryStaff(staffDoc);

      setSuccess('Delivery staff account created successfully!');
      setCreatedStaffInfo({
        email: email.trim(),
        password: password
      });
      
      // Reset fields
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      
      // Refresh list
      fetchStaff();

    } catch (err) {
      console.error("Failed to create staff account:", err);
      setError(err.message || "Error creating delivery staff account.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (driver) => {
    if (adminProfile?.role !== 'Super Admin') {
      alert("Access Denied: Only Super Admins can manage delivery staff.");
      return;
    }
    try {
      const newStatus = driver.status === 'active' ? 'inactive' : 'active';
      await dbService.updateDeliveryStaff(driver.id, { status: newStatus });
      setStaff(prev => prev.map(s => s.id === driver.id ? { ...s, status: newStatus } : s));
    } catch (err) {
      console.error("Failed to toggle status:", err);
      alert("Failed to update status: " + err.message);
    }
  };

  const handleDeleteStaff = async (driver) => {
    if (adminProfile?.role !== 'Super Admin') {
      alert("Access Denied: Only Super Admins can manage delivery staff.");
      return;
    }
    if (!confirm(`Are you sure you want to remove ${driver.name}? They will be removed from the shipping dispatch roster.`)) return;
    
    try {
      setSaving(true);

      // Authenticate as the driver on a secondary App instance to delete their Firebase Authentication record
      let secondaryApp;
      try {
        const appName = `SecondaryAuthApp_Delete_${Date.now()}`;
        secondaryApp = initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);
        
        // Sign in as driver (using their stored password from Firestore)
        await signInWithEmailAndPassword(secondaryAuth, driver.email, driver.password);
        if (secondaryAuth.currentUser) {
          await deleteUser(secondaryAuth.currentUser);
          console.log("Successfully deleted user from Firebase Authentication.");
        }
      } catch (authErr) {
        console.warn("Failed to delete user from Firebase Authentication (they might not have an Auth record):", authErr);
        // We don't block deletion from Firestore if Auth deletion fails
      } finally {
        if (secondaryApp) {
          await deleteApp(secondaryApp);
        }
      }

      await dbService.deleteDeliveryStaff(driver.id);
      setStaff(prev => prev.filter(s => s.id !== driver.id));
      alert("Delivery staff deleted successfully.");
    } catch (err) {
      console.error("Failed to delete driver:", err);
      alert("Failed to delete profile: " + err.message);
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400">Loading delivery roster...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header and Tabs */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Truck size={24} className="text-indigo-400" />
            Delivery Staff
          </h2>
          <p className="text-sm text-slate-400">Manage delivery accounts, status active/inactive, and dispatch roster.</p>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex gap-3">
          <button 
            onClick={() => {
              setActiveTab('roster');
              setCreatedStaffInfo(null);
              setSuccess('');
              setError('');
            }} 
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all border ${
              activeTab === 'roster' 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            Staff Roster
          </button>
          <button 
            onClick={() => {
              setActiveTab('add');
              setCreatedStaffInfo(null);
              setSuccess('');
              setError('');
            }} 
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
              activeTab === 'add' 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Plus size={13} className={activeTab === 'add' ? 'text-white' : 'text-slate-400'} />
            Add Delivery Staff
          </button>
        </div>
      </div>

      {/* Tab 1: Staff Roster Table */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl overflow-hidden border border-[#E6D9B8]">
            <div className="overflow-x-auto">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th className="p-4 pl-6">NAME</th>
                    <th className="p-4">EMAIL</th>
                    <th className="p-4">MOBILE PHONE</th>
                    <th className="p-4 text-center">STATUS</th>
                    <th className="p-4 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map(driver => (
                    <tr key={driver.id}>
                      {/* Name with initials circle */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FAF4E7] flex items-center justify-center text-xs font-bold text-[#B8860B] border border-[#E6D9B8]">
                            {(driver.name || 'DS').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-[#1F2937] text-sm leading-tight">{driver.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="p-4 text-xs text-[#4B5563] font-medium">
                        {driver.email || 'No Email'}
                      </td>

                      {/* Phone */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-xs text-[#4B5563] font-mono">
                          <Phone size={12} className="text-slate-450" />
                          <span>{driver.phone || 'No Phone'}</span>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="p-4 text-center">
                        <span className={driver.status === 'active' || !driver.status
                          ? 'text-emerald-600 font-bold text-xs tracking-wider'
                          : 'text-slate-500 font-bold text-xs tracking-wider'
                        }>
                          {driver.status ? driver.status.toUpperCase() : 'ACTIVE'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          {/* Disable/Enable Button */}
                          <button
                            onClick={() => handleToggleStatus(driver)}
                            className={`text-xs px-2.5 py-1 rounded font-bold border transition-all active:scale-95 cursor-pointer ${
                              driver.status === 'active' || !driver.status
                                ? 'bg-amber-600/10 text-amber-600 border-amber-500/20 hover:bg-amber-600/20'
                                : 'bg-emerald-600/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-600/20'
                            }`}
                          >
                            {driver.status === 'active' || !driver.status ? 'Disable' : 'Enable'}
                          </button>



                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteStaff(driver)}
                            className="text-slate-400 hover:text-red-400 transition-colors p-1.5 hover:cursor-pointer"
                            title="Delete profile"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {staff.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 text-sm">
                        No delivery staff registered in the database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Add Delivery Staff Form */}
      {activeTab === 'add' && (
        <div className="max-w-xl mx-auto glass-panel p-6 md:p-8 rounded-2xl border border-slate-850 space-y-6">
          {createdStaffInfo ? (
            <div className="text-center py-6 space-y-6 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <Check size={32} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-100">Driver Created Successfully</h3>
                <p className="text-xs text-slate-400">The delivery driver has been registered with permanent credentials.</p>
              </div>

              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-5 max-w-sm mx-auto space-y-3 text-left font-mono text-sm text-slate-200">
                <div>Email: {createdStaffInfo.email}</div>
                <div>Password: ******</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCreatedStaffInfo(null);
                  setSuccess('');
                  setActiveTab('roster');
                }}
                className="glass-btn-primary py-2.5 px-6 text-xs"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-800/80 pb-3">
                <h3 className="text-base font-bold text-slate-200 tracking-wide">ADD NEW DELIVERY STAFF</h3>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle size={18} className="mt-0.5 min-w-[18px]" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                  <Check size={18} className="mt-0.5 min-w-[18px]" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleCreateStaff} className="space-y-4">
                {/* Full Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-500"><User size={16} /></span>
                    <input
                      type="text"
                      placeholder="Full Name (e.g. John Doe)"
                      className="w-full pl-10 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-500"><Mail size={16} /></span>
                    <input
                      type="email"
                      placeholder="Email (e.g. rider@courier.com)"
                      className="w-full pl-10 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mobile Number</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-500"><Phone size={16} /></span>
                    <input
                      type="tel"
                      placeholder="Mobile (e.g. +1 555-0199)"
                      className="w-full pl-10 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account Password</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-500"><Lock size={16} /></span>
                    <input
                      type="password"
                      placeholder="Password (minimum 6 characters)"
                      className="w-full pl-10 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confirm Password</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-500"><Lock size={16} /></span>
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      className="w-full pl-10 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
                  <button 
                    type="button" 
                    onClick={() => {
                      setActiveTab('roster');
                      setSuccess('');
                      setError('');
                    }}
                    className="glass-btn-secondary py-2.5 px-6 text-xs"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="glass-btn-primary py-2.5 px-6 text-xs flex items-center justify-center gap-1.5 min-w-[7rem]"
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Create</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

