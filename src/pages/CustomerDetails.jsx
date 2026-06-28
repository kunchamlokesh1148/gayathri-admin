import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Phone, MapPin, Calendar, ShoppingBag, CreditCard, BarChart4, Eye } from 'lucide-react';
import { dbService } from '../services/db';

export default function CustomerDetails() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [cData, oData] = await Promise.all([
          dbService.getCustomer(id),
          dbService.getOrders()
        ]);

        if (cData) {
          setCustomer(cData);
          // filter orders belonging to this customer
          setOrders(oData.filter(o => o.customerId === id));
        } else {
          setError("Client record not found");
        }
      } catch (err) {
        console.error("Failed to load customer details:", err);
        setError("Error fetching customer records");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400">Loading client profile...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6 max-w-xl mx-auto text-center py-12 animate-fade-in">
        <div className="p-4 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 inline-block">
          <Building2 size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-200">Error Loading Profile</h3>
        <p className="text-slate-400 text-sm">{error || 'Unknown customer ID'}</p>
        <Link to="/customers" className="glass-btn-secondary inline-block mt-4 text-xs">
          Back to Directory
        </Link>
      </div>
    );
  }

  // Calculate metrics
  const totalOrders = orders.length;
  const fulfilledOrders = orders.filter(o => o.status === 'Delivered' || o.status === 'Out For Delivery' || o.status === 'in-transit' || o.status === 'Packed');
  const totalSpent = fulfilledOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Link */}
      <div className="flex items-center gap-3">
        <Link to="/customers" className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Client Profile</h2>
          <p className="text-xs text-slate-500">Overview of company accounts, addresses, and history logs</p>
        </div>
      </div>

      {/* Main Info Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Profile Details Card */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 rounded-xl">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">{customer.companyName || customer.shopName || 'N/A'}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Contact: {customer.name || customer.ownerName || 'N/A'}</p>
              </div>
            </div>

            <hr className="border-slate-800/80" />

            {/* Contact info list */}
            <div className="space-y-3.5 text-sm">
              <div className="flex items-start gap-3 text-slate-300">
                <Mail size={16} className="text-slate-500 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500 font-semibold uppercase">Email Address</p>
                  <p className="truncate mt-0.5">{customer.email || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-slate-300">
                <Phone size={16} className="text-slate-500 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Phone Number</p>
                  <p className="mt-0.5">{customer.phone || customer.mobile || customer.mobileNumber || customer.phoneNo || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-slate-300">
                <MapPin size={16} className="text-slate-500 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Billing / Shipping Location</p>
                   <p className="mt-0.5 leading-relaxed text-xs">
                    {customer.deliveryAddress && typeof customer.deliveryAddress === 'object'
                      ? customer.deliveryAddress.fullAddress
                      : (customer.address || 'N/A')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-slate-300">
                <Calendar size={16} className="text-slate-500 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Onboard Date</p>
                  <p className="mt-0.5 font-mono text-xs">
                    {new Date(customer.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/60 text-[10px] text-slate-500">
            Account Reference ID: {customer.id}
          </div>
        </div>

        {/* Right Side: Key Metrics and History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Spend KPI block */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <ShoppingBag size={20} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Orders Placed</p>
                <p className="text-xl font-extrabold text-slate-200 mt-0.5">{totalOrders}</p>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CreditCard size={20} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Total Billing</p>
                <p className="text-xl font-extrabold text-slate-200 mt-0.5">₹{totalSpent.toFixed(2)}</p>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <BarChart4 size={20} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Average Ticket</p>
                <p className="text-xl font-extrabold text-slate-200 mt-0.5">₹{avgOrderValue.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Historical Orders list */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div>
              <h4 className="font-bold text-slate-100">Order Logs</h4>
              <p className="text-xs text-slate-400">Chronological history of sales generated by this account</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-xs font-semibold text-slate-400">
                    <th className="pb-3">Order ID</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-sm text-slate-300">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-900/10">
                      <td className="py-3 font-semibold text-slate-200">#{order.id.substring(0, 6).toUpperCase()}</td>
                      <td className="py-3 font-mono text-xs">
                        {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3">
                        <span className={`badge-${order.status.toLowerCase().replace(/\s+/g, '')}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold text-slate-200">
                        ₹{Number(order.totalAmount).toFixed(2)}
                      </td>
                      <td className="py-3 text-right">
                        <Link 
                          to="/orders" 
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          Manage
                          <Eye size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                        No orders recorded on this account.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
