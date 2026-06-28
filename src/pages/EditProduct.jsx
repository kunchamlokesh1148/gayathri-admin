import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { dbService } from '../services/db';
import { uploadImageToCloudinary } from '../services/cloudinary';

export default function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  const [categoriesList, setCategoriesList] = useState([]);
  const [brandsList, setBrandsList] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    sku: '',
    category: '',
    purchaseCost: '',
    wholesalePrice: '',
    mrp: '',
    wholesaleUnit: 'Piece',
    packQuantity: '1',
    stockQty: '0',
    minStock: '10',
    description: '',
    imageUrl: '',
    status: 'Active'
  });

  useEffect(() => {
    const fetchProductAndOptions = async () => {
      try {
        setLoading(true);
        const [data, cats, brs] = await Promise.all([
          dbService.getProduct(id),
          dbService.getCategories(),
          dbService.getBrands()
        ]);
        setCategoriesList(cats);
        setBrandsList(brs);

        if (data) {
          const loadedPurchaseCost = data.purchaseCost !== undefined ? data.purchaseCost : (data.purchasePrice !== undefined ? data.purchasePrice : '');
          const loadedWholesalePrice = data.wholesalePrice !== undefined ? data.wholesalePrice : (data.price !== undefined ? data.price : '');
          const loadedMrp = data.mrp !== undefined ? data.mrp : '';
          const loadedStockQty = data.stockQty !== undefined ? data.stockQty : (data.stock !== undefined ? data.stock : '0');
          const loadedWholesaleUnit = data.wholesaleUnit || (data.unit && data.unit.startsWith('Pack') ? 'Pack' : (data.unit && data.unit.startsWith('Box') ? 'Box' : 'Piece'));
          
          let loadedPackQuantity = '1';
          if (data.packQuantity !== undefined) {
            loadedPackQuantity = String(data.packQuantity);
          } else if (data.unit && data.unit.startsWith('Pack of ')) {
            const match = data.unit.match(/Pack of (\d+)/);
            if (match) loadedPackQuantity = match[1];
          } else if (data.unit && data.unit.startsWith('Box of ')) {
            const match = data.unit.match(/Box of (\d+)/);
            if (match) loadedPackQuantity = match[1];
          } else if (loadedWholesaleUnit === 'Pack' || loadedWholesaleUnit === 'Box') {
            loadedPackQuantity = '12';
          }

          setFormData({
            name: data.name || '',
            brand: data.brand || brs[0]?.name || '',
            sku: data.sku || '',
            category: data.category || cats[0]?.name || '',
            purchaseCost: String(loadedPurchaseCost),
            wholesalePrice: String(loadedWholesalePrice),
            mrp: String(loadedMrp),
            wholesaleUnit: loadedWholesaleUnit,
            packQuantity: String(loadedPackQuantity),
            stockQty: String(loadedStockQty),
            minStock: data.minStock !== undefined ? String(data.minStock) : '10',
            description: data.description || '',
            imageUrl: data.imageUrl || '',
            status: data.status || 'Active'
          });
          setImagePreview(data.imageUrl || '');
        } else {
          setError("Product not found in the catalog");
        }
      } catch (err) {
        console.error("Failed to load product details or options:", err);
        setError("Error fetching product records from the database");
      } finally {
        setLoading(false);
      }
    };
    fetchProductAndOptions();
  }, [id]);

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be smaller than 5MB");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const purchaseCostNum = parseFloat(formData.purchaseCost);
    const wholesalePriceNum = parseFloat(formData.wholesalePrice);
    const mrpNum = parseFloat(formData.mrp);
    const packQuantityNum = parseInt(formData.packQuantity);
    const stockQtyNum = parseInt(formData.stockQty);
    const minStockNum = parseInt(formData.minStock);

    // Validations
    if (!formData.name.trim()) return setError('Product Name is required');
    if (!formData.brand.trim()) return setError('Product Brand is required');
    if (!formData.category.trim()) return setError('Product Category is required');
    if (isNaN(purchaseCostNum) || purchaseCostNum <= 0) return setError('Purchase Cost must be greater than 0');
    if (isNaN(wholesalePriceNum) || wholesalePriceNum <= 0) return setError('Wholesale Price must be greater than 0');
    if (isNaN(mrpNum) || mrpNum <= 0) return setError('MRP must be greater than 0');
    
    const isPackOrBox = formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box';
    if (isPackOrBox) {
      if (isNaN(packQuantityNum) || packQuantityNum <= 0) {
        return setError(`${formData.wholesaleUnit} Quantity must be greater than 0 when Wholesale Unit is ${formData.wholesaleUnit}`);
      }
    } else {
      setFormData(prev => ({ ...prev, packQuantity: '1' }));
    }
    
    if (isNaN(stockQtyNum) || stockQtyNum < 0) return setError('Stock Quantity cannot be negative');
    if (isNaN(minStockNum) || minStockNum < 0) return setError('Minimum Stock threshold cannot be negative');

    try {
      setSaving(true);
      
      let imageUrl = formData.imageUrl;
      
      if (imageFile) {
        setUploadProgress('Uploading new image to Cloudinary...');
        try {
          imageUrl = await uploadImageToCloudinary(imageFile);
        } catch (uploadErr) {
          console.error("Cloudinary upload failed:", uploadErr);
          setError("Cloudinary upload failed, using local file preview to save edits.");
          imageUrl = imagePreview;
        }
      }

      setUploadProgress('Updating product logs...');

      const isPackOrBox = formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box';
      const purchasePackTotal = purchaseCostNum * (isPackOrBox ? packQuantityNum : 1);
      const wholesalePackTotal = wholesalePriceNum * (isPackOrBox ? packQuantityNum : 1);
      const mrpPackTotal = mrpNum * (isPackOrBox ? packQuantityNum : 1);

      await dbService.updateProduct(id, {
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        sku: formData.sku,
        category: formData.category,
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
        description: formData.description.trim(),
        status: formData.status,
        imageUrl,
        image: imageUrl, // duplicate for customer portal compatibility
        
        // Backward compatibility properties
        purchasePrice: purchaseCostNum,
        price: wholesalePriceNum,
        stock: stockQtyNum,
        unit: isPackOrBox ? `${formData.wholesaleUnit} of ${packQuantityNum}` : 'Piece'
      });

      navigate('/products');
    } catch (err) {
      console.error("Failed to update product:", err);
      setError(err.message || 'An error occurred while updating the product');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400">Fetching product details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
      {/* Back navigation */}
      <div className="flex items-center gap-3">
        <Link to="/products" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Edit Wholesale Product</h2>
          <p className="text-xs text-slate-500">Modify properties and image details for SKU: {formData.sku}</p>
        </div>
      </div>

      {error && !formData.name && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={18} className="mt-0.5 min-w-[18px]" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form Box */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8 rounded-2xl border border-slate-800 space-y-6">
        {error && formData.name && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-450 text-xs animate-shake">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Details */}
          <div className="space-y-4">
            {/* Product Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Product Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-3 pr-3 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            {/* SKU (Read-Only) and Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">SKU Code (System Generated)</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  disabled
                  className="w-full pl-3 pr-3 py-2.5 bg-[#070b14]/50 border border-slate-800/85 rounded-lg text-sm text-slate-400 uppercase opacity-60 cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Category *</label>
                <div className="relative">
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full pl-3 pr-10 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 appearance-none cursor-pointer focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    required
                  >
                    {categoriesList.map(cat => (
                      <option key={cat.id} value={cat.name} className="bg-[#070b14]">{cat.name}</option>
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
            </div>

            {/* Brand and Wholesale Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Brand *</label>
                <div className="relative">
                  <select
                    name="brand"
                    value={formData.brand}
                    onChange={handleInputChange}
                    className="w-full pl-3 pr-10 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 appearance-none cursor-pointer focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    required
                  >
                    {brandsList.map(b => (
                      <option key={b.id} value={b.name} className="bg-[#070b14]">{b.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Wholesale Unit *</label>
                <div className="relative">
                  <select
                    name="wholesaleUnit"
                    value={formData.wholesaleUnit}
                    onChange={handleInputChange}
                    className="w-full pl-3 pr-10 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 appearance-none cursor-pointer focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    required
                  >
                    <option value="Piece" className="bg-[#070b14]">Piece</option>
                    <option value="Pack" className="bg-[#070b14]">Pack</option>
                    <option value="Box" className="bg-[#070b14]">Box</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Pack/Box Quantity */}
            {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && (
              <div className="flex flex-col gap-1.5 animate-fade-in">
                <label className="text-xs font-semibold text-slate-400">{formData.wholesaleUnit} Quantity *</label>
                <input
                  type="number"
                  name="packQuantity"
                  value={formData.packQuantity}
                  onChange={handleInputChange}
                  placeholder="E.g. 12"
                  className="w-full pl-3 pr-3 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
            )}

            {/* Pricing Cost Structure */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Purchase Cost (₹) *</label>
                <input
                  type="number"
                  name="purchaseCost"
                  value={formData.purchaseCost}
                  onChange={handleInputChange}
                  step="0.01"
                  className="w-full pl-3 pr-3 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
                {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.purchaseCost, formData.packQuantity) && (
                  <span className="text-[10px] text-[#00a3ff] font-bold mt-1 leading-tight">
                    Total {formData.wholesaleUnit} Purchase Cost: ₹{calculatePackTotal(formData.purchaseCost, formData.packQuantity)}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Wholesale Price (₹) *</label>
                <input
                  type="number"
                  name="wholesalePrice"
                  value={formData.wholesalePrice}
                  onChange={handleInputChange}
                  step="0.01"
                  className="w-full pl-3 pr-3 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
                {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.wholesalePrice, formData.packQuantity) && (
                  <span className="text-[10px] text-[#00a3ff] font-bold mt-1 leading-tight">
                    Total {formData.wholesaleUnit} Wholesale Price: ₹{calculatePackTotal(formData.wholesalePrice, formData.packQuantity)}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">MRP (₹) *</label>
                <input
                  type="number"
                  name="mrp"
                  value={formData.mrp}
                  onChange={handleInputChange}
                  step="0.01"
                  className="w-full pl-3 pr-3 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
                {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.mrp, formData.packQuantity) && (
                  <span className="text-[10px] text-[#00a3ff] font-bold mt-1 leading-tight">
                    Total {formData.wholesaleUnit} MRP: ₹{calculatePackTotal(formData.mrp, formData.packQuantity)}
                  </span>
                )}
              </div>
                    {/* Stock, Min Alert Limit, Status */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Stock (Units) *</label>
                <input
                  type="number"
                  name="stockQty"
                  value={formData.stockQty}
                  onChange={handleInputChange}
                  className="w-full pl-3 pr-3 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Min Alert Limit *</label>
                <input
                  type="number"
                  name="minStock"
                  value={formData.minStock}
                  onChange={handleInputChange}
                  className="w-full pl-3 pr-3 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Status *</label>
                <div className="relative">
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full pl-3 pr-10 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 appearance-none cursor-pointer focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    required
                  >
                    <option value="Active" className="bg-[#070b14]">Active</option>
                    <option value="Inactive" className="bg-[#070b14]">Inactive</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Image and Description */}
          <div className="space-y-4 flex flex-col">
            {/* Description */}
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-semibold text-slate-400">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full pl-3 pr-3 py-2.5 bg-[#070b14] border border-slate-800/85 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 flex-1 min-h-[5.5rem] resize-none"
              />
            </div>

            {/* Cloudinary Image Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Product Image</label>
              <div className="relative border-2 border-dashed border-slate-800 rounded-xl hover:border-indigo-500/50 transition-colors p-4 flex flex-col items-center justify-center min-h-[9rem] bg-slate-950/20">
                {imagePreview ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden group">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium px-3 py-1.5 rounded-lg border border-slate-700 text-xs transition-all active:scale-98">
                        Replace Image
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-2 py-4">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-full text-indigo-400">
                      <Upload size={20} />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-slate-300">Click to upload product image</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Supports PNG, JPG, WEBP (Max 5MB)</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-6">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles size={12} className="text-indigo-400" />
            <span>Updates save directly to the Firestore collection</span>
          </div>

          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => navigate('/products')}
              disabled={saving}
              className="bg-[#1e293b]/60 hover:bg-[#1e293b]/90 text-slate-350 border border-slate-700/50 py-2.5 px-6 rounded-lg transition-all active:scale-98 cursor-pointer font-bold text-xs"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={saving}
              className="bg-[#00a3ff] hover:bg-[#008fe0] text-white font-bold py-2.5 px-6 rounded-lg shadow-md transition-all active:scale-98 cursor-pointer text-xs flex items-center gap-2 min-w-[7rem] justify-center"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </div>
      </form>
      
      {uploadProgress && (
        <div className="text-center text-xs text-indigo-400 animate-pulse">
          {uploadProgress}
        </div>
      )}
    </div>
  );
}
