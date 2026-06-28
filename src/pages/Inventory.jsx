import { useState, useEffect } from 'react';
import { Boxes, Plus, Minus, Check, AlertTriangle, RefreshCw, Sparkles, Search } from 'lucide-react';
import { dbService } from '../services/db';
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

export default function Inventory() {
  const { adminProfile } = useAuth();
  const isStaff = adminProfile?.role === 'Staff';
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [inputStockMap, setInputStockMap] = useState({});
  const [inputAlertMap, setInputAlertMap] = useState({});

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await dbService.getProducts();
      setProducts(data);
      // Initialize input values state
      const initialMap = {};
      const initialAlertMap = {};
      data.forEach(p => {
        initialMap[p.id] = p.stock;
        initialAlertMap[p.id] = p.minStock !== undefined ? p.minStock : 10;
      });
      setInputStockMap(initialMap);
      setInputAlertMap(initialAlertMap);
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleInputChange = (productId, val) => {
    const parsed = parseInt(val);
    setInputStockMap(prev => ({ 
      ...prev, 
      [productId]: isNaN(parsed) ? '' : parsed 
    }));
  };

  const adjustStockStep = async (productId, currentVal, step) => {
    const newVal = Math.max(0, parseInt(currentVal) + step);
    setInputStockMap(prev => ({ ...prev, [productId]: newVal }));
    
    // Auto-save the increment/decrement
    await saveStock(productId, newVal);
  };

  const saveStock = async (productId, value) => {
    const finalValue = parseInt(value);
    if (isNaN(finalValue) || finalValue < 0) return;

    try {
      setUpdatingId(productId);
      
      // Update in DB (syncing both stock and stockQty)
      await dbService.updateProduct(productId, { stock: finalValue, stockQty: finalValue });
      
      // Update local products list
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: finalValue, stockQty: finalValue } : p));
    } catch (err) {
      console.error("Failed to update stock:", err);
      alert("Error updating inventory records.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAlertChange = (productId, val) => {
    const parsed = parseInt(val);
    setInputAlertMap(prev => ({ 
      ...prev, 
      [productId]: isNaN(parsed) ? '' : parsed 
    }));
  };

  const adjustAlertStep = async (productId, currentVal, step) => {
    const newVal = Math.max(0, parseInt(currentVal || 0) + step);
    setInputAlertMap(prev => ({ ...prev, [productId]: newVal }));
    await saveAlertLimit(productId, newVal);
  };

  const saveAlertLimit = async (productId, value) => {
    const finalValue = parseInt(value);
    if (isNaN(finalValue) || finalValue < 0) return;

    try {
      setUpdatingId(productId);
      
      // Update in DB
      await dbService.updateProduct(productId, { minStock: finalValue });
      
      // Update local products list
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, minStock: finalValue } : p));
    } catch (err) {
      console.error("Failed to update alert limit:", err);
      alert("Error updating alert limit records.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const name = p?.name || '';
    const sku = p?.sku || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           sku.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400">Loading stock registers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Inventory Management</h2>
          <p className="text-sm text-slate-400">Monitor warehouse levels, review critical limits, and make instant adjustments</p>
        </div>
        <button 
          onClick={fetchProducts} 
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-all flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw size={14} />
          Sync Stock
        </button>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Boxes size={22} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Stock SKU Count</p>
            <p className="text-xl font-extrabold text-slate-200 mt-0.5">{products.length}</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Low Stock Triggered</p>
            <p className="text-xl font-extrabold text-slate-200 mt-0.5">
              {products.filter(p => {
                const packs = getProductPacks(p);
                const limit = p.minStock !== undefined && p.minStock !== null ? parseInt(p.minStock) : 10;
                return packs <= limit && packs > 0;
              }).length}
            </p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Out of Stock SKU</p>
            <p className="text-xl font-extrabold text-slate-200 mt-0.5">
              {products.filter(p => getProductPacks(p) === 0).length}
            </p>
          </div>
        </div>
      </div>

      {/* Search Filter bar */}
      <div className="relative p-4 rounded-xl glass-panel max-w-md">
        <Search size={18} className="absolute left-7 top-7 text-slate-500" />
        <input
          type="text"
          placeholder="Filter SKU or item name..."
          className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
          style={{ paddingLeft: '2.5rem' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Inventory Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/40 border-b border-slate-800 text-xs font-semibold text-slate-400">
                <th className="p-4">SKU / Product Name</th>
                <th className="p-4">Category</th>
                <th className="p-4 text-center">Alert Limit</th>
                <th className="p-4 text-center">Warehouse Level</th>
                <th className="p-4 text-center">Fulfillment Status</th>
                {!isStaff && <th className="p-4 text-right">Quick Stock Edit</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-sm text-slate-350">
              {filteredProducts.map(p => {
                const packs = getProductPacks(p);
                const isOutOfStock = packs === 0;
                const minStockLimit = p.minStock !== undefined && p.minStock !== null ? parseInt(p.minStock) : 10;
                const isLowStock = packs <= minStockLimit && !isOutOfStock;
                const localInputValue = inputStockMap[p.id] !== undefined ? inputStockMap[p.id] : p.stock;
                const isUpdating = updatingId === p.id;
                
                return (
                  <tr key={p.id} className="hover:bg-slate-900/10">
                    {/* SKU & Name */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={p.imageUrl} alt={p.name} className="w-9 h-9 object-cover rounded bg-slate-950 border border-slate-850" />
                        <div>
                          <p className="font-bold text-slate-100">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">SKU: {p.sku}</p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="p-4 text-slate-400 text-xs">
                      {p.category}
                    </td>

                    {/* Alert Limit */}
                    <td className="p-4">
                      {isStaff ? (
                        <div className="text-center font-mono font-bold text-xs text-slate-400">
                          {p.minStock !== undefined ? p.minStock : 10}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Decrement */}
                          <button
                            onClick={() => adjustAlertStep(p.id, p.minStock !== undefined ? p.minStock : 10, -1)}
                            disabled={isUpdating || (p.minStock !== undefined ? p.minStock : 10) === 0}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 border border-slate-700 disabled:opacity-30 transition-all active:scale-95 cursor-pointer"
                            title="Reduce alert limit by 1"
                          >
                            <Minus size={10} />
                          </button>
                          
                          {/* Custom Input */}
                          <input
                            type="number"
                            className="w-12 text-center py-0.5 glass-input text-xs font-mono font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={inputAlertMap[p.id] !== undefined ? inputAlertMap[p.id] : (p.minStock !== undefined ? p.minStock : 10)}
                            onChange={(e) => handleAlertChange(p.id, e.target.value)}
                            onBlur={() => saveAlertLimit(p.id, inputAlertMap[p.id] !== undefined ? inputAlertMap[p.id] : (p.minStock !== undefined ? p.minStock : 10))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveAlertLimit(p.id, inputAlertMap[p.id] !== undefined ? inputAlertMap[p.id] : (p.minStock !== undefined ? p.minStock : 10));
                                e.target.blur();
                              }
                            }}
                            disabled={isUpdating}
                          />

                          {/* Increment */}
                          <button
                            onClick={() => adjustAlertStep(p.id, p.minStock !== undefined ? p.minStock : 10, 1)}
                            disabled={isUpdating}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 border border-slate-700 transition-all active:scale-95 cursor-pointer"
                            title="Increase alert limit by 1"
                          >
                            <Plus size={10} />
                          </button>

                          {/* Save confirmation indicator */}
                          {inputAlertMap[p.id] !== undefined && inputAlertMap[p.id] !== (p.minStock !== undefined ? p.minStock : 10) && (
                            <button
                              onClick={() => saveAlertLimit(p.id, inputAlertMap[p.id])}
                              disabled={isUpdating}
                              className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 transition-all active:scale-95 animate-pulse cursor-pointer"
                              title="Save custom alert limit"
                            >
                              <Check size={10} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Stock level */}
                    <td className="p-4 text-center font-bold text-xs text-slate-200">
                      {packs} {String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('pack') || String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('box') ? `Pack(s) (${p.stockQty !== undefined ? p.stockQty : (p.stock || 0)} pcs)` : 'Piece(s)'}
                    </td>

                    {/* Status Badge */}
                    <td className="p-4 text-center">
                      {isOutOfStock ? (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          Low Stock Alert
                        </span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          In Stock Healthy
                        </span>
                      )}
                    </td>

                    {/* Quick Adjustment controls */}
                    {!isStaff && (
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Decrement */}
                          <button
                            onClick={() => {
                              const unitLabel = String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase();
                              const isPackOrBox = unitLabel.includes('pack') || unitLabel.includes('box');
                              const packQty = parseInt(p?.packQuantity) || 12;
                              const stepValue = isPackOrBox ? packQty : 1;
                              const currentPieceStock = p.stockQty !== undefined ? p.stockQty : (p.stock || 0);
                              adjustStockStep(p.id, currentPieceStock, -stepValue);
                            }}
                            disabled={isUpdating || (p.stockQty !== undefined ? p.stockQty : (p.stock || 0)) < (String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('pack') || String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('box') ? (parseInt(p?.packQuantity) || 12) : 1)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 border border-slate-700 disabled:opacity-30 transition-all active:scale-95 cursor-pointer"
                            title={String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('pack') || String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('box') ? `Reduce stock by 1 pack (${parseInt(p?.packQuantity) || 12} pcs)` : "Reduce stock by 1 piece"}
                          >
                            <Minus size={12} />
                          </button>
                          
                          {/* Custom Input */}
                          <input
                            type="number"
                            className="w-14 text-center py-1 glass-input text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={localInputValue}
                            onChange={(e) => handleInputChange(p.id, e.target.value)}
                            onBlur={() => saveStock(p.id, localInputValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveStock(p.id, localInputValue);
                                e.target.blur();
                              }
                            }}
                            disabled={isUpdating}
                          />

                          {/* Increment */}
                          <button
                            onClick={() => {
                              const unitLabel = String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase();
                              const isPackOrBox = unitLabel.includes('pack') || unitLabel.includes('box');
                              const packQty = parseInt(p?.packQuantity) || 12;
                              const stepValue = isPackOrBox ? packQty : 1;
                              const currentPieceStock = p.stockQty !== undefined ? p.stockQty : (p.stock || 0);
                              adjustStockStep(p.id, currentPieceStock, stepValue);
                            }}
                            disabled={isUpdating}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 border border-slate-700 transition-all active:scale-95 cursor-pointer"
                            title={String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('pack') || String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('box') ? `Increase stock by 1 pack (${parseInt(p?.packQuantity) || 12} pcs)` : "Increase stock by 1 piece"}
                          >
                            <Plus size={12} />
                          </button>

                          {/* Save confirmation indicator */}
                          {localInputValue !== (p.stockQty !== undefined ? p.stockQty : p.stock) && (
                            <button
                              onClick={() => saveStock(p.id, localInputValue)}
                              disabled={isUpdating}
                              className="p-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white ml-1 border border-indigo-500 transition-all active:scale-95 animate-pulse cursor-pointer"
                              title="Save custom stock level"
                            >
                              <Check size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={isStaff ? 5 : 6} className="p-12 text-center text-slate-500">
                    No matching items in warehouse records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-500 justify-end">
        <Sparkles size={12} className="text-indigo-400" />
        <span>Tip: Press Enter or click away from the input box to instantly save numeric stock changes.</span>
      </div>
    </div>
  );
}
