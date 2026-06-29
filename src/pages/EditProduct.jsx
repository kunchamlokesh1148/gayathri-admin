import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { dbService } from '../services/db';

export default function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageValid, setImageValid] = useState(false);

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
          if (data.imageUrl) {
            const img = new Image();
            img.onload = () => setImageValid(true);
            img.onerror = () => {
              setImageValid(false);
              setError('Unable to load image.');
            };
            img.src = data.imageUrl;
          }
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

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, imageUrl: url }));
    setImageValid(false);
    setError('');
    
    if (!url.trim()) {
      return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('Please enter a valid image URL.');
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      if (e.target.value === url) {
        setImageValid(true);
        setError('');
      }
    };
    img.onerror = () => {
      if (e.target.value === url) {
        setImageValid(false);
        setError('Unable to load image.');
      }
    };
    img.src = url;
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

    const imageUrl = formData.imageUrl.trim();
    if (!imageUrl) {
      return setError('Please enter a valid image URL.');
    }
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      return setError('Please enter a valid image URL.');
    }
    if (!imageValid) {
      return setError('Unable to load image.');
    }

    try {
      setSaving(true);

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
      <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8 rounded-2xl space-y-6">
        {error && formData.name && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs animate-shake">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Product Name */}
          <div className="flex flex-col lg:col-span-2 md:col-span-2 col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Product Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="premium-input"
              placeholder="Enter product name"
              required
            />
          </div>

          {/* SKU */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#4B5563] mb-1.5 block">SKU Code (System Generated)</label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              disabled
              className="premium-input uppercase"
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
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Brand *</label>
            <div className="relative">
              <select
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                className="premium-input pr-10 cursor-pointer appearance-none"
                required
              >
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
                placeholder="E.g. 12"
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

          {/* Stock (Units) */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Stock (Units) *</label>
            <input
              type="number"
              name="stockQty"
              value={formData.stockQty}
              onChange={handleInputChange}
              className="premium-input"
              placeholder="E.g. 100"
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
              className="premium-input"
              placeholder="E.g. 10"
              required
            />
          </div>

          {/* Purchase Cost */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Purchase Cost (₹) *</label>
            <input
              type="number"
              name="purchaseCost"
              value={formData.purchaseCost}
              onChange={handleInputChange}
              step="0.01"
              className="premium-input"
              placeholder="E.g. 45.00"
              required
            />
            {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.purchaseCost, formData.packQuantity) && (
              <span className="text-[11px] text-[#2563EB] font-semibold mt-1.5 block leading-tight">
                Total {formData.wholesaleUnit} Cost: ₹{calculatePackTotal(formData.purchaseCost, formData.packQuantity)}
              </span>
            )}
          </div>

          {/* Wholesale Price */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Wholesale Price (₹) *</label>
            <input
              type="number"
              name="wholesalePrice"
              value={formData.wholesalePrice}
              onChange={handleInputChange}
              step="0.01"
              className="premium-input"
              placeholder="E.g. 55.00"
              required
            />
            {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.wholesalePrice, formData.packQuantity) && (
              <span className="text-[11px] text-[#2563EB] font-semibold mt-1.5 block leading-tight">
                Total {formData.wholesaleUnit} Price: ₹{calculatePackTotal(formData.wholesalePrice, formData.packQuantity)}
              </span>
            )}
          </div>

          {/* MRP */}
          <div className="flex flex-col col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">MRP (₹) *</label>
            <input
              type="number"
              name="mrp"
              value={formData.mrp}
              onChange={handleInputChange}
              step="0.01"
              className="premium-input"
              placeholder="E.g. 60.00"
              required
            />
            {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.mrp, formData.packQuantity) && (
              <span className="text-[11px] text-[#2563EB] font-semibold mt-1.5 block leading-tight">
                Total {formData.wholesaleUnit} MRP: ₹{calculatePackTotal(formData.mrp, formData.packQuantity)}
              </span>
            )}
          </div>

          {/* Description */}
          {/* Product Image Section */}
          <div className="flex flex-col col-span-1 lg:col-span-3 md:col-span-2 gap-1.5 mt-2">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Product Image URL *</label>
            <div className="flex flex-col space-y-3">
              <input
                type="text"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleUrlChange}
                placeholder="https://example.com/product.jpg"
                className="premium-input w-full"
                required
              />
              <span className="text-xs text-slate-500">Enter a direct image URL</span>
              
              {/* Image Live Preview */}
              {formData.imageUrl && formData.imageUrl.trim() && (
                <div className="mt-3 p-4 bg-[#FAF8F5] border border-[#D6C7A6] rounded-2xl flex flex-col items-center justify-center min-h-[160px]">
                  {!imageValid ? (
                    <span className="text-xs text-red-500 font-bold">Unable to load image.</span>
                  ) : (
                    <img 
                      src={formData.imageUrl} 
                      alt="Preview" 
                      className="max-h-[160px] object-contain rounded-lg shadow-sm"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col lg:col-span-3 md:col-span-2 col-span-1">
            <label className="text-sm font-bold text-[#1F2937] mb-1.5 block">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="premium-input"
              placeholder="Enter product description details..."
              style={{ minHeight: '130px' }}
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between border-t border-[#E6D9B8] pt-6 mt-4">
          <div className="text-xs text-[#6B7280] flex items-center gap-1.5 font-medium">
            <Sparkles size={12} className="text-[#B8860B]" />
            <span>Updates save directly to the Firestore collection</span>
          </div>

          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => navigate('/products')}
              disabled={saving}
              className="premium-btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={saving}
              className="premium-btn-primary min-w-[9rem]"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Product</span>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
