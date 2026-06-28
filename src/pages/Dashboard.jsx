import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Users, 
  ShoppingCart, 
  IndianRupee, 
  AlertTriangle, 
  ArrowUpRight, 
  TrendingUp,
  Inbox,
  Calendar,
  X
} from 'lucide-react';
import { dbService } from '../services/db';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';

const getProductPacks = (p) => {
  const wholesaleUnit = String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase();
  const packQuantity = parseInt(p?.packQuantity) || 12;
  const stockQty = p?.stockQty !== undefined ? p.stockQty : (p?.stock || 0);
  if (wholesaleUnit.includes('pack') || wholesaleUnit.includes('box')) {
    return Math.floor(stockQty / packQuantity);
  }
  return stockQty;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Date filter state
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [p, o, c] = await Promise.all([
        dbService.getProducts(),
        dbService.getOrders(),
        dbService.getCustomers()
      ]);
      setProducts(p);
      setOrders(o);
      setCustomers(c);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);



  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Analyzing warehouse operations...</p>
      </div>
    );
  }

  // Date range helper
  const getDateRange = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (dateFilter) {
      case 'today':
        return { from: startOfToday, to: new Date(startOfToday.getTime() + 86400000) };
      case 'yesterday': {
        const yd = new Date(startOfToday.getTime() - 86400000);
        return { from: yd, to: startOfToday };
      }
      case 'last7':
        return { from: new Date(startOfToday.getTime() - 7 * 86400000), to: new Date(now.getTime() + 86400000) };
      case 'last30':
        return { from: new Date(startOfToday.getTime() - 30 * 86400000), to: new Date(now.getTime() + 86400000) };
      case 'thisMonth':
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getTime() + 86400000) };
      case 'custom':
        return {
          from: customFrom ? new Date(customFrom) : null,
          to: customTo ? new Date(new Date(customTo).getTime() + 86400000) : null
        };
      default:
        return { from: null, to: null };
    }
  };

  // Filter orders by date
  const filteredOrders = orders.filter(o => {
    const range = getDateRange();
    if (range.from || range.to) {
      const orderDate = new Date(o.createdAt);
      if (range.from && orderDate < range.from) return false;
      if (range.to && orderDate >= range.to) return false;
    }
    return true;
  });

  // Calculate stats
  const totalProducts = products.length;
  const totalCustomers = customers.length;
  const totalOrders = filteredOrders.length;
  
  // Revenue = sum of filtered orders
  const revenue = filteredOrders
    .filter(o => o.status === 'Delivered' || o.status === 'Out For Delivery' || o.status === 'in-transit' || o.status === 'Packed')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // Low stock products (not date-dependent)
  const lowStockProducts = products.filter(p => {
    const packs = getProductPacks(p);
    const limit = p.minStock !== undefined && p.minStock !== null ? parseInt(p.minStock) : 10;
    return packs <= limit && packs > 0;
  });
  const lowStockCount = lowStockProducts.length;

  // Format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  // Date filter label for charts
  const dateFilterLabel = {
    all: 'All Time', today: 'Today', yesterday: 'Yesterday',
    last7: 'Last 7 Days', last30: 'Last 30 Days', thisMonth: 'This Month', custom: 'Custom Range'
  }[dateFilter];

  // Prepare chart data: Revenue by order date
  const revenueChartData = filteredOrders
    .slice()
    .reverse()
    .slice(-7) // take last 7 filtered orders
    .map(o => ({
      name: o.id.substring(0, 6).toUpperCase(),
      amount: o.totalAmount,
      date: new Date(o.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }));

  // Prepare chart data: Stock by category
  const categoryDataMap = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + p.stock;
    return acc;
  }, {});
  
  const stockChartData = Object.keys(categoryDataMap).map(cat => ({
    name: cat,
    value: categoryDataMap[cat]
  }));

  const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

  // Empty State Check
  if (totalProducts === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center glass-panel rounded-2xl border border-slate-800 max-w-2xl mx-auto my-8">
        <div className="p-4 mb-4 rounded-full bg-slate-900 text-indigo-400 border border-slate-800">
          <Package size={48} />
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Welcome to Gayathri Cutmit Management Portal!</h2>
        <p className="text-slate-400 mb-6 max-w-md">
          Your inventory is empty. Head to the Products page to add your first product and start managing your warehouse.
        </p>
        <Link
          to="/products"
          className="glass-btn-primary flex items-center gap-2 px-6 py-3 text-base"
        >
          Go to Products
          <ArrowUpRight size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner alert for low stock */}
      {lowStockCount > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-500" size={20} />
            <div>
              <span className="font-semibold">{lowStockCount} Products are currently running low on stock!</span>
              <p className="text-xs text-amber-400/80">Action required to ensure fulfillment chains are not disrupted.</p>
            </div>
          </div>
          <Link to="/inventory" className="text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/30 transition-all">
            Review Inventory
          </Link>
        </div>
      )}

      {/* Date Filter */}
      <div className="glass-panel p-4 rounded-2xl space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-[#1F2937] mr-1">
            <Calendar size={14} className="text-[#B8860B]" />
            <span className="text-xs font-semibold">Filter by Date:</span>
          </div>
          {[
            { key: 'all', label: 'All Time' },
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'last7', label: 'Last 7 Days' },
            { key: 'last30', label: 'Last 30 Days' },
            { key: 'thisMonth', label: 'This Month' },
            { key: 'custom', label: 'Custom' }
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setDateFilter(opt.key)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer
                ${dateFilter === opt.key
                  ? 'bg-[#B8860B] border-[#B8860B] text-white'
                  : 'bg-white border-[#D6C7A6] text-[#4B5563] hover:text-[#B8860B] hover:bg-[#FAF4E7]'
                }`}
            >
              {opt.label}
            </button>
          ))}
          {dateFilter !== 'all' && (
            <button
              onClick={() => { setDateFilter('all'); setCustomFrom(''); setCustomTo(''); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
              title="Clear date filter"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Custom Date Range Inputs */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-[#E6D9B8]">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#4B5563] font-semibold">From:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="premium-input text-xs py-1 px-3 w-40"
                style={{ height: '36px' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#4B5563] font-semibold">To:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="premium-input text-xs py-1 px-3 w-40"
                style={{ height: '36px' }}
              />
            </div>
            <span className="text-xs text-[#6B7280] font-medium">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} in range
            </span>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Products */}
        <Link to="/products" className="glass-card p-6 rounded-xl flex items-center justify-between hover:no-underline">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Total Products</p>
            <h3 className="text-3xl font-black mt-1 text-[#1F2937]">{totalProducts}</h3>
            <div className="flex items-center gap-1 mt-2 text-xs text-[#B8860B] font-semibold">
              <TrendingUp size={12} />
              <span>Active catalog</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF4E7] text-[#B8860B] border border-[#E6D9B8] shadow-sm">
            <Package size={24} />
          </div>
        </Link>

        {/* Total Customers */}
        <Link to="/customers" className="glass-card p-6 rounded-xl flex items-center justify-between hover:no-underline">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Total Customers</p>
            <h3 className="text-3xl font-black mt-1 text-[#1F2937]">{totalCustomers}</h3>
            <div className="flex items-center gap-1 mt-2 text-xs text-[#B8860B] font-semibold">
              <TrendingUp size={12} />
              <span>Wholesale accounts</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF4E7] text-[#B8860B] border border-[#E6D9B8] shadow-sm">
            <Users size={24} />
          </div>
        </Link>

        {/* Total Orders */}
        <Link to="/orders" className="glass-card p-6 rounded-xl flex items-center justify-between hover:no-underline">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Total Orders</p>
            <h3 className="text-3xl font-black mt-1 text-[#1F2937]">{totalOrders}</h3>
            <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 font-semibold">
              <TrendingUp size={12} />
              <span>{dateFilterLabel}</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm">
            <ShoppingCart size={24} />
          </div>
        </Link>

        {/* Total Revenue */}
        <div className="glass-card p-6 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Revenue</p>
            <h3 className="text-3xl font-black mt-1 text-[#1F2937]">{formatCurrency(revenue)}</h3>
            <div className="flex items-center gap-1 mt-2 text-xs text-blue-600 font-semibold">
              <TrendingUp size={12} />
              <span>{dateFilterLabel}</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 shadow-sm">
            <IndianRupee size={24} />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-100">Revenue Stream</h4>
              <p className="text-xs text-slate-400">Recent gross billing trend</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg">{dateFilterLabel} &middot; Last 7</span>
          </div>
          <div className="h-72 w-full">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={val => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff', fontSize: '13px' }}
                    formatter={(val) => [formatCurrency(val), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorAmt)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Inbox size={32} className="mb-2" />
                <p className="text-xs">No transaction history</p>
              </div>
            )}
          </div>
        </div>

        {/* Stock Pie Chart */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div>
            <h4 className="font-bold text-slate-100">Category Distribution</h4>
            <p className="text-xs text-slate-400">Stock distribution by type</p>
          </div>
          <div className="h-64 flex justify-center items-center">
            {stockChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stockChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 flex flex-col items-center">
                <Inbox size={32} className="mb-2" />
                <p className="text-xs">No stock data available</p>
              </div>
            )}
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {stockChartData.slice(0, 4).map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-slate-300 truncate">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Layout: Recent Orders & Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="glass-panel p-6 rounded-2xl xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-100">Recent Orders</h4>
              <p className="text-xs text-slate-400">Latest active purchase orders</p>
            </div>
            <Link to="/orders" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              View All
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400">
                  <th className="pb-3">Order ID</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Total Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm">
                {filteredOrders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="text-slate-300 hover:bg-slate-900/20">
                    <td className="py-3.5 font-medium text-slate-200">#{order.id.substring(0, 6).toUpperCase()}</td>
                    <td className="py-3.5">{order.customerName}</td>
                    <td className="py-3.5 font-semibold text-slate-100">{formatCurrency(order.totalAmount)}</td>
                    <td className="py-3.5">
                      <span className={`badge-${order.status.toLowerCase().replace(/\s+/g, '')}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <Link to="/orders" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">No orders recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div>
            <h4 className="font-bold text-slate-100">Low Stock Warnings</h4>
            <p className="text-xs text-slate-400">Products currently below trigger threshold</p>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {lowStockProducts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-colors">
                <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded object-cover border border-slate-800 bg-slate-950" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">SKU: {p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-400">
                    {getProductPacks(p)} {String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('pack') || String(p?.wholesaleUnit || p?.unit || 'Piece').toLowerCase().includes('box') ? 'Pack(s)' : 'Piece(s)'}
                  </p>
                  <p className="text-[10px] text-slate-500">Min: {p.minStock || 10}</p>
                </div>
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 mb-3">
                  <TrendingUp size={20} />
                </div>
                <p className="text-sm font-medium text-slate-300">All Items Healthy</p>
                <p className="text-xs text-slate-500 mt-1">No products are currently under stocked.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
