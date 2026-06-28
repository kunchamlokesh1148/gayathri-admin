import { db } from '../firebase/config';
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

// --- Database Operations Wrapper ---
export const dbService = {
  // --- Products ---
  async getProducts() {
    const snap = await getDocs(collection(db, 'products'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getProduct(id) {
    const docSnap = await getDoc(doc(db, 'products', id));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  },

  async addProduct(productData) {
    const product = { ...productData, createdAt: new Date().toISOString() };
    const docRef = await addDoc(collection(db, 'products'), product);
    return { id: docRef.id, ...product };
  },

  async updateProduct(id, productData) {
    const docRef = doc(db, 'products', id);
    await updateDoc(docRef, productData);
    return { id, ...productData };
  },

  async deleteProduct(id) {
    await deleteDoc(doc(db, 'products', id));
    return id;
  },

  // --- Orders ---
  async getOrders() {
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
    const docRef = await addDoc(collection(db, 'orders'), order);
    return { id: docRef.id, ...order };
  },

  async updateOrder(id, orderData) {
    let update = { ...orderData, updatedAt: new Date().toISOString() };
    if (update.assignedAt === 'SERVER_TIMESTAMP') {
      update.assignedAt = serverTimestamp();
    }
    const docRef = doc(db, 'orders', id);
    await updateDoc(docRef, update);
    return { id, ...update };
  },

  async acceptOrder(orderId) {
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
  },

  // --- Customers ---
  async getCustomers() {
    const snap = await getDocs(collection(db, 'customers'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getCustomer(id) {
    const docSnap = await getDoc(doc(db, 'customers', id));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  },

  async addCustomer(customerData) {
    const customer = { ...customerData, createdAt: new Date().toISOString() };
    const docRef = await addDoc(collection(db, 'customers'), customer);
    return { id: docRef.id, ...customer };
  },

  // --- Categories ---
  async getCategories() {
    const snap = await getDocs(collection(db, 'categories'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addCategory(name) {
    const docRef = await addDoc(collection(db, 'categories'), { name, createdAt: serverTimestamp() });
    return { id: docRef.id, name };
  },

  async updateCategory(id, name) {
    const docRef = doc(db, 'categories', id);
    await updateDoc(docRef, { name });
    return { id, name };
  },

  async deleteCategory(id) {
    await deleteDoc(doc(db, 'categories', id));
    return id;
  },

  // --- Brands ---
  async getBrands() {
    const snap = await getDocs(collection(db, 'brands'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addBrand(name) {
    const docRef = await addDoc(collection(db, 'brands'), { name, createdAt: serverTimestamp() });
    return { id: docRef.id, name };
  },

  async updateBrand(id, name) {
    const docRef = doc(db, 'brands', id);
    await updateDoc(docRef, { name });
    return { id, name };
  },

  async deleteBrand(id) {
    await deleteDoc(doc(db, 'brands', id));
    return id;
  },

  // --- Delivery Staff ---
  async getDeliveryStaff() {
    const snap = await getDocs(collection(db, 'deliveryStaff'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async checkEmailExists(email) {
    const q = query(collection(db, 'deliveryStaff'), where('email', '==', email.trim()));
    const snap = await getDocs(q);
    return !snap.empty;
  },

  async addDeliveryStaff(staffData) {
    const staff = { ...staffData, createdAt: new Date().toISOString() };
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
    const docRef = doc(db, 'deliveryStaff', id);
    await updateDoc(docRef, staffData);
    return { id, ...staffData };
  },

  async deleteDeliveryStaff(id) {
    await deleteDoc(doc(db, 'deliveryStaff', id));
    return id;
  },

  // --- Settings ---
  async getSettings(type) {
    try {
      const docSnap = await getDoc(doc(db, 'settings', type));
      return docSnap.exists() ? docSnap.data() : {};
    } catch (e) {
      console.error(`Error loading settings for ${type}:`, e);
      return {};
    }
  },

  async saveSettings(type, data) {
    const docRef = doc(db, 'settings', type);
    await setDoc(docRef, data, { merge: true });
    return data;
  },

  // --- Homepage Carousel ---
  async getCarouselBanners() {
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
    const docRef = await addDoc(collection(db, 'homepageCarousel'), banner);
    return { id: docRef.id, ...banner };
  },

  async updateCarouselBanner(id, bannerData) {
    const docRef = doc(db, 'homepageCarousel', id);
    await updateDoc(docRef, bannerData);
    return { id, ...bannerData };
  },

  async deleteCarouselBanner(id) {
    await deleteDoc(doc(db, 'homepageCarousel', id));
    return id;
  },

  // --- Admin Credentials ---
  async getAdminCredentials() {
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
    const docRef = doc(db, 'adminCredentials', id);
    await updateDoc(docRef, credData);
    return { id, ...credData };
  },

  async deleteAdminCredential(id) {
    await deleteDoc(doc(db, 'adminCredentials', id));
    return id;
  }
};
