import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Sparkles, Upload } from 'lucide-react';
import { dbService } from '../services/db';
import { uploadImageToCloudinary } from '../services/cloudinary';

export default function AddProduct() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [categoriesList, setCategoriesList] = useState([]);
  const [brandsList, setBrandsList] = useState([]);

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

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [cats, brs] = await Promise.all([
          dbService.getCategories(),
          dbService.getBrands()
        ]);
        setCategoriesList(cats);
        setBrandsList(brs);

        setFormData(prev => ({
          ...prev,
          category: cats[0]?.name || '',
          brand: '' // brand is optional, defaults to Select Brand (empty string)
        }));
      } catch (err) {
        console.error("Failed to load categories or brands:", err);
      }
    };
    loadOptions();
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await processImageFile(e.target.files[0]);
    }
  };

  const processImageFile = async (file) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be smaller than 5MB");
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError("Only JPG, PNG, and WEBP image formats are supported");
      return;
    }
    
    setError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));

    setUploadProgress('Uploading image to Cloudinary...');
    try {
      const url = await uploadImageToCloudinary(file);
      setFormData(prev => ({ ...prev, imageUrl: url }));
      setUploadProgress('Image uploaded successfully!');
      setTimeout(() => setUploadProgress(''), 3000);
    } catch (uploadErr) {
      console.error(uploadErr);
      setError(uploadErr.message || "Cloudinary upload failed");
      setUploadProgress('');
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setFormData(prev => ({ ...prev, imageUrl: '' }));
    setError('');
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, imageUrl: url }));
    if (url.trim()) {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        setImagePreview(url);
        setError('');
      } else {
        setError('Please enter a valid image URL starting with http:// or https://');
      }
    } else {
      setImagePreview('');
    }
  };

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
      // Piece defaults to 1
      setFormData(prev => ({ ...prev, packQuantity: '1' }));
    }
    
    if (isNaN(stockQtyNum) || stockQtyNum < 0) return setError('Stock Quantity cannot be negative');
    if (isNaN(minStockNum) || minStockNum < 0) return setError('Minimum Stock threshold cannot be negative');

    try {
      setLoading(true);
      
      const imageUrl = formData.imageUrl.trim();
      
      setUploadProgress('Saving product records...');
      
      // Auto-generate a unique SKU code
      const generatedSku = 'SKU-' + Math.floor(100000 + Math.random() * 900000);

      const isPackOrBox = formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box';
      const purchasePackTotal = purchaseCostNum * (isPackOrBox ? packQuantityNum : 1);
      const wholesalePackTotal = wholesalePriceNum * (isPackOrBox ? packQuantityNum : 1);
      const mrpPackTotal = mrpNum * (isPackOrBox ? packQuantityNum : 1);

      await dbService.addProduct({
        name: formData.name.trim(),
        brand: formData.brand.trim() || '', // brand is optional
        sku: generatedSku,
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
        status: formData.status,
        imageUrl,
        image: imageUrl // duplicate for customer portal compatibility
      });

      navigate('/products');
    } catch (err) {
      console.error("Failed to add product:", err);
      setError(err.message || 'An error occurred while saving the product');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      {/* Back navigation */}
      <div className="flex items-center gap-3">
        <Link to="/products" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 transition-colors hover:cursor-pointer">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Add Wholesale Product</h2>
          <p className="text-xs text-slate-500">Insert a new item into the central warehouse inventory catalog</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={18} className="mt-0.5 min-w-[18px]" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form Box */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8 rounded-2xl space-y-6">
        <div className="border-b border-[#E6D9B8] pb-4">
          <h2 className="text-base font-bold text-[#1F2937] tracking-wider uppercase">
            REGISTER NEW WHOLESALE PRODUCT
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Product Name */}
          <div className="flex flex-col lg:col-span-2 md:col-span-2 col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Product Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="E.g. Maggi Masala Noodles"
              className="premium-input"
              required
            />
          </div>



          {/* Category */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Category *</label>
            <div className="relative">
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="premium-input pr-10 cursor-pointer appearance-none"
                required
              >
                <option value="">Select Category</option>
                {categoriesList.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Brand */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Brand (Optional)</label>
            <div className="relative">
              <select
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                className="premium-input pr-10 cursor-pointer appearance-none"
              >
                <option value="">Select Brand</option>
                {brandsList.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Wholesale Unit */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Wholesale Unit *</label>
            <div className="relative">
              <select
                name="wholesaleUnit"
                value={formData.wholesaleUnit}
                onChange={handleInputChange}
                className="premium-input pr-10 cursor-pointer appearance-none"
                required
              >
                <option value="Piece">Piece</option>
                <option value="Pack">Pack</option>
                <option value="Box">Box</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Pack/Box Quantity (Conditional) */}
          {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && (
            <div className="flex flex-col col-span-1 animate-fade-in">
              <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">{formData.wholesaleUnit} Quantity *</label>
              <input
                type="number"
                name="packQuantity"
                value={formData.packQuantity}
                onChange={handleInputChange}
                placeholder="E.g. 6"
                className="premium-input"
                required
              />
            </div>
          )}

          {/* Status Dropdown */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Status *</label>
            <div className="relative">
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="premium-input pr-10 cursor-pointer appearance-none"
                required
              >
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

          {/* Stock Quantity */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Stock Quantity *</label>
            <input
              type="number"
              name="stockQty"
              value={formData.stockQty}
              onChange={handleInputChange}
              placeholder="E.g. 100"
              className="premium-input"
              required
            />
          </div>

          {/* Min Alert Limit */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Min Alert Limit *</label>
            <input
              type="number"
              name="minStock"
              value={formData.minStock}
              onChange={handleInputChange}
              placeholder="10"
              className="premium-input"
              required
            />
          </div>

          {/* Purchase Cost */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Purchase Cost (₹) - 1 Piece *</label>
            <input
              type="number"
              name="purchaseCost"
              value={formData.purchaseCost}
              onChange={handleInputChange}
              placeholder="10"
              step="0.01"
              className="premium-input"
              required
            />
            {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.purchaseCost, formData.packQuantity) && (
              <span className="text-[11px] text-[#2563EB] font-bold mt-1.5 block leading-tight">
                Total {formData.wholesaleUnit} Cost: ₹{calculatePackTotal(formData.purchaseCost, formData.packQuantity)}
              </span>
            )}
          </div>

          {/* Wholesale Price */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Wholesale Price (₹) - 1 Piece *</label>
            <input
              type="number"
              name="wholesalePrice"
              value={formData.wholesalePrice}
              onChange={handleInputChange}
              placeholder="13"
              step="0.01"
              className="premium-input"
              required
            />
            {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.wholesalePrice, formData.packQuantity) && (
              <span className="text-[11px] text-[#2563EB] font-bold mt-1.5 block leading-tight">
                Total {formData.wholesaleUnit} Price: ₹{calculatePackTotal(formData.wholesalePrice, formData.packQuantity)}
              </span>
            )}
          </div>

          {/* MRP */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">MRP (₹) - 1 Piece *</label>
            <input
              type="number"
              name="mrp"
              value={formData.mrp}
              onChange={handleInputChange}
              placeholder="15"
              step="0.01"
              className="premium-input"
              required
            />
            {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.mrp, formData.packQuantity) && (
              <span className="text-[11px] text-[#2563EB] font-bold mt-1.5 block leading-tight">
                Total {formData.wholesaleUnit} MRP: ₹{calculatePackTotal(formData.mrp, formData.packQuantity)}
              </span>
            )}
          </div>

          {/* Product Image Section */}
          <div className="flex flex-col col-span-1 lg:col-span-3 md:col-span-2 gap-1.5 mt-2">
            <label className="text-sm font-bold text-[#1F2937] mb-1 block">Product Image</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Image Upload Drag & Drop Box */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 bg-[#FAF8F5] transition-all
                  ${dragActive ? 'border-[#C89B3C] bg-[#FFF8E6]' : 'border-[#D6C7A6] hover:border-[#C89B3C]'}
                `}
                style={{ minHeight: '200px' }}
              >
                {imagePreview ? (
                  <div className="relative w-full h-full min-h-[160px] rounded-lg overflow-hidden group flex flex-col items-center justify-center">
                    <img src={imagePreview} alt="Preview" className="max-h-[160px] object-contain rounded-lg shadow-sm" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <label className="cursor-pointer bg-[#C89B3C] hover:bg-[#B8860B] text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all active:scale-98">
                        Replace Image
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
                      </label>
                      <button 
                        type="button"
                        onClick={handleRemoveImage}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all active:scale-98"
                      >
                        Remove Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-2 text-center">
                    <div className="p-3 bg-white border border-[#D6C7A6] rounded-full text-[#B8860B] shadow-sm">
                      <Upload size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1F2937]">📁 Drag & Drop Image Here</p>
                      <p className="text-[11px] text-[#B8860B] font-semibold mt-1">OR Click to Choose Image</p>
                      <p className="text-[10px] text-slate-500 mt-1">Supported: JPG, PNG, WEBP (Max 5MB)</p>
                    </div>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
                  </label>
                )}
              </div>

              {/* Paste Image URL Column */}
              <div className="flex flex-col justify-center space-y-4 min-h-[200px] p-6 bg-white border border-[#D6C7A6] rounded-2xl">
                <div className="text-left">
                  <h4 className="text-xs font-black uppercase text-[#8A4B00] tracking-wider">OR Paste Image URL</h4>
                  <p className="text-[11px] text-slate-500 mt-1">If you already have a hosted image link, paste it directly below.</p>
                </div>
                <div className="flex flex-col">
                  <label className="text-[11px] font-bold text-[#4B5563] mb-1.5 uppercase">Image Link URL</label>
                  <input
                    type="text"
                    name="imageUrl"
                    value={formData.imageUrl}
                    onChange={handleUrlChange}
                    placeholder="https://example.com/image.jpg"
                    className="premium-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col lg:col-span-3 md:col-span-2 col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Product Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Product wholesale package details, weights, contents description..."
              className="premium-input"
              style={{ minHeight: '130px' }}
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between border-t border-[#E6D9B8] pt-6">
          <div className="text-xs text-[#6B7280] flex items-center gap-1.5 font-medium">
            <Sparkles size={12} className="text-[#B8860B]" />
            <span>Product registry immediately updates central warehouses catalog.</span>
          </div>

          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => navigate('/products')}
              disabled={loading}
              className="premium-btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="premium-btn-primary min-w-[9rem]"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Add Product</span>
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
