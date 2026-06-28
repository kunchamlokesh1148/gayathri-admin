import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { dbService } from '../services/db';

export default function AddProduct() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

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
      
      const imageUrl = formData.imageUrl.trim() || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=600'; // Default placeholder
      
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
      <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8 rounded-2xl border border-slate-800 space-y-6">
        <div className="border-b border-slate-800/80 pb-4">
          <h2 className="text-base font-bold text-slate-200 tracking-wider uppercase">
            REGISTER NEW WHOLESALE PRODUCT
          </h2>
        </div>

        {/* Row 1: Name & Image URL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Product Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="E.g. Maggi Masala Noodles"
              className="glass-input text-sm"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Product Image URL</label>
            <input
              type="text"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleInputChange}
              placeholder="https://example.com/image.jpg"
              className="glass-input text-sm"
            />
          </div>
        </div>

        {/* Row 2: Category & Brand */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category *</label>
            <div className="relative">
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="glass-input text-sm cursor-pointer appearance-none w-full pr-10"
                style={{ paddingLeft: '1rem' }}
                required
              >
                <option value="" className="bg-slate-900">Select Category</option>
                {categoriesList.map(cat => (
                  <option key={cat.id} value={cat.name} className="bg-slate-900">{cat.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Brand (Optional)</label>
            <div className="relative">
              <select
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                className="glass-input text-sm cursor-pointer appearance-none w-full pr-10"
                style={{ paddingLeft: '1rem' }}
              >
                <option value="" className="bg-slate-900">Select Brand</option>
                {brandsList.map(b => (
                  <option key={b.id} value={b.name} className="bg-slate-900">{b.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
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
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Purchase Cost (₹) - 1 Piece *
            </label>
            <input
              type="number"
              name="purchaseCost"
              value={formData.purchaseCost}
              onChange={handleInputChange}
              placeholder="10"
              step="0.01"
              className="glass-input text-sm"
              required
            />
            {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.purchaseCost, formData.packQuantity) && (
              <span className="text-[11px] text-indigo-600 font-bold mt-1 leading-tight">
                Total {formData.wholesaleUnit} Purchase Cost: ₹{calculatePackTotal(formData.purchaseCost, formData.packQuantity)}
              </span>
            )}
          </div>

          {/* Wholesale Price */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Wholesale Price (₹) - 1 Piece *
            </label>
            <input
              type="number"
              name="wholesalePrice"
              value={formData.wholesalePrice}
              onChange={handleInputChange}
              placeholder="13"
              step="0.01"
              className="glass-input text-sm"
              required
            />
            {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && calculatePackTotal(formData.wholesalePrice, formData.packQuantity) && (
              <span className="text-[11px] text-indigo-600 font-bold mt-1 leading-tight">
                Total {formData.wholesaleUnit} Wholesale Price: ₹{calculatePackTotal(formData.wholesalePrice, formData.packQuantity)}
              </span>
            )}
          </div>

          {/* MRP */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              MRP (₹) - 1 Piece *
            </label>
            <input
              type="number"
              name="mrp"
              value={formData.mrp}
              onChange={handleInputChange}
              placeholder="15"
              step="0.01"
              className="glass-input text-sm"
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
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Wholesale Unit *
            </label>
            <div className="relative">
              <select
                name="wholesaleUnit"
                value={formData.wholesaleUnit}
                onChange={handleInputChange}
                className="glass-input text-sm cursor-pointer appearance-none w-full pr-10"
                style={{ paddingLeft: '1rem' }}
                required
              >
                <option value="Piece" className="bg-slate-900">Piece</option>
                <option value="Pack" className="bg-slate-900">Pack</option>
                <option value="Box" className="bg-slate-900">Box</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Pack/Box Quantity */}
          {(formData.wholesaleUnit === 'Pack' || formData.wholesaleUnit === 'Box') && (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                {formData.wholesaleUnit} Quantity *
              </label>
              <input
                type="number"
                name="packQuantity"
                value={formData.packQuantity}
                onChange={handleInputChange}
                placeholder="E.g. 6"
                className="glass-input text-sm"
                required
              />
            </div>
          )}
        </div>

        {/* Row 4: Stock, Alert Limit, & Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stock Quantity *</label>
            <input
              type="number"
              name="stockQty"
              value={formData.stockQty}
              onChange={handleInputChange}
              placeholder="0"
              className="glass-input text-sm"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Min Alert Limit *</label>
            <input
              type="number"
              name="minStock"
              value={formData.minStock}
              onChange={handleInputChange}
              placeholder="10"
              className="glass-input text-sm"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status *</label>
            <div className="relative">
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="glass-input text-sm cursor-pointer appearance-none w-full pr-10"
                style={{ paddingLeft: '1rem' }}
                required
              >
                <option value="Active" className="bg-slate-900">Active</option>
                <option value="Inactive" className="bg-slate-900">Inactive</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Row 5: Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Product Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Product wholesale package details, weights, contents description..."
            className="glass-input text-sm min-h-[6.5rem] resize-none"
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-6">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles size={12} className="text-indigo-400" />
            <span>Product registry immediately updates central warehouses catalog.</span>
          </div>

          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => navigate('/products')}
              disabled={loading}
              className="glass-btn-secondary hover:cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="glass-btn-primary flex items-center gap-2 min-w-[7rem] justify-center hover:cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
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
