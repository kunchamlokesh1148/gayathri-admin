import { db, isMock } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';

// Local storage key names
const KEYS = {
  PRODUCTS: 'wholesale_products',
  ORDERS: 'wholesale_orders',
  CUSTOMERS: 'wholesale_customers',
  STAFF: 'wholesale_staff'
};

// --- Helper: Local Storage operations ---
const getLocal = (key) => JSON.parse(localStorage.getItem(key)) || [];
const setLocal = (key, data) => localStorage.setItem(key, JSON.stringify(data));


// --- Database Operations Wrapper ---
export const dbService = {
  // --- Products ---
  async getProducts() {
    if (isMock) {
      return getLocal(KEYS.PRODUCTS);
    }
    const snap = await getDocs(collection(db, 'products'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getProduct(id) {
    if (isMock) {
      return getLocal(KEYS.PRODUCTS).find(p => p.id === id) || null;
    }
    const docSnap = await getDoc(doc(db, 'products', id));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  },

  async addProduct(productData) {
    const product = { ...productData, createdAt: new Date().toISOString() };
    if (isMock) {
      const list = getLocal(KEYS.PRODUCTS);
      const newProduct = { id: 'prod_' + Math.random().toString(36).substr(2, 9), ...product };
      list.push(newProduct);
      setLocal(KEYS.PRODUCTS, list);
      return newProduct;
    }
    const docRef = await addDoc(collection(db, 'products'), product);
    return { id: docRef.id, ...product };
  },

  async updateProduct(id, productData) {
    if (isMock) {
      const list = getLocal(KEYS.PRODUCTS);
      const idx = list.findIndex(p => p.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...productData };
        setLocal(KEYS.PRODUCTS, list);
        return list[idx];
      }
      throw new Error("Product not found");
    }
    const docRef = doc(db, 'products', id);
    await updateDoc(docRef, productData);
    return { id, ...productData };
  },

  async deleteProduct(id) {
    if (isMock) {
      const list = getLocal(KEYS.PRODUCTS);
      const filtered = list.filter(p => p.id !== id);
      setLocal(KEYS.PRODUCTS, filtered);
      return id;
    }
    await deleteDoc(doc(db, 'products', id));
    return id;
  },

  // --- Orders ---
  async getOrders() {
    if (isMock) {
      return getLocal(KEYS.ORDERS);
    }
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addOrder(orderData) {
    const order = { 
      ...orderData, 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (isMock) {
      const list = getLocal(KEYS.ORDERS);
      const newOrder = { id: 'ord_' + Math.random().toString(36).substr(2, 9), ...order };
      list.push(newOrder);
      setLocal(KEYS.ORDERS, list);
      return newOrder;
    }
    const docRef = await addDoc(collection(db, 'orders'), order);
    return { id: docRef.id, ...order };
  },

  async updateOrder(id, orderData) {
    let update = { ...orderData, updatedAt: new Date().toISOString() };
    if (isMock) {
      if (update.assignedAt === 'SERVER_TIMESTAMP') {
        update.assignedAt = new Date().toISOString();
      }
      const list = getLocal(KEYS.ORDERS);
      const idx = list.findIndex(o => o.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...update };
        setLocal(KEYS.ORDERS, list);
        return list[idx];
      }
      throw new Error("Order not found");
    } else {
      if (update.assignedAt === 'SERVER_TIMESTAMP') {
        update.assignedAt = serverTimestamp();
      }
      const docRef = doc(db, 'orders', id);
      await updateDoc(docRef, update);
      return { id, ...update };
    }
  },

  async acceptOrder(orderId) {
    if (isMock) {
      const orders = getLocal(KEYS.ORDERS);
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx === -1) throw new Error("Order not found");
      
      const order = orders[idx];
      if (!order.stockDeducted) {
        // Retrieve products
        const products = getLocal(KEYS.PRODUCTS);
        const productUpdates = [];
        
        for (const item of order.items) {
          const pIdx = products.findIndex(p => p.id === item.id);
          if (pIdx === -1) throw new Error(`Product ${item.name} not found`);
          const product = products[pIdx];
          const wholesaleUnit = String(product.wholesaleUnit || product.unit || '').toLowerCase();
          const packQty = parseInt(product.packQuantity) || 12;
          const isPack = wholesaleUnit.includes('pack') || wholesaleUnit.includes('box');
          const requiredPieces = isPack ? (item.quantity * packQty) : item.quantity;
          
          const currentStock = parseInt(product.stockQty !== undefined ? product.stockQty : (product.stock || 0));
          if (currentStock < requiredPieces) {
            throw new Error(`Insufficient stock available for ${item.name}`);
          }
          productUpdates.push({ index: pIdx, newStock: currentStock - requiredPieces });
        }
        
        // Apply updates
        for (const update of productUpdates) {
          products[update.index].stock = update.newStock;
          products[update.index].stockQty = update.newStock;
        }
        setLocal(KEYS.PRODUCTS, products);
        order.stockDeducted = true;
      }
      
      order.status = 'Accepted';
      order.updatedAt = new Date().toISOString();
      orders[idx] = order;
      setLocal(KEYS.ORDERS, orders);
      return order;
    } else {
      const orderRef = doc(db, 'orders', orderId);
      await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error("Order not found");
        
        const orderData = orderSnap.data();
        if (orderData.status === 'Accepted') return; // already accepted
        
        const updates = {};
        if (!orderData.stockDeducted) {
          const productRefs = [];
          for (const item of orderData.items) {
            const productRef = doc(db, 'products', item.id);
            const productSnap = await transaction.get(productRef);
            if (!productSnap.exists()) throw new Error(`Product ${item.name} not found`);
            
            const pData = productSnap.data();
            const wholesaleUnit = String(pData.wholesaleUnit || pData.unit || '').toLowerCase();
            const packQty = parseInt(pData.packQuantity) || 12;
            const isPack = wholesaleUnit.includes('pack') || wholesaleUnit.includes('box');
            const requiredPieces = isPack ? (item.quantity * packQty) : item.quantity;
            
            const currentStock = parseInt(pData.stockQty !== undefined ? pData.stockQty : (pData.stock || 0));
            if (currentStock < requiredPieces) {
              throw new Error(`Insufficient stock available for ${item.name}`);
            }
            
            productRefs.push({ ref: productRef, newStock: currentStock - requiredPieces });
          }
          
          // Apply product updates
          for (const update of productRefs) {
            transaction.update(update.ref, {
              stock: update.newStock,
              stockQty: update.newStock
            });
          }
          updates.stockDeducted = true;
        }
        
        updates.status = 'Accepted';
        updates.updatedAt = new Date().toISOString();
        transaction.update(orderRef, updates);
      });
      
      return { id: orderId, status: 'Accepted', stockDeducted: true };
    }
  },

  // --- Customers ---
  async getCustomers() {
    if (isMock) {
      return getLocal(KEYS.CUSTOMERS);
    }
    const snap = await getDocs(collection(db, 'customers'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getCustomer(id) {
    if (isMock) {
      return getLocal(KEYS.CUSTOMERS).find(c => c.id === id) || null;
    }
    const docSnap = await getDoc(doc(db, 'customers', id));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  },

  async addCustomer(customerData) {
    const customer = { ...customerData, createdAt: new Date().toISOString() };
    if (isMock) {
      const list = getLocal(KEYS.CUSTOMERS);
      const newCustomer = { id: 'cust_' + Math.random().toString(36).substr(2, 9), ...customer };
      list.push(newCustomer);
      setLocal(KEYS.CUSTOMERS, list);
      return newCustomer;
    }
    const docRef = await addDoc(collection(db, 'customers'), customer);
    return { id: docRef.id, ...customer };
  },

  // --- Categories ---
  async getCategories() {
    if (isMock) {
      return getLocal('wholesale_categories');
    }
    const snap = await getDocs(collection(db, 'categories'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addCategory(name) {
    if (isMock) {
      const list = getLocal('wholesale_categories');
      const newCat = { id: 'cat_' + Math.random().toString(36).substr(2, 9), name };
      list.push(newCat);
      setLocal('wholesale_categories', list);
      return newCat;
    }
    const docRef = await addDoc(collection(db, 'categories'), { name, createdAt: serverTimestamp() });
    return { id: docRef.id, name };
  },

  async updateCategory(id, name) {
    if (isMock) {
      const list = getLocal('wholesale_categories');
      const idx = list.findIndex(c => c.id === id);
      if (idx !== -1) {
        list[idx].name = name;
        setLocal('wholesale_categories', list);
        return list[idx];
      }
      throw new Error("Category not found");
    }
    const docRef = doc(db, 'categories', id);
    await updateDoc(docRef, { name });
    return { id, name };
  },

  async deleteCategory(id) {
    if (isMock) {
      const list = getLocal('wholesale_categories');
      const filtered = list.filter(c => c.id !== id);
      setLocal('wholesale_categories', filtered);
      return id;
    }
    await deleteDoc(doc(db, 'categories', id));
    return id;
  },

  // --- Brands ---
  async getBrands() {
    if (isMock) {
      return getLocal('wholesale_brands');
    }
    const snap = await getDocs(collection(db, 'brands'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addBrand(name) {
    if (isMock) {
      const list = getLocal('wholesale_brands');
      const newBrand = { id: 'br_' + Math.random().toString(36).substr(2, 9), name };
      list.push(newBrand);
      setLocal('wholesale_brands', list);
      return newBrand;
    }
    const docRef = await addDoc(collection(db, 'brands'), { name, createdAt: serverTimestamp() });
    return { id: docRef.id, name };
  },

  async updateBrand(id, name) {
    if (isMock) {
      const list = getLocal('wholesale_brands');
      const idx = list.findIndex(b => b.id === id);
      if (idx !== -1) {
        list[idx].name = name;
        setLocal('wholesale_brands', list);
        return list[idx];
      }
      throw new Error("Brand not found");
    }
    const docRef = doc(db, 'brands', id);
    await updateDoc(docRef, { name });
    return { id, name };
  },

  async deleteBrand(id) {
    if (isMock) {
      const list = getLocal('wholesale_brands');
      const filtered = list.filter(b => b.id !== id);
      setLocal('wholesale_brands', filtered);
      return id;
    }
    await deleteDoc(doc(db, 'brands', id));
    return id;
  },

  // --- Delivery Staff ---
  async getDeliveryStaff() {
    if (isMock) {
      return getLocal(KEYS.STAFF);
    }
    const snap = await getDocs(collection(db, 'deliveryStaff'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async checkEmailExists(email) {
    if (isMock) {
      const list = getLocal(KEYS.STAFF);
      return list.some(s => s.email.toLowerCase() === email.trim().toLowerCase());
    }
    const q = query(collection(db, 'deliveryStaff'), where('email', '==', email.trim()));
    const snap = await getDocs(q);
    return !snap.empty;
  },

  async addDeliveryStaff(staffData) {
    const staff = { ...staffData, createdAt: new Date().toISOString() };
    if (isMock) {
      const list = getLocal(KEYS.STAFF);
      const newStaff = { id: staffData.uid || 'stf_' + Math.random().toString(36).substr(2, 9), ...staff };
      list.push(newStaff);
      setLocal(KEYS.STAFF, list);
      return newStaff;
    }
    const uid = staffData.uid;
    if (uid) {
      const docRef = doc(db, 'deliveryStaff', uid);
      await setDoc(docRef, staff);
      return { id: uid, ...staff };
    } else {
      const docRef = await addDoc(collection(db, 'deliveryStaff'), staff);
      return { id: docRef.id, ...staff };
    }
  },

  async updateDeliveryStaff(id, staffData) {
    if (isMock) {
      const list = getLocal(KEYS.STAFF);
      const idx = list.findIndex(s => s.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...staffData };
        setLocal(KEYS.STAFF, list);
        return list[idx];
      }
      throw new Error("Staff not found");
    }
    const docRef = doc(db, 'deliveryStaff', id);
    await updateDoc(docRef, staffData);
    return { id, ...staffData };
  },

  async deleteDeliveryStaff(id) {
    if (isMock) {
      const list = getLocal(KEYS.STAFF);
      const filtered = list.filter(s => s.id !== id);
      setLocal(KEYS.STAFF, filtered);
      return id;
    }
    await deleteDoc(doc(db, 'deliveryStaff', id));
    return id;
  },

  // --- Settings ---
  async getSettings(type) {
    if (isMock) {
      const allSettings = JSON.parse(localStorage.getItem('wholesale_settings')) || {};
      return allSettings[type] || {};
    }
    try {
      const docSnap = await getDoc(doc(db, 'settings', type));
      return docSnap.exists() ? docSnap.data() : {};
    } catch (e) {
      console.error(`Error loading settings for ${type}:`, e);
      return {};
    }
  },

  async saveSettings(type, data) {
    if (isMock) {
      const allSettings = JSON.parse(localStorage.getItem('wholesale_settings')) || {};
      allSettings[type] = data;
      localStorage.setItem('wholesale_settings', JSON.stringify(allSettings));
      return data;
    }
    const docRef = doc(db, 'settings', type);
    await setDoc(docRef, data, { merge: true });
    return data;
  },

  // --- Homepage Carousel ---
  async getCarouselBanners() {
    if (isMock) {
      return JSON.parse(localStorage.getItem('wholesale_carousel')) || [];
    }
    try {
      const q = query(collection(db, 'homepageCarousel'), orderBy('displayOrder', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error("Error loading carousel banners:", e);
      return [];
    }
  },

  async addCarouselBanner(bannerData) {
    const banner = { ...bannerData, createdAt: new Date().toISOString() };
    if (isMock) {
      const list = JSON.parse(localStorage.getItem('wholesale_carousel')) || [];
      const newBanner = { id: 'banner_' + Math.random().toString(36).substr(2, 9), ...banner };
      list.push(newBanner);
      localStorage.setItem('wholesale_carousel', JSON.stringify(list));
      return newBanner;
    }
    const docRef = await addDoc(collection(db, 'homepageCarousel'), banner);
    return { id: docRef.id, ...banner };
  },

  async updateCarouselBanner(id, bannerData) {
    if (isMock) {
      const list = JSON.parse(localStorage.getItem('wholesale_carousel')) || [];
      const idx = list.findIndex(b => b.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...bannerData };
        localStorage.setItem('wholesale_carousel', JSON.stringify(list));
        return list[idx];
      }
      throw new Error("Banner not found");
    }
    const docRef = doc(db, 'homepageCarousel', id);
    await updateDoc(docRef, bannerData);
    return { id, ...bannerData };
  },

  async deleteCarouselBanner(id) {
    if (isMock) {
      const list = JSON.parse(localStorage.getItem('wholesale_carousel')) || [];
      const filtered = list.filter(b => b.id !== id);
      localStorage.setItem('wholesale_carousel', JSON.stringify(filtered));
      return id;
    }
    await deleteDoc(doc(db, 'homepageCarousel', id));
    return id;
  },

  // --- Admin Credentials ---
  async getAdminCredentials() {
    if (isMock) {
      return JSON.parse(localStorage.getItem('wholesale_admins')) || [
        { id: 'admin_default', name: 'System Admin', email: 'admin@srigayathri.com', role: 'Super Admin', createdAt: new Date().toISOString() }
      ];
    }
    try {
      const snap = await getDocs(collection(db, 'adminCredentials'));
      if (snap.empty) {
        const defaultAdmin = { name: 'System Admin', email: 'admin@srigayathri.com', role: 'Super Admin', createdAt: new Date().toISOString() };
        const docRef = await addDoc(collection(db, 'adminCredentials'), defaultAdmin);
        return [{ id: docRef.id, ...defaultAdmin }];
      }
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error("Error loading admin credentials:", e);
      return [];
    }
  },

  async addAdminCredential(credData) {
    const cred = { ...credData, createdAt: new Date().toISOString() };
    if (isMock) {
      const list = JSON.parse(localStorage.getItem('wholesale_admins')) || [
        { id: 'admin_default', name: 'System Admin', email: 'admin@srigayathri.com', role: 'Super Admin', createdAt: new Date().toISOString() }
      ];
      const newCred = { id: credData.uid || 'admin_' + Math.random().toString(36).substr(2, 9), ...cred };
      list.push(newCred);
      localStorage.setItem('wholesale_admins', JSON.stringify(list));
      return newCred;
    }
    const uid = credData.uid;
    if (uid) {
      const docRef = doc(db, 'adminCredentials', uid);
      await setDoc(docRef, cred);
      return { id: uid, ...cred };
    } else {
      const docRef = await addDoc(collection(db, 'adminCredentials'), cred);
      return { id: docRef.id, ...cred };
    }
  },

  async updateAdminCredential(id, credData) {
    if (isMock) {
      const list = JSON.parse(localStorage.getItem('wholesale_admins')) || [
        { id: 'admin_default', name: 'System Admin', email: 'admin@srigayathri.com', role: 'Super Admin', createdAt: new Date().toISOString() }
      ];
      const idx = list.findIndex(c => c.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...credData };
        localStorage.setItem('wholesale_admins', JSON.stringify(list));
        return list[idx];
      }
      throw new Error("Admin credential not found");
    }
    const docRef = doc(db, 'adminCredentials', id);
    await updateDoc(docRef, credData);
    return { id, ...credData };
  },

  async deleteAdminCredential(id) {
    if (isMock) {
      const list = JSON.parse(localStorage.getItem('wholesale_admins')) || [
        { id: 'admin_default', name: 'System Admin', email: 'admin@srigayathri.com', role: 'Super Admin', createdAt: new Date().toISOString() }
      ];
      const filtered = list.filter(c => c.id !== id);
      localStorage.setItem('wholesale_admins', JSON.stringify(filtered));
      return id;
    }
    await deleteDoc(doc(db, 'adminCredentials', id));
    return id;
  }
};
