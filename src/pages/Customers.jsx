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
        <h2 className="text-2xl font-bold text-[#1F2937]">Customer Directory</h2>
        <p className="text-sm text-[#4B5563]">Manage vendor accounts, contact profiles, and customer buying metrics</p>
      </div>

      {/* Search Bar */}
      <div className="relative p-4 rounded-xl glass-panel max-w-md">
        <Search size={18} className="absolute left-7.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by client name, company, email..."
          className="premium-input pl-10 pr-4"
          style={{ paddingLeft: '2.5rem' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Customer Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-[#E6D9B8]">
        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th className="p-4">Company & Client</th>
                <th className="p-4">Contact Details</th>
                <th className="p-4 text-center">Orders Placed</th>
                <th className="p-4 text-right">Cumulative Spend</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => {
                const { orderCount, totalSpent } = getCustomerMetrics(customer.id);
                return (
                  <tr key={customer.id}>
                    {/* Company and Client */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#FAF4E7] border border-[#E6D9B8] text-[#B8860B] rounded-lg">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-[#1F2937] text-sm">{customer.companyName || customer.shopName || 'N/A'}</p>
                          <p className="text-xs text-[#6B7280] mt-0.5">{customer.name || customer.ownerName || 'N/A'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Contact details */}
                    <td className="p-4 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
                        <Mail size={12} className="text-slate-400" />
                        <span>{customer.email || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
                        <Phone size={12} className="text-slate-400" />
                        <span>{customer.phone || customer.mobile || customer.mobileNumber || customer.phoneNo || 'N/A'}</span>
                      </div>
                    </td>

                    {/* Order count */}
                    <td className="p-4 text-center font-bold text-[#1F2937]">
                      {orderCount}
                    </td>

                    {/* Total spend */}
                    <td className="p-4 text-right font-extrabold text-[#B8860B]">
                      ₹{totalSpent.toFixed(2)}
                    </td>

                    {/* Action */}
                    <td className="p-4 text-right">
                      <Link 
                        to={`/customers/${customer.id}`}
                        className="premium-btn-secondary py-1.5 px-3 rounded-lg text-xs font-semibold hover:no-underline"
                        style={{ height: '36px' }}
                      >
                        <Eye size={12} className="mr-1 inline" />
                        View File
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#6B7280]">
                    <Users size={32} className="mx-auto mb-2 text-slate-400" />
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
