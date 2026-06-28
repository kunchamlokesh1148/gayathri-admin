import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Building2, Mail, Phone, Eye } from 'lucide-react';
import { dbService } from '../services/db';

export default function Customers() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [cData, oData] = await Promise.all([
          dbService.getCustomers(),
          dbService.getOrders()
        ]);
        setCustomers(cData);
        setOrders(oData);
      } catch (err) {
        console.error("Failed to load customer list:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter logic with safe default values to prevent TypeError crashes
  const filteredCustomers = customers.filter(c => {
    const name = c?.name || '';
    const companyName = c?.companyName || '';
    const email = c?.email || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Calculate order counts and spend for customers safely
  const getCustomerMetrics = (customerId) => {
    const custOrders = orders.filter(o => o.customerId === customerId);
    const orderCount = custOrders.length;
    const totalSpent = custOrders
      .filter(o => o.status === 'Delivered' || o.status === 'Out For Delivery' || o.status === 'in-transit' || o.status === 'Packed')
      .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    return { orderCount, totalSpent };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400">Retrieving wholesale client records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Customer Directory</h2>
        <p className="text-sm text-slate-400">Manage vendor accounts, contact profiles, and customer buying metrics</p>
      </div>

      {/* Search Bar */}
      <div className="relative p-4 rounded-xl glass-panel max-w-md">
        <Search size={18} className="absolute left-7 top-7 text-slate-500" />
        <input
          type="text"
          placeholder="Search by client name, company, email..."
          className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
          style={{ paddingLeft: '2.5rem' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Customer Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/40 border-b border-slate-800 text-xs font-semibold text-slate-400">
                <th className="p-4">Company & Client</th>
                <th className="p-4">Contact Details</th>
                <th className="p-4 text-center">Orders Placed</th>
                <th className="p-4 text-right">Cumulative Spend</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-sm text-slate-300">
              {filteredCustomers.map(customer => {
                const { orderCount, totalSpent } = getCustomerMetrics(customer.id);
                return (
                  <tr key={customer.id} className="hover:bg-slate-900/10">
                    {/* Company and Client */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-100">{customer.companyName || customer.shopName || 'N/A'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{customer.name || customer.ownerName || 'N/A'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Contact details */}
                    <td className="p-4 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-350">
                        <Mail size={12} className="text-slate-500" />
                        <span>{customer.email || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-350">
                        <Phone size={12} className="text-slate-500" />
                        <span>{customer.phone || customer.mobile || customer.mobileNumber || customer.phoneNo || 'N/A'}</span>
                      </div>
                    </td>

                    {/* Order count */}
                    <td className="p-4 text-center font-bold text-slate-200">
                      {orderCount}
                    </td>

                    {/* Total spend */}
                    <td className="p-4 text-right font-extrabold text-indigo-400">
                      ₹{totalSpent.toFixed(2)}
                    </td>

                    {/* Action */}
                    <td className="p-4 text-right">
                      <Link 
                        to={`/customers/${customer.id}`}
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold border border-slate-700 transition-colors"
                      >
                        <Eye size={12} />
                        View File
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    <Users size={32} className="mx-auto mb-2 text-slate-650" />
                    No customers found matching search parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
