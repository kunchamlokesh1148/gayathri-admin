import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingCart, 
  Check, 
  PackageCheck, 
  Truck, 
  CheckCircle2, 
  UserPlus, 
  Lock, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw,
  Phone,
  Calendar,
  X,
  Building2,
  Mail,
  MapPin,
  User,
  ExternalLink,
  Clock
} from 'lucide-react';
import { dbService } from '../services/db';
import { useAuth } from '../context/AuthContext';

export default function Orders() {
  const { adminProfile } = useAuth();
  const isStaff = adminProfile?.role === 'Staff';
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [deliveryStaffList, setDeliveryStaffList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [selectedTab, setSelectedTab] = useState('All');
  const [expandedOrder, setExpandedOrder] = useState(null);
  
  const [updatingId, setUpdatingId] = useState(null);

  // Tracks the selection in the dropdown before the admin clicks the "Assign" button
  const [tempStaffMap, setTempStaffMap] = useState({});
  // Tracks success alerts after assigning staff
  const [successMsgMap, setSuccessMsgMap] = useState({});

  const [otpInputs, setOtpInputs] = useState({});
  const [otpErrors, setOtpErrors] = useState({});

  // Date filter state
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersData, staffData, customersData] = await Promise.all([
        dbService.getOrders(),
        dbService.getDeliveryStaff(),
        dbService.getCustomers()
      ]);
      const docs = staffData;
      setOrders(ordersData);
      setDeliveryStaffList(staffData);
      setCustomersList(customersData);
    } catch (err) {
      console.error("Failed to load orders, staff, or customers:", err);
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

  const toggleExpand = (id) => {
    setExpandedOrder(expandedOrder === id ? null : id);
  };


  // Order Lifecycle Transitions
  const handleAccept = async (orderId) => {
    if (isStaff) {
      alert("Access Denied: Staff members cannot perform this action.");
      return;
    }
    try {
      setUpdatingId(orderId);
      await dbService.acceptOrder(orderId);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Accepted', stockDeducted: true } : o));
    } catch (err) {
      console.error("Failed to accept order:", err);
      alert(err.message || "Failed to accept order due to insufficient stock.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePack = async (orderId) => {
    if (isStaff) {
      alert("Access Denied: Staff members cannot perform this action.");
      return;
    }
    try {
      setUpdatingId(orderId);
      await dbService.updateOrder(orderId, { status: 'Packed' });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Packed' } : o));
    } catch (err) {
      console.error("Failed to pack order:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignStaff = async (orderId) => {
    if (isStaff) {
      alert("Access Denied: Staff members cannot perform this action.");
      return;
    }
    const order = orders.find(o => o.id === orderId);
    const staffId = tempStaffMap[orderId] || order?.deliveryStaffId || '';
    if (!staffId) {
      alert("Please select a delivery staff member first.");
      return;
    }

    // Find driver by either document ID or uid property
    const selectedStaff = deliveryStaffList.find(s => s.id === staffId || s.uid === staffId);
    if (!selectedStaff) return;

    try {
      setUpdatingId(orderId);
      
      // Update order document in Firestore with credentials and assignedAt
      await dbService.updateOrder(orderId, {
        deliveryStaffId: selectedStaff.uid || selectedStaff.id,
        deliveryStaffName: selectedStaff.name,
        assignedAt: 'SERVER_TIMESTAMP'
      });

      // Display assignment success message
      setSuccessMsgMap(prev => ({ ...prev, [orderId]: "Delivery Staff Assigned Successfully" }));
      setTimeout(() => {
        setSuccessMsgMap(prev => ({ ...prev, [orderId]: "" }));
      }, 4000);

      // Automatically refresh the order list from Firestore to sync updates
      await fetchData();
    } catch (err) {
      console.error("Failed to assign delivery staff:", err);
      alert("Failed to save assignment details: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleShip = async (orderId) => {
    if (isStaff) {
      alert("Access Denied: Staff members cannot perform this action.");
      return;
    }
    const order = orders.find(o => o.id === orderId);
    const driverId = order?.deliveryStaffId;
    if (!driverId) {
      alert("Please assign a delivery staff member first.");
      return;
    }

    const driver = deliveryStaffList.find(s => s.id === driverId || s.uid === driverId);
    if (!driver) return;

    // Generate random 6 digit delivery code
    const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      setUpdatingId(orderId);
      
      // 1. Update Order in Firestore
      await dbService.updateOrder(orderId, {
        status: 'Out For Delivery',
        deliveryStaffId: driverId,
        deliveryStaffName: driver.name,
        deliveryCode
      });

      // 2. Update staff status to "On Delivery"
      await dbService.updateDeliveryStaff(driverId, { status: 'On Delivery' });

      // Refetch both orders and staff to sync states
      await fetchData();
    } catch (err) {
      console.error("Failed to ship order:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeliver = async (orderId, driverId) => {
    if (isStaff) {
      alert("Access Denied: Staff members cannot perform this action.");
      return;
    }
    try {
      setUpdatingId(orderId);

      // 1. Update Order status to Delivered
      await dbService.updateOrder(orderId, { status: 'Delivered' });

      // 2. Update staff status back to "Available" if staff ID is linked
      if (driverId) {
        await dbService.updateDeliveryStaff(driverId, { status: 'Available' });
      }

      // Refetch orders & staff to refresh status lists
      await fetchData();
    } catch (err) {
      console.error("Failed to complete delivery:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleVerifyAndDeliver = async (order) => {
    if (isStaff) {
      alert("Access Denied: Staff members cannot perform this action.");
      return;
    }
    const entered = (otpInputs[order.id] || '').trim();
    const correct = (order.deliveryCode || '').trim();
    if (correct && entered === correct) {
      setOtpErrors(prev => ({ ...prev, [order.id]: '' }));
      await handleDeliver(order.id, order.deliveryStaffId);
      setOtpInputs(prev => ({ ...prev, [order.id]: '' }));
    } else {
      setOtpErrors(prev => ({ ...prev, [order.id]: 'Invalid Verification Code' }));
    }
  };

  const tabs = ['All', 'Pending', 'Accepted', 'Packed', 'Out For Delivery', 'Delivered'];
  
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

  const filteredOrders = orders.filter(o => {
    // Status filter
    if (selectedTab !== 'All') {
      if (selectedTab === 'Out For Delivery') {
        if (o.status !== 'Out For Delivery' && o.status !== 'in-transit') return false;
      } else {
        if (o.status !== selectedTab) return false;
      }
    }
    // Date filter
    const range = getDateRange();
    if (range.from || range.to) {
      const orderDate = new Date(o.createdAt);
      if (range.from && orderDate < range.from) return false;
      if (range.to && orderDate >= range.to) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400">Loading order dispatch center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Order Management</h2>
          <p className="text-sm text-slate-400">Fulfill incoming vendor requests and dispatch shipping tasks</p>
        </div>
        <button 
          onClick={fetchData} 
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-all flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw size={14} />
          Sync
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 overflow-x-auto gap-2 py-1">
        {tabs.map(tab => {
          const count = tab === 'All' 
            ? orders.length 
            : tab === 'Out For Delivery'
              ? orders.filter(o => o.status === 'Out For Delivery' || o.status === 'in-transit').length
              : orders.filter(o => o.status === tab).length;
          const isActive = selectedTab === tab;

          return (
            <button
              key={tab}
              onClick={() => {
                setSelectedTab(tab);
                setExpandedOrder(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap cursor-pointer
                ${isActive 
                  ? 'border-[#B8860B] text-[#B8860B] bg-[#FAF4E7]' 
                  : 'border-transparent text-[#4B5563] hover:text-[#B8860B] hover:bg-[#FAF4E7]/30'
                }`}
            >
              {tab}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
                ${isActive ? 'bg-[#B8860B] text-white' : 'bg-slate-100 text-[#6B7280] border border-[#E6D9B8]'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Date Filter */}
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
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found
          </span>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map(order => {
          const isExpanded = expandedOrder === order.id;
          const isUpdating = updatingId === order.id;
          
          const customerInfo = customersList.find(c => c.id === order.customerId);
          const custEmail = customerInfo?.email || order.customerEmail || order.email || '';
          const custPhone = customerInfo?.phone || customerInfo?.mobile || customerInfo?.mobileNumber || customerInfo?.phoneNo || order.mobileNumber || order.phone || '';
          const custAddress = customerInfo?.address || order.address || order.deliveryAddress || '';
          const custCompanyName = customerInfo?.companyName || customerInfo?.shopName || order.shopName || '';
          const custContactName = customerInfo?.name || customerInfo?.ownerName || order.customerName || '';
          
          return (
            <div 
              key={order.id} 
              className={`glass-panel border rounded-2xl overflow-hidden transition-all duration-300
                ${isExpanded ? 'border-slate-700/80 shadow-indigo-950/10 shadow-lg' : 'border-slate-800 hover:border-slate-750'}`}
            >
              {/* Header card summary */}
              <div 
                onClick={() => toggleExpand(order.id)}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-3 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl">
                    <ShoppingCart size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-slate-100 text-base">#{order.id.substring(0, 6).toUpperCase()}</span>
                      <span className={`badge-${(order.status === 'in-transit' ? 'Out For Delivery' : order.status).toLowerCase().replace(/\s+/g, '')}`}>
                        {order.status === 'in-transit' ? 'Out For Delivery' : order.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">{order.customerName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6">
                  <div className="text-left md:text-right">
                    <p className="text-xs text-slate-500 font-medium">Order Total</p>
                    <p className="text-base font-extrabold text-indigo-400">₹{Number(order.totalAmount).toFixed(2)}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-xs text-slate-500 font-medium">Date Issued</p>
                    <p className="text-xs text-slate-300 font-mono mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-slate-500">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>
              </div>

              {/* Expanded Section: Order items and actions */}
              {isExpanded && (
                <div className="px-5 pb-6 pt-2 border-t border-slate-800/80 bg-slate-900/10 space-y-6 animate-fade-in">
                  
                  {/* Order Items Table */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ordered items</p>
                    <div className="border border-[#E6D9B8] rounded-xl overflow-hidden bg-white">
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th className="p-3">Product Name</th>
                            <th className="p-3 text-center">Price</th>
                            <th className="p-3 text-center">Quantity</th>
                            <th className="p-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="p-3 font-semibold text-[#1F2937]">{item.name}</td>
                              <td className="p-3 text-center text-[#4B5563]">₹{Number(item.price).toFixed(2)}</td>
                              <td className="p-3 text-center font-bold text-[#1F2937]">{item.quantity}</td>
                              <td className="p-3 text-right font-bold text-[#1F2937]">
                                ₹{(Number(item.price) * item.quantity).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#FAF4E7]/60 text-[#5A3B00] border-t border-[#E6D9B8]">
                          {/* Subtotal */}
                          <tr>
                            <td colSpan={3} className="p-2.5 text-right font-medium text-xs text-[#5A3B00]">Subtotal:</td>
                            <td className="p-2.5 text-right font-semibold text-xs text-[#1F2937] font-mono">
                              ₹{(Number(order.subtotal) || (Number(order.totalAmount) - (Number(order.deliveryFee) || Number(order.deliveryCharge) || 0))).toFixed(2)}
                            </td>
                          </tr>
                          {/* Delivery Charge */}
                          <tr>
                            <td colSpan={3} className="p-2.5 text-right font-medium text-xs text-[#5A3B00]">Delivery Charge:</td>
                            <td className="p-2.5 text-right font-semibold text-xs text-[#1F2937] font-mono">
                              ₹{(Number(order.deliveryFee) || Number(order.deliveryCharge) || 0).toFixed(2)}
                            </td>
                          </tr>
                          {/* Grand Total */}
                          <tr className="border-t border-[#E6D9B8]">
                            <td colSpan={3} className="p-3 text-right font-bold text-sm text-[#5A3B00]">Grand Total:</td>
                            <td className="p-3 text-right font-extrabold text-sm text-[#B8860B] font-mono">
                              ₹{Number(order.totalAmount).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Customer Contact Info & Shipment Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer details card */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Customer Details</p>
                        {order.customerId && (
                          <Link 
                            to={`/customers/${order.customerId}`}
                            className="text-[10px] text-indigo-400 hover:text-indigo-350 font-bold flex items-center gap-1 hover:underline"
                          >
                            View Profile
                            <ExternalLink size={10} />
                          </Link>
                        )}
                      </div>
                      
                      <div className="space-y-2 text-xs text-slate-350">
                        {custCompanyName && (
                          <div className="flex items-center gap-2">
                            <Building2 size={13} className="text-slate-500 flex-shrink-0" />
                            <span className="font-bold text-slate-200">{custCompanyName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <User size={13} className="text-slate-500 flex-shrink-0" />
                          <span>{custContactName || 'N/A'}</span>
                        </div>
                        {custPhone && (
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="text-slate-500 flex-shrink-0" />
                            <span className="font-mono">{custPhone}</span>
                          </div>
                        )}
                        {custEmail && (
                          <div className="flex items-center gap-2">
                            <Mail size={13} className="text-slate-500 flex-shrink-0" />
                            <span className="truncate">{custEmail}</span>
                          </div>
                        )}
                        {order.deliveryAddress && typeof order.deliveryAddress === 'object' ? (
                          <div className="flex flex-col gap-1.5 text-left">
                            <div className="flex items-start gap-2">
                              <MapPin size={13} className="text-slate-500 mt-0.5 flex-shrink-0" />
                              <span className="leading-relaxed text-slate-300">{order.deliveryAddress.fullAddress}</span>
                            </div>
                            {order.deliveryAddress.latitude && order.deliveryAddress.longitude && (
                              <div className="space-y-1.5 pl-5">
                                <p className="text-[10px] text-slate-500 font-mono">
                                  GPS: {order.deliveryAddress.latitude}, {order.deliveryAddress.longitude}
                                </p>
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${order.deliveryAddress.latitude},${order.deliveryAddress.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold border border-indigo-500/20 bg-indigo-500/5 px-2 py-1 rounded-lg no-underline"
                                >
                                  📍 Open in Google Maps
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          custAddress && (
                            <div className="flex items-start gap-2">
                              <MapPin size={13} className="text-slate-500 mt-0.5 flex-shrink-0" />
                              <span className="leading-relaxed">{custAddress}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Logistics Courier / Shipment Details */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-4">
                      <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Logistics & Shipping</p>
                        <div className="mt-3 space-y-3.5">
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 font-semibold uppercase">Courier Name</p>
                            <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold">
                              <Truck size={14} className="text-indigo-400" />
                              <span>{order.deliveryStaffName || 'Not Assigned'}</span>
                            </div>
                          </div>
                          
                          {order.deliveryCode && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-500 font-semibold uppercase">Verification Code</p>
                              <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-lg text-xs font-mono font-bold tracking-widest self-start w-fit">
                                <Lock size={12} />
                                <span>{order.deliveryCode}</span>
                              </div>
                            </div>
                          )}

                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 font-semibold uppercase">Verification Status</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {order.status === 'Delivered' ? (
                                <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                                  <CheckCircle2 size={12} />
                                  Verified & Delivered
                                </span>
                              ) : order.deliveryCode ? (
                                <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                                  <Clock size={12} className="animate-spin" style={{ animationDuration: '4s' }} />
                                  Pending Verification
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Pending Dispatch
                                </span>
                              )}
                            </div>
                          </div>

                          {order.status === 'Delivered' && (order.completedTimestamp || order.deliveredAt) && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-500 font-semibold uppercase">Delivered Time</p>
                              <p className="text-xs text-slate-300 font-mono mt-0.5">
                                {new Date(order.completedTimestamp || order.deliveredAt).toLocaleString(undefined, { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </p>
                            </div>
                          )}

                          {/* Admin OTP verification form inside the logistics card */}
                          {(order.status === 'Out For Delivery' || order.status === 'in-transit') && (
                            <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                              <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">Confirm Delivery (OTP Validation)</p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  maxLength={6}
                                  placeholder="Enter OTP"
                                  value={otpInputs[order.id] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setOtpInputs(prev => ({ ...prev, [order.id]: val }));
                                    setOtpErrors(prev => ({ ...prev, [order.id]: '' }));
                                  }}
                                  className="glass-input text-xs py-1.5 px-3 w-28 tracking-widest font-mono text-center"
                                />
                                <button
                                  onClick={() => handleVerifyAndDeliver(order)}
                                  disabled={isUpdating}
                                  className="glass-btn-primary flex items-center gap-2 text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10 font-bold"
                                >
                                  <CheckCircle2 size={12} />
                                  Verify & Deliver
                                </button>
                              </div>
                              {otpErrors[order.id] && (
                                <p className="text-[10px] text-rose-400 font-semibold animate-pulse">{otpErrors[order.id]}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-slate-800/50">
                    <div className="text-xs text-slate-500 font-medium">
                      Order ID: {order.id}
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {/* Action 1: Pending -> Accept */}
                      {!isStaff && order.status === 'Pending' && (
                        <button
                          onClick={() => handleAccept(order.id)}
                          disabled={isUpdating}
                          className="glass-btn-primary flex items-center gap-2 text-xs py-2"
                        >
                          <Check size={14} />
                          Accept Order
                        </button>
                      )}

                      {/* Action 2: Accepted -> Pack & Assign Driver */}
                      {!isStaff && order.status === 'Accepted' && (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                             {/* Driver Dropdown */}
                             <div className="flex flex-col gap-1">
                               <span className="text-[10px] text-indigo-400 font-mono font-semibold">
                                 Delivery Staff Loaded: {deliveryStaffList.length}
                               </span>
                               {deliveryStaffList.length === 0 && (
                                 <p className="text-xs text-rose-400 font-semibold mb-1">No delivery staff found in Firestore</p>
                               )}
                               <div className="relative">
                                 <UserPlus size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                                 <select
                                   className="glass-input text-xs py-2 pl-8 pr-8 appearance-none cursor-pointer min-w-[12rem]" style={{ paddingLeft: '2rem' }}
                                   value={tempStaffMap[order.id] !== undefined ? tempStaffMap[order.id] : (order.deliveryStaffId || '')}
                                   onChange={(e) => setTempStaffMap(prev => ({ ...prev, [order.id]: e.target.value }))}
                                   disabled={isUpdating}
                                 >
                                   {deliveryStaffList.length === 0 ? (
                                     <option value="">No delivery staff found in Firestore</option>
                                   ) : (
                                     <>
                                       <option value="">Select Delivery Staff...</option>
                                       {deliveryStaffList.map(staff => (
                                         <option key={staff.uid || staff.id} value={staff.uid}>
                                           {staff.name} - {staff.email}
                                         </option>
                                       ))}
                                     </>
                                   )}
                                 </select>
                               </div>
                             </div>

                            <button
                              type="button"
                              onClick={() => handleAssignStaff(order.id)}
                              disabled={isUpdating || !(tempStaffMap[order.id] || order.deliveryStaffId)}
                              className="glass-btn-secondary text-xs py-2 bg-slate-800 hover:bg-slate-700 font-semibold"
                            >
                              Assign
                            </button>

                            <button
                              onClick={() => handlePack(order.id)}
                              disabled={isUpdating}
                              className="glass-btn-primary flex items-center gap-2 text-xs py-2 bg-purple-600 hover:bg-purple-500 shadow-purple-600/10"
                            >
                              <PackageCheck size={14} />
                              Pack Order
                            </button>
                          </div>
                          {successMsgMap[order.id] && (
                            <p className="text-xs text-emerald-400 font-semibold animate-pulse">{successMsgMap[order.id]}</p>
                          )}
                        </div>
                      )}

                      {/* Action 3: Packed -> Select driver & Mark Out For Delivery */}
                      {!isStaff && order.status === 'Packed' && (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                             {/* Driver Dropdown */}
                             <div className="flex flex-col gap-1">
                               <span className="text-[10px] text-indigo-400 font-mono font-semibold">
                                 Delivery Staff Loaded: {deliveryStaffList.length}
                               </span>
                               {deliveryStaffList.length === 0 && (
                                 <p className="text-xs text-rose-400 font-semibold mb-1">No delivery staff found in Firestore</p>
                               )}
                               <div className="relative">
                                 <UserPlus size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                                 <select
                                   className="glass-input text-xs py-2 pl-8 pr-8 appearance-none cursor-pointer min-w-[12rem]" style={{ paddingLeft: '2rem' }}
                                   value={tempStaffMap[order.id] !== undefined ? tempStaffMap[order.id] : (order.deliveryStaffId || '')}
                                   onChange={(e) => setTempStaffMap(prev => ({ ...prev, [order.id]: e.target.value }))}
                                   disabled={isUpdating}
                                 >
                                   {deliveryStaffList.length === 0 ? (
                                     <option value="">No delivery staff found in Firestore</option>
                                   ) : (
                                     <>
                                       <option value="">Select Delivery Staff...</option>
                                       {deliveryStaffList.map(staff => (
                                         <option key={staff.uid || staff.id} value={staff.uid}>
                                           {staff.name} - {staff.email}
                                         </option>
                                       ))}
                                     </>
                                   )}
                                 </select>
                               </div>
                             </div>

                            <button
                              type="button"
                              onClick={() => handleAssignStaff(order.id)}
                              disabled={isUpdating || !(tempStaffMap[order.id] || order.deliveryStaffId)}
                              className="glass-btn-secondary text-xs py-2 bg-slate-800 hover:bg-slate-700 font-semibold"
                            >
                              Assign
                            </button>

                            <button
                              onClick={() => handleShip(order.id)}
                              disabled={isUpdating || !order.deliveryStaffId}
                              className="glass-btn-primary flex items-center gap-2 text-xs py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Truck size={14} />
                              Dispatch Out For Delivery
                            </button>
                          </div>
                          {successMsgMap[order.id] && (
                            <p className="text-xs text-emerald-400 font-semibold animate-pulse">{successMsgMap[order.id]}</p>
                          )}
                        </div>
                      )}



                      {/* Final: Delivered (No action) */}
                      {order.status === 'Delivered' && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                          <CheckCircle2 size={14} />
                          Fulfillment Completed
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center glass-panel rounded-2xl">
            <ShoppingCart size={40} className="text-slate-700 mb-3 animate-bounce" style={{ animationDuration: '4s' }} />
            <h3 className="text-lg font-semibold text-slate-300">No {selectedTab.toLowerCase()} orders found</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">There are no orders with this status recorded in the database.</p>
          </div>
        )}
      </div>
    </div>
  );
}
