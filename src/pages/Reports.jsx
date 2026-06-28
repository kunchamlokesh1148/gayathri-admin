import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { dbService } from '../services/db';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const oData = await dbService.getOrders();
        setOrders(oData);
      } catch (err) {
        console.error("Failed to load reports data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Crunching transaction records...</p>
      </div>
    );
  }

  // --- Financial Analytics ---
  const deliveredOrders = orders.filter(o => o.status === 'Delivered');
  const revenue = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  
  const inTransitOrders = orders.filter(o => o.status === 'Out For Delivery' || o.status === 'in-transit' || o.status === 'Packed');
  const transitRevenue = inTransitOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Accepted');
  const pendingRevenue = pendingOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const totalSalesVolume = orders.length;

  // --- Chart 1: Revenue Timeline (accumulated sales over time) ---
  const sortedDelivered = [...deliveredOrders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const timelineData = sortedDelivered.map((o) => {
    return {
      date: new Date(o.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      revenue: o.totalAmount,
      order: `Order #${o.id.substring(0, 4).toUpperCase()}`
    };
  });

  // --- Chart 2: Product Popularity (total quantity sold) ---
  const itemSalesMap = {};
  deliveredOrders.forEach(o => {
    o.items.forEach(item => {
      const name = item.name;
      itemSalesMap[name] = (itemSalesMap[name] || 0) + item.quantity;
    });
  });

  const bestSellersData = Object.keys(itemSalesMap)
    .map(name => ({ name, sales: itemSalesMap[name] }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5); // top 5 best sellers

  // --- Chart 3: Order Status Breakdown ---
  const statusMap = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const statusPieData = Object.keys(statusMap).map(status => ({
    name: status,
    value: statusMap[status]
  }));

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#3b82f6'];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Warehouse Reports & Analytics</h2>
        <p className="text-sm text-slate-400">Examine margins, transaction volumes, and warehouse throughput metrics</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Gross Revenue (Delivered)</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">₹{revenue.toFixed(2)}</p>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <TrendingUp size={10} className="text-emerald-400" />
            <span>Completed sales</span>
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">In Transit Pipeline</p>
          <p className="text-2xl font-extrabold text-indigo-400 mt-1">₹{transitRevenue.toFixed(2)}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            <span>{inTransitOrders.length} dispatched shipments</span>
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Pending Backlog Value</p>
          <p className="text-2xl font-extrabold text-amber-400 mt-1">₹{pendingRevenue.toFixed(2)}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            <span>{pendingOrders.length} incoming orders</span>
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Gross Order Volume</p>
          <p className="text-2xl font-extrabold text-slate-200 mt-1">{totalSalesVolume}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            <span>All status categories</span>
          </p>
        </div>
      </div>

      {/* Row 1 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Timeline */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
          <div>
            <h4 className="font-bold text-slate-100">Revenue Timeline</h4>
            <p className="text-xs text-slate-400">Chronological list of billing amounts for completed orders</p>
          </div>
          <div className="h-72 w-full">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={val => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff', fontSize: '13px' }}
                    formatter={(val, name, props) => [`₹${val.toFixed(2)}`, `${props.payload.order}`]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                No billing history to compile trend charts.
              </div>
            )}
          </div>
        </div>

        {/* Order Status Pie Chart */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div>
            <h4 className="font-bold text-slate-100">Fulfillment Pipeline Share</h4>
            <p className="text-xs text-slate-400">Order share segmented by logistics status</p>
          </div>
          <div className="h-64 flex justify-center items-center">
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
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
              <div className="text-slate-500 flex flex-col items-center justify-center">
                <p className="text-xs">No active pipeline orders.</p>
              </div>
            )}
          </div>
          {/* Status color indicators */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {statusPieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-slate-350 truncate">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="truncate">{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Row 2: Best Selling Products Bar Chart */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div>
          <h4 className="font-bold text-slate-100">Top Selling Products (Delivered Orders)</h4>
          <p className="text-xs text-slate-400">Ranking of catalog items based on aggregate wholesale volume sold</p>
        </div>
        <div className="h-72 w-full">
          {bestSellersData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bestSellersData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff', fontSize: '13px' }}
                  formatter={(val) => [`${val} Units`, 'Quantity Sold']}
                />
                <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  {bestSellersData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              No sales records to analyze popular SKUs.
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
