import { useState, useEffect, useCallback } from 'react';
import { 
  Settings as SettingsIcon, 
  Store, 
  Briefcase, 
  Home as HomeIcon, 
  Bell, 
  ShieldAlert, 
  Plus, 
  Pencil, 
  Trash2, 
  Eye, 
  ArrowUp, 
  ArrowDown, 
  Check, 
  AlertTriangle,
  Search,
  Lock,
  LogOut,
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  RefreshCw
} from 'lucide-react';
import { dbService } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { auth, firebaseConfig } from '../firebase/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

export default function Settings() {
  const { adminProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('store');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  // 1. Store Information State
  const [storeInfo, setStoreInfo] = useState({
    storeName: '',
    ownerName: '',
    gstNumber: '',
    phoneNumber: '',
    email: '',
    storeAddress: ''
  });

  // 2. Business Settings State
  const [businessSettings, setBusinessSettings] = useState({
    deliveryArea: 'Siddipet',
    minOrderAmount: '',
    deliveryCharges: '',
    storeOpeningHours: ''
  });

  // 3. Notifications State
  const [notifications, setNotifications] = useState({
    orderNotificationToggle: true,
    lowStockAlerts: true,
    customerIssueAlerts: true
  });

  // 4. Homepage Carousel & Banners States
  const [banners, setBanners] = useState([]);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null); // null for add mode
  const [bannerForm, setBannerForm] = useState({
    title: '',
    subtitle: '',
    buttonText: '',
    buttonLink: '',
    displayOrder: 1,
    status: 'Active',
    imageUrl: '',
    badge: 'Bulk Pricing'
  });
  const [previewingBanner, setPreviewingBanner] = useState(null);

  // Festival Banner State
  const [festivalBanner, setFestivalBanner] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    link: '',
    active: false
  });


  // Featured Products State
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');

  // 5. Security State
  const [securityForm, setSecurityForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Admin Credentials State
  const [adminCredentials, setAdminCredentials] = useState([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState(null); // null for add mode
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Manager'
  });

  const showToast = useCallback((text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadSettingsData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load Store Info
      const storeData = await dbService.getSettings('storeInfo');
      if (Object.keys(storeData).length > 0) {
        setStoreInfo({
          storeName: storeData.storeName || '',
          ownerName: storeData.ownerName || '',
          gstNumber: storeData.gstNumber || '',
          phoneNumber: storeData.phoneNumber || '',
          email: storeData.email || '',
          storeAddress: storeData.storeAddress || ''
        });
      } else {
        // Fallback default
        setStoreInfo({
          storeName: 'Sri Gayathri Wholesale',
          ownerName: 'Gayathri Manager',
          gstNumber: '36AAAAA1111A1Z1',
          phoneNumber: '+91 98765 43210',
          email: 'manager@srigayathri.com',
          storeAddress: 'Siddipet Bypass Road, Siddipet, Telangana'
        });
      }

      // 2. Load Business Settings
      const bizData = await dbService.getSettings('business');
      if (Object.keys(bizData).length > 0) {
        setBusinessSettings({
          deliveryArea: 'Siddipet', // Siddipet only
          minOrderAmount: bizData.minOrderAmount || '',
          deliveryCharges: bizData.deliveryCharges || '',
          storeOpeningHours: bizData.storeOpeningHours || ''
        });
      } else {
        setBusinessSettings({
          deliveryArea: 'Siddipet',
          minOrderAmount: '1000',
          deliveryCharges: '100',
          storeOpeningHours: '09:00 AM - 09:00 PM'
        });
      }

      // 3. Load Notifications
      const notifData = await dbService.getSettings('notifications');
      if (Object.keys(notifData).length > 0) {
        setNotifications({
          orderNotificationToggle: notifData.orderNotificationToggle !== false,
          lowStockAlerts: notifData.lowStockAlerts !== false,
          customerIssueAlerts: notifData.customerIssueAlerts !== false
        });
      }

      // 4. Load Carousel Banners
      const loadedBanners = await dbService.getCarouselBanners();
      setBanners(loadedBanners);

      // Load Festival Banner
      const festData = await dbService.getSettings('festivalBanner');
      if (Object.keys(festData).length > 0) {
        setFestivalBanner({
          title: festData.title || '',
          subtitle: festData.subtitle || '',
          imageUrl: festData.imageUrl || '',
          link: festData.link || '',
          active: festData.active === true
        });
      }

      // 5. Load Products for Featured selection
      const loadedProds = await dbService.getProducts();
      setProducts(loadedProds);

      // 6. Load Admin Credentials
      const loadedAdmins = await dbService.getAdminCredentials();
      setAdminCredentials(loadedAdmins);

    } catch (error) {
      console.error("Failed to load settings data:", error);
      showToast("Failed to load settings from database.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load all settings on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      loadSettingsData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSettingsData]);

  // Save Store Information Handler
  const handleSaveStoreInfo = async (e) => {
    e.preventDefault();
    if (adminProfile?.role !== 'Super Admin' && adminProfile?.role !== 'Manager') {
      showToast("Access Denied: You do not have permission to modify settings.", "error");
      return;
    }
    setLoading(true);
    try {
      await dbService.saveSettings('storeInfo', storeInfo);
      showToast("Store information saved successfully!");
    } catch (e) {
      console.error(e);
      showToast("Failed to save store information.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Save Business Settings Handler
  const handleSaveBusinessSettings = async (e) => {
    e.preventDefault();
    if (adminProfile?.role !== 'Super Admin' && adminProfile?.role !== 'Manager') {
      showToast("Access Denied: You do not have permission to modify settings.", "error");
      return;
    }
    setLoading(true);
    try {
      await dbService.saveSettings('business', businessSettings);
      showToast("Business settings saved successfully!");
    } catch (e) {
      console.error(e);
      showToast("Failed to save business settings.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Save Notification settings
  const handleSaveNotifications = async (e) => {
    e.preventDefault();
    if (adminProfile?.role !== 'Super Admin' && adminProfile?.role !== 'Manager') {
      showToast("Access Denied: You do not have permission to modify settings.", "error");
      return;
    }
    setLoading(true);
    try {
      await dbService.saveSettings('notifications', notifications);
      showToast("Notification settings updated successfully!");
    } catch (e) {
      console.error(e);
      showToast("Failed to save notification settings.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Homepage Carousel Banner Operations ---
  const handleOpenAddBanner = () => {
    setEditingBanner(null);
    setBannerForm({
      title: '',
      subtitle: '',
      buttonText: 'Shop Now',
      buttonLink: '/products',
      displayOrder: banners.length > 0 ? Math.max(...banners.map(b => Number(b.displayOrder) || 0)) + 1 : 1,
      status: 'Active',
      imageUrl: '',
      badge: 'Bulk Pricing'
    });
    setShowBannerModal(true);
  };

  const handleOpenEditBanner = (banner) => {
    setEditingBanner(banner.id);
    setBannerForm({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      buttonText: banner.buttonText || 'Shop Now',
      buttonLink: banner.buttonLink || '/products',
      displayOrder: banner.displayOrder || 1,
      status: banner.status || 'Active',
      imageUrl: banner.imageUrl || '',
      badge: banner.badge || 'Bulk Pricing'
    });
    setShowBannerModal(true);
  };



  const handleSaveBanner = async (e) => {
    e.preventDefault();
    if (adminProfile?.role !== 'Super Admin' && adminProfile?.role !== 'Manager') {
      showToast("Access Denied: You do not have permission to modify settings.", "error");
      return;
    }
    if (!bannerForm.imageUrl) {
      showToast("Please upload or provide a banner image.", "error");
      return;
    }
    setLoading(true);
    try {
      if (editingBanner) {
        await dbService.updateCarouselBanner(editingBanner, bannerForm);
        showToast("Carousel banner updated successfully!");
      } else {
        await dbService.addCarouselBanner(bannerForm);
        showToast("New carousel banner added successfully!");
      }
      setShowBannerModal(false);
      // Reload banner list
      const loadedBanners = await dbService.getCarouselBanners();
      setBanners(loadedBanners);
    } catch (err) {
      console.error(err);
      showToast("Failed to save banner.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBanner = async (id) => {
    if (adminProfile?.role !== 'Super Admin' && adminProfile?.role !== 'Manager') {
      showToast("Access Denied: You do not have permission to modify settings.", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this banner?")) return;
    setLoading(true);
    try {
      await dbService.deleteCarouselBanner(id);
      showToast("Banner deleted successfully!");
      const loadedBanners = await dbService.getCarouselBanners();
      setBanners(loadedBanners);
    } catch (err) {
      console.error(err);
      showToast("Failed to delete banner.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveBannerOrder = async (banner, direction) => {
    if (adminProfile?.role !== 'Super Admin' && adminProfile?.role !== 'Manager') {
      showToast("Access Denied: You do not have permission to modify settings.", "error");
      return;
    }
    const currentIndex = banners.findIndex(b => b.id === banner.id);
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === banners.length - 1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetBanner = banners[targetIndex];

    setLoading(true);
    try {
      // Swap displayOrder values
      const currentOrder = Number(banner.displayOrder) || 0;
      const targetOrder = Number(targetBanner.displayOrder) || 0;

      await dbService.updateCarouselBanner(banner.id, { displayOrder: targetOrder });
      await dbService.updateCarouselBanner(targetBanner.id, { displayOrder: currentOrder });

      showToast("Banner order rearranged!");
      const loadedBanners = await dbService.getCarouselBanners();
      setBanners(loadedBanners);
    } catch (err) {
      console.error(err);
      showToast("Failed to reorder banner.", "error");
    } finally {
      setLoading(false);
    }
  };



  const handleSaveFestivalBanner = async (e) => {
    e.preventDefault();
    if (adminProfile?.role !== 'Super Admin' && adminProfile?.role !== 'Manager') {
      showToast("Access Denied: You do not have permission to modify settings.", "error");
      return;
    }
    setLoading(true);
    try {
      await dbService.saveSettings('festivalBanner', festivalBanner);
      showToast("Festival banner settings saved!");
    } catch (err) {
      console.error(err);
      showToast("Failed to save festival banner.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Featured status on products
  const handleToggleProductFeatured = async (product) => {
    const isFeatured = !product.featured;
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, featured: isFeatured } : p));
    try {
      await dbService.updateProduct(product.id, { featured: isFeatured });
      showToast(`${product.name} is ${isFeatured ? 'now featured' : 'removed from featured'}!`);
    } catch (err) {
      console.error(err);
      showToast("Failed to update product status.", "error");
      // Rollback
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, featured: !isFeatured } : p));
    }
  };

  // Change Admin Password handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      showToast("New passwords do not match!", "error");
      return;
    }
    if (securityForm.newPassword.length < 6) {
      showToast("Password must be at least 6 characters long.", "error");
      return;
    }
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Session expired. Please sign in again.");
      
      const credential = EmailAuthProvider.credential(currentUser.email, securityForm.oldPassword);
      try {
        await reauthenticateWithCredential(currentUser, credential);
      } catch (reauthErr) {
        console.error("Reauthentication failed:", reauthErr);
        throw new Error("Invalid current password. Please check your credentials.");
      }
      
      try {
        await updatePassword(currentUser, securityForm.newPassword);
      } catch (pwdErr) {
        console.error("Password update failed:", pwdErr);
        if (pwdErr.code === 'auth/weak-password') {
          throw new Error("Password must be at least 6 characters long.");
        }
        throw new Error("Something went wrong. Please try again.");
      }
      showToast("Admin password changed successfully!");
      setSecurityForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.message || "Failed to change password.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Logout from all devices
  const handleLogoutAllDevices = () => {
    if (window.confirm("Are you sure you want to log out from all devices? This will invalidate all active sessions.")) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        showToast("Logged out from all devices successfully!");
      }, 2000);
    }
  };

  // --- Admin Credentials Handlers ---
  const handleOpenAddAdmin = () => {
    setEditingAdminId(null);
    setAdminForm({
      name: '',
      email: '',
      password: '',
      role: 'Manager',
      status: 'active'
    });
    setShowAdminModal(true);
  };

  const handleOpenEditAdmin = (admin) => {
    setEditingAdminId(admin.id);
    setAdminForm({
      name: admin.name || '',
      email: admin.email || '',
      password: '',
      role: admin.role || 'Manager',
      status: admin.status || 'active'
    });
    setShowAdminModal(true);
  };

  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    if (adminProfile?.role !== 'Super Admin') {
      showToast("Access Denied: Only Super Admins can manage admin credentials.", "error");
      return;
    }
    if (!adminForm.email || !adminForm.name) {
      showToast("Please fill in Name and Email.", "error");
      return;
    }

    const superAdminCount = adminCredentials.filter(a => a.role === 'Super Admin').length;
    const currentAdminToEdit = editingAdminId ? adminCredentials.find(a => a.id === editingAdminId) : null;
    const isUpgradingToSuper = adminForm.role === 'Super Admin' && (!currentAdminToEdit || currentAdminToEdit.role !== 'Super Admin');

    if (isUpgradingToSuper && superAdminCount >= 2) {
      showToast("Maximum of 2 Super Admin accounts allowed.", "error");
      return;
    }

    setLoading(true);
    try {
      if (editingAdminId) {
        if (currentAdminToEdit && currentAdminToEdit.email === 'admin@srigayathri.com') {
          showToast("Permanent Super Admin cannot be modified.", "error");
          setLoading(false);
          return;
        }

        await dbService.updateAdminCredential(editingAdminId, {
          name: adminForm.name.trim(),
          email: adminForm.email.trim().toLowerCase(),
          role: adminForm.role,
          status: adminForm.status || 'active'
        });
        showToast("Admin account credentials updated successfully!");
      } else {
        if (!adminForm.password || adminForm.password.length < 6) {
          showToast("Password must be at least 6 characters long.", "error");
          setLoading(false);
          return;
        }

        let uid;
        let secondaryApp;
        try {
          const appName = `SecondaryAuthApp_${Date.now()}`;
          secondaryApp = initializeApp(firebaseConfig, appName);
          const secondaryAuth = getAuth(secondaryApp);
          
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, adminForm.email.trim(), adminForm.password);
          uid = userCredential.user.uid;
        } catch (authErr) {
          console.error("Auth user creation failed:", authErr);
          if (authErr.code === 'auth/email-already-in-use') {
            showToast("An account with this email already exists.", "error");
          } else if (authErr.code === 'auth/weak-password') {
            showToast("Password must be at least 6 characters long.", "error");
          } else {
            showToast("Something went wrong. Please try again.", "error");
          }
          setLoading(false);
          return;
        } finally {
          if (secondaryApp) {
            await deleteApp(secondaryApp);
          }
        }

        await dbService.addAdminCredential({
          uid,
          name: adminForm.name.trim(),
          email: adminForm.email.trim().toLowerCase(),
          role: adminForm.role,
          status: 'active'
        });
        showToast("New admin account created successfully!");
      }
      setShowAdminModal(false);
      const loadedAdmins = await dbService.getAdminCredentials();
      setAdminCredentials(loadedAdmins);
    } catch (err) {
      console.error(err);
      showToast("Failed to save admin account.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (adminProfile?.role !== 'Super Admin') {
      showToast("Access Denied: Only Super Admins can manage admin credentials.", "error");
      return;
    }
    const adminToDelete = adminCredentials.find(a => a.id === id);
    if (adminToDelete && adminToDelete.email === 'admin@srigayathri.com') {
      showToast("Permanent Super Admin cannot be deleted.", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this admin account?")) return;
    setLoading(true);
    try {
      await dbService.deleteAdminCredential(id);
      showToast("Admin account deleted successfully!");
      const loadedAdmins = await dbService.getAdminCredentials();
      setAdminCredentials(loadedAdmins);
    } catch (err) {
      console.error(err);
      showToast("Failed to delete admin account.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Filter products for Featured Products tab
  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.brand?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category?.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Toast Messages */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border shadow-xl transition-all duration-300 transform scale-100 ${
          message.type === 'error' 
            ? 'bg-red-50 border-red-200 text-red-800' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {message.type === 'error' ? <AlertTriangle size={20} className="text-red-500" /> : <Check size={20} className="text-emerald-500" />}
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <SettingsIcon size={24} className="text-indigo-500 animate-spin" style={{ animationDuration: '8s' }} />
            Business Settings
          </h2>
          <p className="text-sm text-slate-500">Manage store identity, delivery options, homepage layout, and notifications</p>
        </div>
        <button
          onClick={loadSettingsData}
          className="flex items-center justify-center gap-2 text-xs text-indigo-500 hover:text-indigo-400 font-semibold cursor-pointer border border-indigo-500/20 px-3 py-1.5 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/10"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Sync Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Sidebar Tabs Navigation */}
        <div className="lg:col-span-3 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 pb-2 lg:pb-0 scrollbar-none">
          {[
            { id: 'store', label: 'Store Information', icon: Store },
            { id: 'business', label: 'Business Settings', icon: Briefcase },
            { id: 'homepage', label: 'Homepage Layout', icon: HomeIcon },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'security', label: 'Security & Access', icon: ShieldAlert }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer text-left
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                    : 'text-slate-500 hover:bg-slate-850/60 hover:text-slate-200'
                  }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Tab Contents */}
        <div className="lg:col-span-9">
          {/* loading state */}
          {loading && !showBannerModal && (
            <div className="glass-panel p-10 rounded-2xl border border-slate-850 flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500">Updating business configurations...</p>
            </div>
          )}

          {(!loading || showBannerModal) && (
            <div className="space-y-6">
              
              {/* TAB 1: STORE INFORMATION */}
              {activeTab === 'store' && (
                <form onSubmit={handleSaveStoreInfo} className="glass-panel p-6 rounded-2xl border border-slate-850 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Store size={20} className="text-indigo-500" />
                      Store Information
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Configure your primary wholesale store business identity and coordinates.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400">Store Name</label>
                      <input
                        type="text"
                        required
                        className="glass-input text-sm"
                        value={storeInfo.storeName}
                        onChange={e => setStoreInfo({ ...storeInfo, storeName: e.target.value })}
                        placeholder="e.g. Sri Gayathri Wholesale"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400">Owner Name</label>
                      <input
                        type="text"
                        required
                        className="glass-input text-sm"
                        value={storeInfo.ownerName}
                        onChange={e => setStoreInfo({ ...storeInfo, ownerName: e.target.value })}
                        placeholder="e.g. Gayathri Manager"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400">GST Number</label>
                      <input
                        type="text"
                        className="glass-input text-sm uppercase font-mono"
                        value={storeInfo.gstNumber}
                        onChange={e => setStoreInfo({ ...storeInfo, gstNumber: e.target.value })}
                        placeholder="e.g. 36AAAAA1111A1Z1"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400">Store Phone Number</label>
                      <input
                        type="text"
                        required
                        className="glass-input text-sm"
                        value={storeInfo.phoneNumber}
                        onChange={e => setStoreInfo({ ...storeInfo, phoneNumber: e.target.value })}
                        placeholder="e.g. +91 98765 43210"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-slate-400">Official Store Email</label>
                      <input
                        type="email"
                        required
                        className="glass-input text-sm"
                        value={storeInfo.email}
                        onChange={e => setStoreInfo({ ...storeInfo, email: e.target.value })}
                        placeholder="e.g. wholesale@srigayathri.com"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-slate-400">Store Physical Address</label>
                      <textarea
                        rows={3}
                        required
                        className="glass-input text-sm resize-none"
                        value={storeInfo.storeAddress}
                        onChange={e => setStoreInfo({ ...storeInfo, storeAddress: e.target.value })}
                        placeholder="Full physical shop/warehouse location details..."
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button type="submit" className="glass-btn-primary text-sm font-semibold flex items-center gap-2 cursor-pointer">
                      <Check size={16} />
                      Save Store Information
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: BUSINESS SETTINGS */}
              {activeTab === 'business' && (
                <form onSubmit={handleSaveBusinessSettings} className="glass-panel p-6 rounded-2xl border border-slate-850 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Briefcase size={20} className="text-indigo-500" />
                      Business Settings
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Configure minimum values, delivery cost metrics, and operational coordinates.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400">Delivery Area</label>
                      <div className="relative">
                        <input
                          type="text"
                          disabled
                          className="glass-input text-sm bg-slate-900 border-dashed w-full text-slate-400 font-semibold"
                          value="Siddipet only"
                        />
                        <span className="absolute right-3 top-2 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/15 text-amber-600 border border-amber-500/25">
                          Enforced
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">Orders are geographically bound to the local Siddipet region.</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400">Store Opening Hours</label>
                      <input
                        type="text"
                        required
                        className="glass-input text-sm"
                        value={businessSettings.storeOpeningHours}
                        onChange={e => setBusinessSettings({ ...businessSettings, storeOpeningHours: e.target.value })}
                        placeholder="e.g. 09:00 AM - 09:00 PM"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400">Minimum Order Amount (₹)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        className="glass-input text-sm font-mono"
                        value={businessSettings.minOrderAmount}
                        onChange={e => setBusinessSettings({ ...businessSettings, minOrderAmount: e.target.value })}
                        placeholder="e.g. 1000"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-400">Delivery Charges (₹)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        className="glass-input text-sm font-mono"
                        value={businessSettings.deliveryCharges}
                        onChange={e => setBusinessSettings({ ...businessSettings, deliveryCharges: e.target.value })}
                        placeholder="e.g. 100"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button type="submit" className="glass-btn-primary text-sm font-semibold flex items-center gap-2 cursor-pointer">
                      <Check size={16} />
                      Save Business Settings
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: HOMEPAGE LAYOUT */}
              {activeTab === 'homepage' && (
                <div className="space-y-8 animate-fade-in">
                  
                  {/* SUB-SECTION 1: CAROUSEL BANNER MANAGEMENT */}
                  <div className="glass-panel p-6 rounded-2xl border border-slate-850 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                          <Layers size={20} className="text-indigo-500" />
                          Homepage Carousel Banners
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Manage slides displayed in the Customer Portal hero section dynamically.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddBanner}
                        className="glass-btn-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Plus size={16} />
                        Add New Banner
                      </button>
                    </div>

                    {/* Banner list */}
                    {banners.length === 0 ? (
                      <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center">
                        <AlertTriangle className="mx-auto text-amber-500 mb-2" size={24} />
                        <p className="text-sm font-semibold text-slate-300">No Carousel Banners Found</p>
                        <p className="text-xs text-slate-500 mt-1">Create your first homepage dynamic banner using the button above.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {banners.map((banner, index) => (
                          <div key={banner.id} className="glass-card p-4 rounded-xl border border-slate-850 flex flex-col justify-between space-y-4">
                            <div>
                              <div className="relative rounded-lg overflow-hidden h-32 bg-slate-900 border border-slate-800">
                                {banner.imageUrl ? (
                                  <img 
                                    src={banner.imageUrl} 
                                    alt={banner.title} 
                                    className="w-full h-full object-cover" 
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">No Image Banner</div>
                                )}
                                <span className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                  banner.status === 'Active' 
                                    ? 'bg-emerald-600/10 text-emerald-500 border-emerald-500/20' 
                                    : 'bg-red-600/10 text-red-500 border-red-500/20'
                                }`}>
                                  {banner.status}
                                </span>
                                {banner.badge && (
                                  <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-slate-950 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                    {banner.badge}
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 space-y-1">
                                <h4 className="text-sm font-bold text-slate-200 truncate">{banner.title || 'Untitled Banner'}</h4>
                                <p className="text-xs text-slate-500 truncate">{banner.subtitle}</p>
                                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 pt-1">
                                  <span>Order: <strong className="text-slate-300 font-mono">{banner.displayOrder}</strong></span>
                                  <span>•</span>
                                  <span>CTA: <strong className="text-indigo-400 font-semibold">{banner.buttonText}</strong></span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setPreviewingBanner(banner)}
                                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                                  title="Preview"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditBanner(banner)}
                                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 border border-slate-800"
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBanner(banner.id)}
                                  className="p-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 hover:text-red-300 border border-red-500/10"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => handleMoveBannerOrder(banner, 'up')}
                                  className={`p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 ${
                                    index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-800 hover:text-slate-200'
                                  }`}
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === banners.length - 1}
                                  onClick={() => handleMoveBannerOrder(banner, 'down')}
                                  className={`p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 ${
                                    index === banners.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-800 hover:text-slate-200'
                                  }`}
                                >
                                  <ArrowDown size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SUB-SECTION 2: FESTIVAL BANNERS */}
                  <form onSubmit={handleSaveFestivalBanner} className="glass-panel p-6 rounded-2xl border border-slate-850 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <Sparkles size={20} className="text-indigo-500" />
                        Festival Banners & Promos
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Configure a seasonal alert banner to highlight key festival collections or discounts.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400">Promo Title</label>
                        <input
                          type="text"
                          className="glass-input text-sm"
                          value={festivalBanner.title}
                          onChange={e => setFestivalBanner({ ...festivalBanner, title: e.target.value })}
                          placeholder="e.g. Diwali Super Savings Deal!"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400">Promo Subtitle</label>
                        <input
                          type="text"
                          className="glass-input text-sm"
                          value={festivalBanner.subtitle}
                          onChange={e => setFestivalBanner({ ...festivalBanner, subtitle: e.target.value })}
                          placeholder="e.g. Extra 10% Cashbacks on NAMKEEN cartons"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400">Target Product/Page Route</label>
                        <input
                          type="text"
                          className="glass-input text-sm"
                          value={festivalBanner.link}
                          onChange={e => setFestivalBanner({ ...festivalBanner, link: e.target.value })}
                          placeholder="e.g. /products?category=Namkeens"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400">Status</label>
                        <div className="flex items-center gap-4 mt-2">
                          <button
                            type="button"
                            onClick={() => setFestivalBanner({ ...festivalBanner, active: !festivalBanner.active })}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              festivalBanner.active ? 'bg-indigo-600' : 'bg-slate-800'
                            }`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              festivalBanner.active ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                          <span className="text-xs font-semibold text-slate-300">
                            {festivalBanner.active ? 'Active (Displaying on Homepage)' : 'Inactive (Hidden)'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-400">Promo Image</label>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <div className="w-full sm:w-1/2 h-32 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
                            {festivalBanner.imageUrl ? (
                              <img 
                                src={festivalBanner.imageUrl} 
                                alt="Festival banner preview" 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <span className="text-xs text-slate-600">No Image Uploaded</span>
                            )}
                          </div>

                          <div className="w-full sm:w-1/2 flex flex-col gap-2">
                            <input
                              type="text"
                              className="glass-input text-xs"
                              placeholder="Paste direct image URL here..."
                              value={festivalBanner.imageUrl}
                              onChange={e => setFestivalBanner({ ...festivalBanner, imageUrl: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-end">
                      <button type="submit" className="glass-btn-primary text-sm font-semibold flex items-center gap-2 cursor-pointer">
                        <Check size={16} />
                        Save Festival Banner
                      </button>
                    </div>
                  </form>

                  {/* SUB-SECTION 3: FEATURED PRODUCTS SELECTION */}
                  <div className="glass-panel p-6 rounded-2xl border border-slate-850 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <Layers size={20} className="text-indigo-500" />
                        Featured Products Selector
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Select key products to display inside the "Best wholesale margins" featured grid.</p>
                    </div>

                    {/* Search and Filters */}
                    <div className="relative">
                      <Search size={18} className="absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        className="glass-input text-sm pl-10 w-full"
                        placeholder="Search products by title, category, or brand..."
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                      />
                    </div>

                    {/* Products Grid list with toggle */}
                    <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-900/40 max-h-96 overflow-y-auto">
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-center w-12">Featured</th>
                            <th className="px-4 py-3">Product Name</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Price</th>
                            <th className="px-4 py-3">Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {filteredProducts.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-4 py-6 text-center text-xs text-slate-500">
                                No products found matching your search.
                              </td>
                            </tr>
                          ) : (
                            filteredProducts.map(product => {
                              const isFeat = product.featured === true;
                              return (
                                <tr key={product.id} className="hover:bg-slate-850/30 text-xs text-slate-300">
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleProductFeatured(product)}
                                      className={`p-1 rounded transition-colors ${
                                        isFeat ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'
                                      }`}
                                    >
                                      {isFeat ? <CheckSquare size={18} /> : <Square size={18} />}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-200">{product.name}</div>
                                    <div className="text-[10px] text-slate-500">{product.brand}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium border border-slate-850">
                                      {product.category}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-slate-400">
                                    ₹{product.wholesalePrice} <span className="text-[9px] text-slate-500">({product.moq} MOQ)</span>
                                  </td>
                                  <td className="px-4 py-3 font-mono">
                                    <span className={product.stockQty <= (product.minStock || 10) ? "text-amber-500 font-semibold animate-pulse" : "text-slate-400"}>
                                      {product.stockQty} {product.unit || 'pcs'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 4: NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <form onSubmit={handleSaveNotifications} className="glass-panel p-6 rounded-2xl border border-slate-850 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Bell size={20} className="text-indigo-500" />
                      Notification Settings
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Configure automated triggers and alerts sent to the dashboard portal.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-850 bg-slate-900/20 hover:bg-slate-900/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-semibold text-slate-200">Order Notifications</h4>
                        <p className="text-xs text-slate-500">Trigger immediate sound alerts and popup notifications when a customer places an order.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotifications({ ...notifications, orderNotificationToggle: !notifications.orderNotificationToggle })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          notifications.orderNotificationToggle ? 'bg-indigo-600' : 'bg-slate-800'
                        }`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifications.orderNotificationToggle ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-850 bg-slate-900/20 hover:bg-slate-900/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-semibold text-slate-200">Low Stock Alerts</h4>
                        <p className="text-xs text-slate-500">Flag items immediately on the dashboard when inventory drops below custom threshold marks.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotifications({ ...notifications, lowStockAlerts: !notifications.lowStockAlerts })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          notifications.lowStockAlerts ? 'bg-indigo-600' : 'bg-slate-800'
                        }`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifications.lowStockAlerts ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-850 bg-slate-900/20 hover:bg-slate-900/30 transition-all duration-200">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-semibold text-slate-200">Customer Issue Alerts</h4>
                        <p className="text-xs text-slate-500">Flag new open issues submitted via customer support forms for instant review.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotifications({ ...notifications, customerIssueAlerts: !notifications.customerIssueAlerts })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          notifications.customerIssueAlerts ? 'bg-indigo-600' : 'bg-slate-800'
                        }`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          notifications.customerIssueAlerts ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button type="submit" className="glass-btn-primary text-sm font-semibold flex items-center gap-2 cursor-pointer">
                      <Check size={16} />
                      Save Notification Preferences
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 5: SECURITY */}
              {activeTab === 'security' && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* Admin Accounts Management */}
                  {adminProfile?.role === 'Super Admin' && (
                    <div className="glass-panel p-6 rounded-2xl border border-slate-850 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                            <ShieldAlert size={20} className="text-indigo-400" />
                            Admin Credentials & Access Control
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">Manage portal administrator login accounts and role privileges.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenAddAdmin}
                          className="glass-btn-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Plus size={16} />
                          Add Admin Credentials
                        </button>
                      </div>

                      <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-900/40">
                        <table className="premium-table">
                          <thead>
                            <tr>
                              <th className="px-4 py-3">Administrator Name</th>
                              <th className="px-4 py-3">Email / Username</th>
                              <th className="px-4 py-3">Access Role</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Created Date</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-xs">
                            {adminCredentials.length === 0 ? (
                              <tr>
                                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
                                  No admin credentials found.
                                </td>
                              </tr>
                            ) : (
                              adminCredentials.map(admin => (
                                <tr key={admin.id} className="hover:bg-slate-850/20 text-slate-300">
                                  <td className="px-4 py-3 font-semibold text-slate-200">
                                    {admin.name}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-slate-400">
                                    {admin.email}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-semibold border border-indigo-500/25">
                                      {admin.role}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2.5 py-0.5 rounded-full font-semibold border ${
                                      (admin.status || 'active') === 'active'
                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                      {(admin.status || 'active') === 'active' ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-slate-500">
                                    {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {admin.email === 'admin@srigayathri.com' ? (
                                      <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/25 uppercase tracking-wide">
                                        Permanent Super Admin
                                      </span>
                                    ) : (
                                      <div className="flex gap-2 justify-end">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditAdmin(admin)}
                                          className="p-1 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors"
                                          title="Edit Admin"
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteAdmin(admin.id)}
                                          className="p-1 text-red-400 hover:text-red-300 hover:bg-slate-850/50 rounded transition-colors"
                                          title="Delete Admin"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Password Change Form */}
                  <form onSubmit={handleChangePassword} className="glass-panel p-6 rounded-2xl border border-slate-850 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <Lock size={20} className="text-indigo-500" />
                        Change Admin Password
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Change credentials used to login to the system admin dashboards.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 max-w-md">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400">Current Admin Password</label>
                        <input
                          type="password"
                          required
                          className="glass-input text-sm"
                          value={securityForm.oldPassword}
                          onChange={e => setSecurityForm({ ...securityForm, oldPassword: e.target.value })}
                          placeholder="••••••••"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400">New Password</label>
                        <input
                          type="password"
                          required
                          className="glass-input text-sm"
                          value={securityForm.newPassword}
                          onChange={e => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                          placeholder="Min 6 characters..."
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-400">Confirm New Password</label>
                        <input
                          type="password"
                          required
                          className="glass-input text-sm"
                          value={securityForm.confirmPassword}
                          onChange={e => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                          placeholder="Repeat new password..."
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-end">
                      <button type="submit" className="glass-btn-primary text-sm font-semibold flex items-center gap-2 cursor-pointer">
                        <Check size={16} />
                        Update Admin Password
                      </button>
                    </div>
                  </form>

                  {/* Device Logout */}
                  <div className="glass-panel p-6 rounded-2xl border border-slate-850 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <LogOut size={20} className="text-red-500" />
                        Device Sessions
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Terminate and revoke access tokens across all active desktop and mobile browsers instantly.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-red-500/10 bg-red-600/5 text-red-400">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold">Logout from All Devices</p>
                        <p className="text-xs text-slate-500">Requires re-authenticating all active wholesale admin management sessions.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogoutAllDevices}
                        className="glass-btn-danger text-xs font-semibold py-2 cursor-pointer"
                      >
                        Terminate Sessions
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* DYNAMIC MODALS */}

      {/* 1. CAROUSEL BANNER ADD/EDIT MODAL */}
      {showBannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 overflow-hidden shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Layers size={18} className="text-indigo-400" />
                {editingBanner ? 'Edit Carousel Banner' : 'Create Carousel Banner'}
              </h4>
              <button
                onClick={() => setShowBannerModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveBanner} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">Banner Title</label>
                  <input
                    type="text"
                    required
                    className="glass-input text-xs py-1.5"
                    value={bannerForm.title}
                    onChange={e => setBannerForm({ ...bannerForm, title: e.target.value })}
                    placeholder="e.g. Personal Care Essentials"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">Banner Subtitle</label>
                  <input
                    type="text"
                    required
                    className="glass-input text-xs py-1.5"
                    value={bannerForm.subtitle}
                    onChange={e => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                    placeholder="e.g. Flat 15% GST Rebate"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">Badge Label</label>
                  <input
                    type="text"
                    className="glass-input text-xs py-1.5"
                    value={bannerForm.badge}
                    onChange={e => setBannerForm({ ...bannerForm, badge: e.target.value })}
                    placeholder="e.g. Bulk Pricing"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">CTA Button Text</label>
                  <input
                    type="text"
                    required
                    className="glass-input text-xs py-1.5"
                    value={bannerForm.buttonText}
                    onChange={e => setBannerForm({ ...bannerForm, buttonText: e.target.value })}
                    placeholder="e.g. View Products"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">CTA Button Link</label>
                  <input
                    type="text"
                    required
                    className="glass-input text-xs py-1.5"
                    value={bannerForm.buttonLink}
                    onChange={e => setBannerForm({ ...bannerForm, buttonLink: e.target.value })}
                    placeholder="e.g. /products?category=Soaps"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">Display Order</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="glass-input text-xs py-1.5 font-mono"
                    value={bannerForm.displayOrder}
                    onChange={e => setBannerForm({ ...bannerForm, displayOrder: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">Display Status</label>
                  <select
                    className="glass-input text-xs py-1.5"
                    value={bannerForm.status}
                    onChange={e => setBannerForm({ ...bannerForm, status: e.target.value })}
                  >
                    <option value="Active">Active (Visible)</option>
                    <option value="Inactive">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Banner Image Uploader */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase">Banner Image</label>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-16 rounded bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                    {bannerForm.imageUrl ? (
                      <img src={bannerForm.imageUrl} alt="banner thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] text-slate-600">No Image</span>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-1">
                    <input
                      type="text"
                      className="glass-input text-[10px] py-1"
                      placeholder="Paste direct image URL here..."
                      value={bannerForm.imageUrl}
                      onChange={e => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-800/85 flex justify-end gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setShowBannerModal(false)}
                  className="glass-btn-secondary px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary px-4 py-2"
                >
                  Save Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CAROUSEL BANNER LIVE PREVIEW MODAL */}
      {previewingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-3xl border border-slate-800 overflow-hidden shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-100">
                Customer Portal Banner Preview
              </h4>
              <button
                onClick={() => setPreviewingBanner(null)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Live Slider Simulation */}
            <div className="p-6">
              <div className="relative rounded-[20px] overflow-hidden shadow-xl aspect-[16/9] w-full bg-slate-900 flex flex-col justify-center p-8 sm:p-12 text-white">
                {/* Background image preview */}
                {previewingBanner.imageUrl ? (
                  <div className="absolute inset-0 z-0">
                    <img src={previewingBanner.imageUrl} alt="banner backdrop" className="w-full h-full object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent" />
                  </div>
                ) : (
                  <div className="absolute inset-0 z-0 bg-gradient-to-r from-indigo-700 to-indigo-900 opacity-60" />
                )}

                <div className="relative z-10 max-w-md space-y-3.5 text-left">
                  {previewingBanner.badge && (
                    <span className="inline-block bg-white/20 backdrop-blur-md text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                      {previewingBanner.badge}
                    </span>
                  )}
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-white">
                    {previewingBanner.title || 'Personal Care Essentials'}
                  </h1>
                  <p className="text-xs sm:text-sm text-white/90">
                    {previewingBanner.subtitle || 'Premium Shampoos & Soaps - Flat 15% GST Rebate'}
                  </p>
                  <button
                    type="button"
                    className="bg-yellow-400 text-slate-900 font-extrabold px-5 py-2 rounded-full text-[11px] shadow-md pointer-events-none"
                  >
                    {previewingBanner.buttonText || 'Shop Now'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewingBanner(null)}
                className="glass-btn-secondary text-xs font-semibold px-4 py-2"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ADMIN CREDENTIALS ADD/EDIT MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-800 overflow-hidden shadow-2xl animate-scale-in text-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <h4 className="text-base font-bold flex items-center gap-2">
                <ShieldAlert size={18} className="text-indigo-400" />
                {editingAdminId ? 'Edit Admin Credentials' : 'Create Admin Credentials'}
              </h4>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAdmin} className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase">Administrator Name</label>
                <input
                  type="text"
                  required
                  className="glass-input text-xs py-2"
                  value={adminForm.name}
                  onChange={e => setAdminForm({ ...adminForm, name: e.target.value })}
                  placeholder="e.g. John Doe"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase">Email / Username</label>
                <input
                  type="email"
                  required
                  className="glass-input text-xs py-2"
                  value={adminForm.email}
                  onChange={e => setAdminForm({ ...adminForm, email: e.target.value })}
                  placeholder="e.g. admin@srigayathri.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase">Password</label>
                <input
                  type="password"
                  required={!editingAdminId}
                  className="glass-input text-xs py-2"
                  value={adminForm.password}
                  onChange={e => setAdminForm({ ...adminForm, password: e.target.value })}
                  placeholder={editingAdminId ? "Enter new password (optional)" : "Enter login password"}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase">Access Privilege Role</label>
                <select
                  className="glass-input text-xs py-2 bg-slate-900 text-slate-300"
                  value={adminForm.role}
                  onChange={e => setAdminForm({ ...adminForm, role: e.target.value })}
                >
                  <option 
                    value="Super Admin" 
                    disabled={adminCredentials.filter(a => a.role === 'Super Admin').length >= 2 && (!editingAdminId || adminCredentials.find(a => a.id === editingAdminId)?.role !== 'Super Admin')}
                  >
                    Super Admin (All Permissions) {adminCredentials.filter(a => a.role === 'Super Admin').length >= 2 && (!editingAdminId || adminCredentials.find(a => a.id === editingAdminId)?.role !== 'Super Admin') ? '- (Limit Reached)' : ''}
                  </option>
                  <option value="Manager">Manager (Edit Products / Orders)</option>
                  <option value="Staff">Staff (Read-only / View reports)</option>
                </select>
                {adminCredentials.filter(a => a.role === 'Super Admin').length >= 2 && (!editingAdminId || adminCredentials.find(a => a.id === editingAdminId)?.role !== 'Super Admin') && (
                  <p className="text-[10px] text-amber-500 font-semibold mt-1">
                    Maximum of 2 Super Admin accounts allowed.
                  </p>
                )}
              </div>

              {editingAdminId && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase">Status</label>
                  <select
                    className="glass-input text-xs py-2 bg-slate-900 text-slate-300"
                    value={adminForm.status || 'active'}
                    onChange={e => setAdminForm({ ...adminForm, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-800/85 flex justify-end gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="glass-btn-secondary px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary px-4 py-2"
                >
                  Save Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
