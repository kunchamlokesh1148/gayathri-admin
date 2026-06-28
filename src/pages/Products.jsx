import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  AlertTriangle,
  Layers,
  Upload,
  CheckCircle2
} from 'lucide-react';
import { dbService } from '../services/db';
import { uploadImageToCloudinary } from '../services/cloudinary';
import { useAuth } from '../context/AuthContext';

const getProductPacks = (p) => {
  const wholesaleUnit = String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase();
  const packQuantity = parseInt(p?.packQuantity) || 12;
  const stockQty = p?.stockQty !== undefined ? p.stockQty : (p?.stock || 0);
  if (wholesaleUnit.includes('pack') || wholesaleUnit.includes('box')) {
    return Math.floor(stockQty / packQuantity);
  }
  return stockQty;
};

export default function Products() {
  const { adminProfile } = useAuth();
  const isStaff = adminProfile?.role === 'Staff';
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  
  // Tabs: 'all' | 'add' | 'manage'
  const [activeTab, setActiveTab] = useState('all');

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Categories & Brands States
  const [categoriesList, setCategoriesList] = useState([]);
  const [brandsList, setBrandsList] = useState([]);
  const [newCatName, setNewCatName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [manageTab, setManageTab] = useState('categories'); // 'categories' | 'brands'
  const [manageError, setManageError] = useState('');

  // Add Product Form States
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    imageUrl: '',
    category: '',
    brand: '',
    purchaseCost: '',
    wholesalePrice: '',
    mrp: '',
    wholesaleUnit: 'Piece',
    packQuantity: '1',
    stockQty: '0',
    minStock: '10',
    status: 'Active',
    description: ''
  });

  // Quick Adjust Modal States
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [adjustPrice, setAdjustPrice] = useState('0.00');
  const [adjustStock, setAdjustStock] = useState(0);
  const [adjustStatus, setAdjustStatus] = useState('Active');
  const [adjustWholesaleUnit, setAdjustWholesaleUnit] = useState('Piece');
  const [adjustPackQuantity, setAdjustPackQuantity] = useState(12);
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Delete Confirmation States
  const [deleteProductObj, setDeleteProductObj] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodData, cats, brs] = await Promise.all([
        dbService.getProducts(),
        dbService.getCategories(),
        dbService.getBrands()
      ]);
      setProducts(prodData);
      setCategoriesList(cats);
      setBrandsList(brs);

      // Initialize default category and brand selections for the Add Product form
      if (cats.length > 0) {
        setFormData(prev => {
          if (!prev.category) {
            return { ...prev, category: cats[0].name };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to load products, categories, or brands:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Form Handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'wholesaleUnit') {
        if (value === 'Piece') {
          updated.packQuantity = '1';
        } else if (prev.wholesaleUnit === 'Piece') {
          updated.packQuantity = '12';
        }
      }
      return updated;
    });
  };

  const calculatePackTotal = (cost, qty) => {
    const c = parseFloat(cost);
    const q = parseInt(qty);
    if (isNaN(c) || isNaN(q)) return null;
    const total = c * q;
    return Number.isInteger(total) ? total.toFixed(0) : total.toFixed(2);
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormError("Image size must be smaller than 5MB");
        return;
      }
      setFormError('');
      
      // Upload immediately to Cloudinary to fill the URL box
      setUploadProgress('Uploading image...');
      try {
        const url = await uploadImageToCloudinary(file);
        setFormData(prev => ({ ...prev, imageUrl: url }));
        setUploadProgress('Upload success!');
        setTimeout(() => setUploadProgress(''), 2000);
      } catch (err) {
        console.error("Cloudinary upload failed:", err);
        setFormError("Cloudinary upload failed. Please type the image URL manually.");
        setUploadProgress('');
      }
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const purchaseCostNum = parseFloat(formData.purchaseCost);
    const wholesalePriceNum = parseFloat(formData.wholesalePrice);
    const mrpNum = parseFloat(formData.mrp);
    const packQuantityNum = parseInt(formData.packQuantity);
    const stockQtyNum = parseInt(formData.stockQty);
    const minStockNum = parseInt(formData.minStock);

    // Validations
    if (!formData.name.trim()) return setFormError('Product Name is required');
    if (!formData.category) return setFormError('Category is required');
    if (isNaN(purchaseCostNum) || purchaseCostNum <= 0) return setFormError('Purchase Cost must be greater than 0');
    if (isNaN(wholesalePriceNum) || wholesalePriceNum <= 0) return setFormError('Wholesale Price must be greater than 0');
    if (isNaN(mrpNum) || mrpNum <= 0) return setFormError('MRP must be greater than 0');
    
    const isPackOrBox = formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box';
    if (isPackOrBox) {
      if (isNaN(packQuantityNum) || packQuantityNum <= 0) {
        return setFormError(`${formData.wholesaleUnit} Quantity must be greater than 0 when Wholesale Unit is ${formData.wholesaleUnit}`);
      }
    }
    
    if (isNaN(stockQtyNum) || stockQtyNum < 0) return setFormError('Stock Quantity cannot be negative');
    if (isNaN(minStockNum) || minStockNum < 0) return setFormError('Minimum Stock threshold cannot be negative');

    try {
      setFormLoading(true);
      
      const generatedSku = 'SKU-' + Math.floor(100000 + Math.random() * 900000);
      const finalImageUrl = formData.imageUrl.trim() || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=600';

      const isPackOrBox = formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box';
      const purchasePackTotal = purchaseCostNum * (isPackOrBox ? packQuantityNum : 1);
      const wholesalePackTotal = wholesalePriceNum * (isPackOrBox ? packQuantityNum : 1);
      const mrpPackTotal = mrpNum * (isPackOrBox ? packQuantityNum : 1);

      const newProduct = {
        name: formData.name.trim(),
        sku: generatedSku,
        category: formData.category,
        brand: formData.brand.trim() || '',
        purchaseCost: purchaseCostNum,
        wholesalePrice: wholesalePriceNum,
        mrp: mrpNum,
        wholesaleUnit: formData.wholesaleUnit,
        packQuantity: isPackOrBox ? packQuantityNum : 1,

        purchasePackTotal,
        wholesalePackTotal,
        mrpPackTotal,

        stockQty: stockQtyNum,
        minStock: minStockNum,
        status: formData.status,
        description: formData.description.trim(),
        imageUrl: finalImageUrl,
        image: finalImageUrl, // duplicate for customer portal compatibility
        
        // Backward compatibility keys
        purchasePrice: purchaseCostNum,
        price: wholesalePriceNum,
        stock: stockQtyNum,
        unit: isPackOrBox ? `${formData.wholesaleUnit} of ${packQuantityNum}` : 'Piece'
      };

      await dbService.addProduct(newProduct);
      
      // Reset Form
      setFormData({
        name: '',
        imageUrl: '',
        category: categoriesList[0]?.name || '',
        brand: '',
        purchaseCost: '',
        wholesalePrice: '',
        mrp: '',
        wholesaleUnit: 'Piece',
        packQuantity: '1',
        stockQty: '0',
        minStock: '10',
        status: 'Active',
        description: ''
      });
      
      setFormSuccess('Product created successfully!');
      setTimeout(() => {
        setFormSuccess('');
        setActiveTab('all');
        fetchData();
      }, 1500);

    } catch (err) {
      console.error("Failed to add product:", err);
      setFormError(err.message || 'An error occurred while creating the product');
    } finally {
      setFormLoading(false);
    }
  };

  // Quick Adjust Handlers
  const openQuickAdjust = (product) => {
    setAdjustProduct(product);
    const multiplier = (product.wholesaleUnit === 'Pack' || product.wholesaleUnit === 'Box') ? (parseInt(product.packQuantity) || 12) : 1;
    const pricePerPiece = product.wholesalePrice !== undefined ? product.wholesalePrice : (product.price || 0);
    setAdjustPrice(Number(pricePerPiece * multiplier).toFixed(0));
    setAdjustStock(product.stockQty !== undefined ? product.stockQty : (product.stock || 0));
    setAdjustStatus(product.status || 'Active');
    setAdjustWholesaleUnit(product.wholesaleUnit || product.unit || 'Piece');
    setAdjustPackQuantity(product.packQuantity !== undefined ? parseInt(product.packQuantity) : 12);
  };

  const handleSaveQuickAdjust = async () => {
    if (!adjustProduct) return;
    try {
      setAdjustLoading(true);
      const multiplier = (adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box') ? (parseInt(adjustPackQuantity) || 12) : 1;
      const inputtedPrice = parseFloat(adjustPrice) || 0;
      const pricePerPiece = inputtedPrice / multiplier;

      // Calculate totals for pack/box if wholesaleUnit is Pack/Box
      const costPerPiece = adjustProduct.purchaseCost !== undefined ? adjustProduct.purchaseCost : (adjustProduct.purchasePrice !== undefined ? adjustProduct.purchasePrice : pricePerPiece * 0.85);
      const mrpPerPiece = adjustProduct.mrp !== undefined ? adjustProduct.mrp : pricePerPiece * 1.25;

      const purchasePackTotal = costPerPiece * multiplier;
      const wholesalePackTotal = pricePerPiece * multiplier;
      const mrpPackTotal = mrpPerPiece * multiplier;

      const updateData = { 
        price: pricePerPiece,
        wholesalePrice: pricePerPiece,
        purchasePackTotal,
        wholesalePackTotal,
        mrpPackTotal,
        stock: parseInt(adjustStock) || 0,
        stockQty: parseInt(adjustStock) || 0,
        wholesaleUnit: adjustWholesaleUnit,
        packQuantity: parseInt(adjustPackQuantity) || 1,
        status: adjustStatus,
        updatedAt: new Date().toISOString()
      };
      await dbService.updateProduct(adjustProduct.id, updateData);
      setProducts(prev => prev.map(p => p.id === adjustProduct.id ? { ...p, ...updateData } : p));
      setAdjustProduct(null);
    } catch (err) {
      console.error("Failed to quick adjust product:", err);
      alert("Failed to update product: " + err.message);
    } finally {
      setAdjustLoading(false);
    }
  };

  // Delete Handler
  const handleDeleteProduct = async () => {
    if (!deleteProductObj) return;
    try {
      setDeleting(true);
      await dbService.deleteProduct(deleteProductObj.id);
      setProducts(prev => prev.filter(p => p.id !== deleteProductObj.id));
      setDeleteProductObj(null);
    } catch (err) {
      console.error("Failed to delete product:", err);
      alert("Failed to delete product: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Categories & Brands Handlers
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setManageError('');
    try {
      const newCat = await dbService.addCategory(newCatName.trim());
      setCategoriesList(prev => [...prev, newCat]);
      setNewCatName('');
    } catch (err) {
      console.error("Failed to add category:", err);
      setManageError(err.message || "Failed to add category");
    }
  };

  const handleUpdateCategory = async (id) => {
    if (!editingName.trim()) return;
    setManageError('');
    try {
      const updated = await dbService.updateCategory(id, editingName.trim());
      setCategoriesList(prev => prev.map(c => c.id === id ? updated : c));
      setEditingId(null);
      setEditingName('');
      fetchData();
    } catch (err) {
      console.error("Failed to update category:", err);
      setManageError(err.message || "Failed to update category");
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm("Are you sure you want to delete this category? Products in this category will remain, but the category option will be removed.")) return;
    setManageError('');
    try {
      await dbService.deleteCategory(id);
      setCategoriesList(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error("Failed to delete category:", err);
      setManageError(err.message || "Failed to delete category");
    }
  };

  const handleAddBrand = async (e) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    setManageError('');
    try {
      const newBrand = await dbService.addBrand(newBrandName.trim());
      setBrandsList(prev => [...prev, newBrand]);
      setNewBrandName('');
    } catch (err) {
      console.error("Failed to add brand:", err);
      setManageError(err.message || "Failed to add brand");
    }
  };

  const handleUpdateBrand = async (id) => {
    if (!editingName.trim()) return;
    setManageError('');
    try {
      const updated = await dbService.updateBrand(id, editingName.trim());
      setBrandsList(prev => prev.map(b => b.id === id ? updated : b));
      setEditingId(null);
      setEditingName('');
      fetchData();
    } catch (err) {
      console.error("Failed to update brand:", err);
      setManageError(err.message || "Failed to update brand");
    }
  };

  const handleDeleteBrand = async (id) => {
    if (!confirm("Are you sure you want to delete this brand? Products associated with this brand will remain, but the brand option will be removed.")) return;
    setManageError('');
    try {
      await dbService.deleteBrand(id);
      setBrandsList(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error("Failed to delete brand:", err);
      setManageError(err.message || "Failed to delete brand");
    }
  };

  // Filter & Search Logic
  const categoriesFilterList = ['All', ...new Set(categoriesList.map(c => c.name))];
  const brandsFilterList = ['All', ...new Set(brandsList.map(b => b.name))];

  const filteredProducts = products.filter(p => {
    const name = p?.name || '';
    const category = p?.category || '';
    const brand = p?.brand || '';
    const status = p?.status || 'Active';

    const matchSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === 'All' || category === selectedCategory;
    const matchBrand = selectedBrand === 'All' || brand === selectedBrand;
    const matchStatus = selectedStatus === 'All' || status === selectedStatus;

    return matchSearch && matchCategory && matchBrand && matchStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400">Loading catalog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header and Tabs */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Product Catalog</h2>
          <p className="text-sm text-slate-400">Manage inventory products, pricing matrix, categories, and brands.</p>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex gap-3">
          <button 
            onClick={() => setActiveTab('all')} 
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
              activeTab === 'all' 
                ? 'bg-[#B8860B] text-white border-[#B8860B] shadow-md shadow-[#B8860B]/10' 
                : 'bg-white border-[#D6C7A6] text-[#4B5563] hover:text-[#B8860B] hover:bg-[#FAF4E7]'
            }`}
          >
            All Products
          </button>
          {!isStaff && (
            <>
              <button 
                onClick={() => setActiveTab('add')} 
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'add' 
                    ? 'bg-[#B8860B] text-white border-[#B8860B] shadow-md shadow-[#B8860B]/10' 
                    : 'bg-white border-[#D6C7A6] text-[#4B5563] hover:text-[#B8860B] hover:bg-[#FAF4E7]'
                }`}
              >
                <Plus size={13} className={activeTab === 'add' ? 'text-white' : 'text-[#B8860B]'} />
                Add Product
              </button>
              <button 
                onClick={() => setActiveTab('manage')} 
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  activeTab === 'manage' 
                    ? 'bg-[#B8860B] text-white border-[#B8860B] shadow-md shadow-[#B8860B]/10' 
                    : 'bg-white border-[#D6C7A6] text-[#4B5563] hover:text-[#B8860B] hover:bg-[#FAF4E7]'
                }`}
              >
                Categories & Brands
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab 1: All Products List (Table View) */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 rounded-xl glass-panel">
            {/* Search */}
            <div className="relative col-span-12 md:col-span-6">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by name..."
                className="premium-input pl-10 pr-4 w-full"
                style={{ paddingLeft: '2.5rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <div className="relative col-span-12 md:col-span-2">
              <select
                className="premium-input pr-10 cursor-pointer appearance-none"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {categoriesFilterList.filter(c => c !== 'All').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>

            {/* Brand Filter */}
            <div className="relative col-span-12 md:col-span-2">
              <select
                className="premium-input pr-10 cursor-pointer appearance-none"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
              >
                <option value="All">All Brands</option>
                {brandsFilterList.filter(b => b !== 'All').map(br => (
                  <option key={br} value={br}>{br}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>

            {/* Status Filter */}
            <div className="relative col-span-12 md:col-span-2">
              <select
                className="premium-input pr-10 cursor-pointer appearance-none"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-[#E6D9B8]">
            <div className="overflow-x-auto">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th className="p-4">PRODUCT NAME</th>
                    <th className="p-4">CATEGORY</th>
                    <th className="p-4">BRAND</th>
                    <th className="p-4 text-center">PURCHASE PRICE</th>
                    <th className="p-4 text-center">WHOLESALE PRICE</th>
                    <th className="p-4 text-center">MRP</th>
                    <th className="p-4 text-center">UNIT</th>
                    <th className="p-4 text-center">STOCK QTY</th>
                    <th className="p-4 text-center">STATUS</th>
                    {!isStaff && <th className="p-4 text-center">ACTIONS</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const currentStock = p.stockQty !== undefined ? p.stockQty : p.stock;
                    const packs = getProductPacks(p);
                    const isOutOfStock = packs <= 0;
                    const isLowStock = packs > 0 && packs <= (p.minStock || 10);
                    const multiplier = (p.wholesaleUnit === 'Pack' || p.wholesaleUnit === 'Box') ? (parseInt(p.packQuantity) || 12) : 1;

                    return (
                      <tr key={p.id}>
                        {/* Product Name & Icon */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-900/40 border border-slate-800 flex-shrink-0">
                              <Package size={18} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-200 text-sm leading-tight">{p.name}</p>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="p-4 text-slate-450 font-medium text-xs text-slate-400">{p.category}</td>

                        {/* Brand */}
                        <td className="p-4 text-slate-400 text-xs">{p.brand || 'No Brand'}</td>

                        {/* Purchase Price */}
                        <td className="p-4 text-center text-xs text-slate-300 font-medium">
                          ₹{Number((p.purchaseCost !== undefined ? p.purchaseCost : (p.purchasePrice !== undefined ? p.purchasePrice : p.price * 0.85)) * multiplier).toFixed(0)}
                        </td>

                        {/* Wholesale Price */}
                        <td className="p-4 text-center text-xs font-bold text-indigo-600">
                          ₹{Number((p.wholesalePrice !== undefined ? p.wholesalePrice : p.price) * multiplier).toFixed(0)}
                        </td>

                        {/* MRP */}
                        <td className="p-4 text-center text-xs text-slate-400 font-medium">
                          ₹{Number((p.mrp !== undefined ? p.mrp : p.price * 1.25) * multiplier).toFixed(0)}
                        </td>

                        {/* Unit */}
                        <td className="p-4 text-center">
                          <span className="bg-slate-900/40 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                            {(p.wholesaleUnit === 'Pack' || p.wholesaleUnit === 'Box') ? `${p.wholesaleUnit} (${p.packQuantity})` : (p.wholesaleUnit || p.unit || 'Piece')}
                          </span>
                        </td>

                        {/* Stock Qty */}
                        <td className="p-4 text-center font-bold text-slate-200 text-sm">
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center gap-2 justify-center">
                              {packs} {String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('pack') || String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('box') ? 'Pack(s)' : 'Piece(s)'}
                              {isOutOfStock && (
                                <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] shadow-sm shadow-[#f43f5e]/50 inline-block" title="Out of Stock" />
                              )}
                              {isLowStock && (
                                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-sm shadow-[#f59e0b]/50 inline-block" title="Low Stock Alert" />
                              )}
                            </span>
                            {(String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('pack') || String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('box')) && (
                              <span className="text-[10px] text-slate-500 font-normal mt-0.5">({currentStock} pcs)</span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-4 text-center">
                          <span className={p.status === 'Active' || !p.status
                            ? 'text-emerald-600 font-bold text-xs tracking-wider'
                            : 'text-slate-500 font-bold text-xs tracking-wider'
                          }>
                            {p.status ? p.status.toUpperCase() : 'ACTIVE'}
                          </span>
                        </td>

                        {/* Actions */}
                        {!isStaff && (
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => openQuickAdjust(p)}
                                className="text-xs bg-indigo-600/10 text-indigo-600 border border-indigo-500/20 hover:bg-indigo-600/20 px-2.5 py-1 rounded font-bold transition-all active:scale-95 cursor-pointer"
                              >
                                Quick Adjust
                              </button>
                              <Link 
                                to={`/products/edit/${p.id}`} 
                                className="text-slate-400 hover:text-slate-100 transition-colors p-1"
                                title="Edit product info"
                              >
                                <Edit3 size={15} />
                              </Link>
                              <button 
                                onClick={() => setDeleteProductObj(p)}
                                className="text-slate-400 hover:text-red-400 transition-colors p-1"
                                title="Delete product"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package size={48} className="text-slate-700 mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">No products found</h3>
                <p className="text-sm text-slate-500 max-w-sm mt-1">Try clearing filters or search query.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Register New Product Form */}
      {activeTab === 'add' && (
        <div className="max-w-3xl mx-auto glass-panel p-6 md:p-8 rounded-2xl border border-slate-850 space-y-6">
          <div className="border-b border-slate-800/80 pb-3">
            <h3 className="text-base font-bold text-slate-200 tracking-wide">REGISTER NEW WHOLESALE PRODUCT</h3>
          </div>

          {formError && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle size={18} className="mt-0.5 min-w-[18px]" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <CheckCircle2 size={18} className="mt-0.5 min-w-[18px]" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateProduct} className="space-y-5">
            {/* Row 1: Name & Image URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="E.g. Maggi Masala Noodles"
                  className="w-full pl-3 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product Image URL</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    name="imageUrl"
                    value={formData.imageUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/image.jpg"
                    className="w-full pl-3 pr-10 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500"
                  />
                  <label className="absolute right-2 cursor-pointer text-slate-400 hover:text-slate-100 p-1.5 rounded-md hover:bg-slate-800/60 transition-colors">
                    <Upload size={14} className={uploadProgress ? "animate-bounce" : ""} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
                  </label>
                </div>
                {uploadProgress && (
                  <p className="text-[10px] text-indigo-500 animate-pulse mt-0.5">{uploadProgress}</p>
                )}
              </div>
            </div>

            {/* Row 2: Category & Brand */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
                <div className="relative">
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full pl-3 pr-10 py-2.5 glass-input text-sm text-slate-100 appearance-none cursor-pointer"
                    required
                  >
                    {categoriesList.map(cat => (
                      <option key={cat.id} value={cat.name} className="bg-slate-900 text-slate-100">{cat.name}</option>
                    ))}
                    {categoriesList.length === 0 && <option value="" className="bg-slate-900 text-slate-100">No Categories Available</option>}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Brand (Optional)</label>
                <div className="relative">
                  <select
                    name="brand"
                    value={formData.brand}
                    onChange={handleInputChange}
                    className="w-full pl-3 pr-10 py-2.5 glass-input text-sm text-slate-100 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-100">Select Brand</option>
                    {brandsList.map(b => (
                      <option key={b.id} value={b.name} className="bg-slate-900 text-slate-100">{b.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Financials & Packaging */}
            <div className={`grid grid-cols-1 ${(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-4`}>
              {/* Purchase Cost */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Cost (₹) - 1 Piece *</label>
                <input
                  type="number"
                  name="purchaseCost"
                  value={formData.purchaseCost}
                  onChange={handleInputChange}
                  placeholder="10"
                  step="0.01"
                  className="w-full pl-3 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500 font-mono"
                  required
                />
                {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.purchaseCost, formData.packQuantity) && (
                  <span className="text-[11px] text-indigo-650 text-indigo-600 font-bold mt-1 leading-tight">
                    Total {formData.wholesaleUnit} Purchase Cost: ₹{calculatePackTotal(formData.purchaseCost, formData.packQuantity)}
                  </span>
                )}
              </div>

              {/* Wholesale Price */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wholesale Price (₹) - 1 Piece *</label>
                <input
                  type="number"
                  name="wholesalePrice"
                  value={formData.wholesalePrice}
                  onChange={handleInputChange}
                  placeholder="13"
                  step="0.01"
                  className="w-full pl-3 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500 font-mono"
                  required
                />
                {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.wholesalePrice, formData.packQuantity) && (
                  <span className="text-[11px] text-indigo-650 text-indigo-600 font-bold mt-1 leading-tight">
                    Total {formData.wholesaleUnit} Wholesale Price: ₹{calculatePackTotal(formData.wholesalePrice, formData.packQuantity)}
                  </span>
                )}
              </div>

              {/* MRP */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MRP (₹) - 1 Piece *</label>
                <input
                  type="number"
                  name="mrp"
                  value={formData.mrp}
                  onChange={handleInputChange}
                  placeholder="15"
                  step="0.01"
                  className="w-full pl-3 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500 font-mono"
                  required
                />
                {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.mrp, formData.packQuantity) && (
                  <span className="text-[11px] text-indigo-650 text-indigo-600 font-bold mt-1 leading-tight">
                    Total {formData.wholesaleUnit} MRP: ₹{calculatePackTotal(formData.mrp, formData.packQuantity)}
                  </span>
                )}
              </div>

              {/* Wholesale Unit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Wholesale Unit *</label>
                <div className="relative">
                  <select
                    name="wholesaleUnit"
                    value={formData.wholesaleUnit}
                    onChange={handleInputChange}
                    className="w-full pl-3 pr-10 py-2.5 glass-input text-sm text-slate-100 appearance-none cursor-pointer"
                    required
                  >
                    <option value="Piece" className="bg-slate-900 text-slate-100">Piece</option>
                    <option value="Pack" className="bg-slate-900 text-slate-100">Pack</option>
                    <option value="Box" className="bg-slate-900 text-slate-100">Box</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Pack/Box Quantity */}
              {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && (
                <div className="flex flex-col gap-1.5 animate-fade-in">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{formData.wholesaleUnit} Quantity *</label>
                  <input
                    type="number"
                    name="packQuantity"
                    value={formData.packQuantity}
                    onChange={handleInputChange}
                    placeholder="E.g. 12"
                    className="w-full pl-3 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500 font-mono"
                    required
                  />
                </div>
              )}
            </div>

            {/* Row 4: Stock, Min Alert, Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stock Quantity *</label>
                <input
                  type="number"
                  name="stockQty"
                  value={formData.stockQty}
                  onChange={handleInputChange}
                  placeholder="0"
                  className="w-full pl-3 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500 font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Min Alert Limit *</label>
                <input
                  type="number"
                  name="minStock"
                  value={formData.minStock}
                  onChange={handleInputChange}
                  placeholder="10"
                  className="w-full pl-3 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500 font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status *</label>
                <div className="relative">
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full pl-3 pr-10 py-2.5 glass-input text-sm text-slate-100 appearance-none cursor-pointer"
                  >
                    <option value="Active" className="bg-slate-900 text-slate-100">Active</option>
                    <option value="Inactive" className="bg-slate-900 text-slate-100">Inactive</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Product wholesale package details, weights, contents description..."
                className="w-full pl-3 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500 min-h-[6rem] resize-none"
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-5 border-t border-slate-800/80">
              <button 
                type="button" 
                onClick={() => setActiveTab('all')}
                className="glass-btn-secondary py-2.5 px-6 text-xs"
                disabled={formLoading}
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={formLoading}
                className="glass-btn-primary py-2.5 px-6 text-xs"
              >
                {formLoading ? 'Saving...' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Categories & Brands Management */}
      {activeTab === 'manage' && (
        <div className="glass-panel p-6 md:p-8 rounded-2xl border border-slate-800 space-y-6 max-w-4xl mx-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Layers size={20} className="text-indigo-400" />
              Manage Categories & Brands
            </h3>
          </div>

          {manageError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-shake">
              {manageError}
            </div>
          )}

          {/* Toggle buttons for management sub-categories */}
          <div className="flex border-b border-slate-800 gap-2">
            <button
              onClick={() => { setManageTab('categories'); setEditingId(null); setManageError(''); }}
              className={`flex-1 pb-2 text-sm font-bold border-b-2 transition-all ${
                manageTab === 'categories' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent text-slate-405 text-slate-400 hover:text-slate-200'
              }`}
            >
              Categories ({categoriesList.length})
            </button>
            <button
              onClick={() => { setManageTab('brands'); setEditingId(null); setManageError(''); }}
              className={`flex-1 pb-2 text-sm font-bold border-b-2 transition-all ${
                manageTab === 'brands' ? 'border-indigo-500 text-indigo-400 font-bold' : 'border-transparent text-slate-405 text-slate-400 hover:text-slate-200'
              }`}
            >
              Brands ({brandsList.length})
            </button>
          </div>

          {/* Categories Manager Panel */}
          {manageTab === 'categories' && (
            <div className="space-y-4">
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter new category name..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 glass-input text-xs py-2 px-3"
                  required
                />
                <button type="submit" className="glass-btn-primary py-2 px-4 text-xs font-semibold">
                  Add Category
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[20rem] overflow-y-auto pr-1">
                {categoriesList.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                    {editingId === cat.id ? (
                      <div className="flex gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 glass-input text-xs py-1 px-2"
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => handleUpdateCategory(cat.id)} 
                          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded"
                        >
                          Save
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setEditingId(null)} 
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-slate-200 font-semibold">{cat.name}</span>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }} 
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                          >
                            Edit
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)} 
                            className="text-[11px] text-rose-400 hover:text-rose-300 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {categoriesList.length === 0 && (
                  <p className="col-span-2 text-center text-xs text-slate-500 py-4">No categories created yet.</p>
                )}
              </div>
            </div>
          )}

          {/* Brands Manager Panel */}
          {manageTab === 'brands' && (
            <div className="space-y-4">
              <form onSubmit={handleAddBrand} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter new brand name..."
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="flex-1 glass-input text-xs py-2 px-3"
                  required
                />
                <button type="submit" className="glass-btn-primary py-2 px-4 text-xs font-semibold">
                  Add Brand
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[20rem] overflow-y-auto pr-1">
                {brandsList.map(brand => (
                  <div key={brand.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                    {editingId === brand.id ? (
                      <div className="flex gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 glass-input text-xs py-1 px-2"
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => handleUpdateBrand(brand.id)} 
                          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded"
                        >
                          Save
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setEditingId(null)} 
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-slate-200 font-semibold">{brand.name}</span>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => { setEditingId(brand.id); setEditingName(brand.name); }} 
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                          >
                            Edit
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteBrand(brand.id)} 
                            className="text-[11px] text-rose-400 hover:text-rose-300 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {brandsList.length === 0 && (
                  <p className="col-span-2 text-center text-xs text-slate-500 py-4">No brands created yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Adjust Dialog Box Modal */}
      {adjustProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-slate-800 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
              <h4 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Package size={20} className="text-indigo-600" />
                Quick Adjust Product
              </h4>
              <button 
                onClick={() => setAdjustProduct(null)} 
                className="text-slate-400 hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Product Name</p>
              <p className="text-sm font-bold text-slate-200">{adjustProduct.name}</p>
            </div>

            <div className="space-y-4">
              {/* Wholesale Unit Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wholesale Unit</label>
                <div className="relative">
                  <select
                    value={adjustWholesaleUnit}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      const oldMultiplier = (adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box') ? (parseInt(adjustPackQuantity) || 12) : 1;
                      const pPerPiece = (parseFloat(adjustPrice) || 0) / oldMultiplier;
                      
                      setAdjustWholesaleUnit(newUnit);
                      
                      let newPackQty = adjustPackQuantity;
                      if (newUnit === 'Piece') {
                        newPackQty = 1;
                        setAdjustPackQuantity(1);
                      } else if (adjustPackQuantity <= 1) {
                        newPackQty = 12;
                        setAdjustPackQuantity(12);
                      }
                      
                      const newMultiplier = (newUnit === 'Pack' || newUnit === 'Box') ? (parseInt(newPackQty) || 12) : 1;
                      setAdjustPrice(Number(pPerPiece * newMultiplier).toFixed(0));
                    }}
                    className="w-full pl-3 pr-10 py-2.5 glass-input text-sm text-slate-100 appearance-none cursor-pointer"
                  >
                    <option value="Piece" className="bg-slate-900 text-slate-100">Piece</option>
                    <option value="Pack" className="bg-slate-900 text-slate-100">Pack</option>
                    <option value="Box" className="bg-slate-900 text-slate-100">Box</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Pack Quantity Field */}
              {(adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pack/Box Quantity</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full pl-3 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500 font-mono"
                    value={adjustPackQuantity}
                    onChange={(e) => {
                      const newPackQty = Math.max(1, parseInt(e.target.value) || 1);
                      const oldMultiplier = (adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box') ? (parseInt(adjustPackQuantity) || 12) : 1;
                      const pPerPiece = (parseFloat(adjustPrice) || 0) / oldMultiplier;
                      
                      setAdjustPackQuantity(newPackQty);
                      
                      const newMultiplier = (adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box') ? newPackQty : 1;
                      setAdjustPrice(Number(pPerPiece * newMultiplier).toFixed(0));
                    }}
                  />
                </div>
              )}

              {/* Wholesale Price Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Wholesale Price { (adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box') ? `per ${adjustWholesaleUnit}` : 'per Piece' }
                </label>
                <input
                  type="number"
                  className="w-full pl-3 pr-3 py-2.5 glass-input text-sm text-slate-100 placeholder-slate-500 font-mono"
                  value={adjustPrice}
                  onChange={(e) => setAdjustPrice(e.target.value)}
                />
              </div>

              {/* Stock Quantity Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Stock (Total Pieces)</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAdjustStock(prev => Math.max(0, prev - ((adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box') ? (parseInt(adjustPackQuantity) || 12) : 1)))}
                    className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-100 font-bold active:scale-95 transition-all cursor-pointer"
                    title={(adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box') ? `Subtract 1 ${adjustWholesaleUnit}` : 'Subtract 1 piece'}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="flex-1 text-center py-2.5 glass-input text-sm text-slate-100 font-bold font-mono"
                    style={{ background: 'rgba(255, 255, 255, 0.45)', color: '#1c1a16' }}
                    value={adjustStock}
                    onChange={(e) => setAdjustStock(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <button
                    onClick={() => setAdjustStock(prev => prev + ((adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box') ? (parseInt(adjustPackQuantity) || 12) : 1))}
                    className="px-3 py-2.5 bg-slate-900/60 hover:bg-slate-850/80 border border-slate-800 rounded-lg text-slate-100 font-bold active:scale-95 transition-all cursor-pointer"
                    title={(adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box') ? `Add 1 ${adjustWholesaleUnit}` : 'Add 1 piece'}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Recalculated Stock Status Preview */}
              <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800/60 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Available Stock:</span>
                  <span className="font-bold text-slate-300">
                    {(adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box')
                      ? `${Math.floor((parseInt(adjustStock) || 0) / (parseInt(adjustPackQuantity) || 12))} ${adjustWholesaleUnit}(s) (${adjustStock} pcs)`
                      : `${adjustStock} Piece(s)`
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Stock Status:</span>
                  {(() => {
                    const packsVal = (adjustWholesaleUnit === 'Pack' || adjustWholesaleUnit === 'Box')
                      ? Math.floor((parseInt(adjustStock) || 0) / (parseInt(adjustPackQuantity) || 12))
                      : (parseInt(adjustStock) || 0);
                    const isOut = packsVal <= 0;
                    const isLow = packsVal > 0 && packsVal <= (adjustProduct.minStock !== undefined ? parseInt(adjustProduct.minStock) : 10);
                    
                    if (isOut) {
                      return <span className="text-red-600 font-extrabold uppercase tracking-wide">Out of Stock</span>;
                    } else if (isLow) {
                      return <span className="text-amber-600 font-extrabold uppercase tracking-wide">Low Stock</span>;
                    } else {
                      return <span className="text-emerald-600 font-extrabold uppercase tracking-wide">In Stock</span>;
                    }
                  })()}
                </div>
              </div>

              {/* Status Dropdown Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Dropdown</label>
                <div className="relative">
                  <select
                    value={adjustStatus}
                    onChange={(e) => setAdjustStatus(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 glass-input text-sm text-slate-100 appearance-none cursor-pointer"
                  >
                    <option value="Active" className="bg-slate-900 text-slate-100">Active</option>
                    <option value="Inactive" className="bg-slate-900 text-slate-100">Inactive</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
              <button
                onClick={() => setAdjustProduct(null)}
                disabled={adjustLoading}
                className="glass-btn-secondary py-2.5 px-6 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuickAdjust}
                disabled={adjustLoading}
                className="glass-btn-primary py-2.5 px-6 text-xs flex items-center justify-center gap-1.5 min-w-[7rem]"
              >
                {adjustLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteProductObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-slate-800 space-y-6">
            <div className="flex items-center gap-3.5 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-full border border-red-500/25">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-105 text-slate-100">Delete Wholesale Product</h4>
                <p className="text-xs text-slate-500">This operation cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-100">{deleteProductObj.name}</span> from the catalog? Any active vendor orders matching this SKU will remain, but this product will be removed from future stock cataloging.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setDeleteProductObj(null)}
                disabled={deleting}
                className="glass-btn-secondary py-2 text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="glass-btn-danger py-2 text-xs flex items-center gap-1.5"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
