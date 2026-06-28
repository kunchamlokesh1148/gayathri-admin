import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Calendar, 
  X, 
  Trash2, 
  Play, 
  Check, 
  Building2, 
  AlertCircle
} from 'lucide-react';
import { db } from '../firebase/config';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function CustomerIssues() {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const { adminProfile } = useAuth();
  const isStaff = adminProfile?.role === 'Staff';
  const [updatingId, setUpdatingId] = useState(null);

  // Sync / Fetch support issues in real-time
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'issues'),
      (snap) => {
        const fetched = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            customerName: data.customerName || data.name || 'Unknown Client',
            shopName: data.shopName || data.companyName || 'Unknown Shop',
            mobileNumber: data.mobileNumber || data.mobile || data.phone || '',
            email: data.email || '',
            address: data.address || data.shippingAddress || '',
            issueType: data.issueType || data.type || data.category || 'General Issue',
            description: data.description || data.details || '',
            raisedDate: data.raisedDate || data.createdAt || new Date().toISOString(),
            status: data.status || 'Pending'
          };
        });

        // Sort by raisedDate desc in JS to avoid index requirement
        fetched.sort((a, b) => new Date(b.raisedDate) - new Date(a.raisedDate));
        setIssues(fetched);
        setLoading(false);
      },
      (error) => {
        console.error('[CustomerIssues] Firestore onSnapshot error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Update support ticket status immediately
  const handleUpdateStatus = async (issueId, newStatus) => {
    try {
      setUpdatingId(issueId);
      await updateDoc(doc(db, 'issues', issueId), { status: newStatus });

      // If the currently viewed issue modal is open, sync its state too
      if (selectedIssue && selectedIssue.id === issueId) {
        setSelectedIssue(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to update issue status:', err);
      alert('Error updating status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete ticket with confirmation
  const handleDeleteIssue = async (issueId) => {
    if (!window.confirm('Are you sure you want to permanently delete this customer issue ticket?')) {
      return;
    }

    try {
      setUpdatingId(issueId);
      await deleteDoc(doc(db, 'issues', issueId));

      if (selectedIssue && selectedIssue.id === issueId) {
        setSelectedIssue(null);
      }
    } catch (err) {
      console.error('Failed to delete issue:', err);
      alert('Error deleting issue: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Format date helper
  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  // Status Badge styling helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return <span className="badge-pending">Pending</span>;
      case 'In Progress':
        return (
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1">
            <Clock size={10} className="animate-spin" style={{ animationDuration: '4s' }} />
            In Progress
          </span>
        );
      case 'Resolved':
        return <span className="badge-delivered">Resolved</span>;
      default:
        return <span className="bg-slate-700/20 text-slate-400 border border-slate-700/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  // Filter list based on search query
  const filteredIssues = issues.filter((issue) => {
    const cust = issue.customerName.toLowerCase();
    const shop = issue.shopName.toLowerCase();
    const type = issue.issueType.toLowerCase();
    const desc = issue.description.toLowerCase();
    const queryStr = searchTerm.toLowerCase();

    return cust.includes(queryStr) || 
           shop.includes(queryStr) || 
           type.includes(queryStr) || 
           desc.includes(queryStr);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400">Loading support issues stream...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <MessageSquare className="text-indigo-400" size={26} />
            Customer Issues
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            View real-time customer support logs, update resolutions, and contact merchants directly.
          </p>
        </div>

        {/* Total counts overview */}
        <div className="flex gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Pending</p>
            <p className="text-lg font-bold text-amber-400">{issues.filter(i => i.status === 'Pending').length}</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">In Progress</p>
            <p className="text-lg font-bold text-blue-400">{issues.filter(i => i.status === 'In Progress').length}</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Resolved</p>
            <p className="text-lg font-bold text-emerald-400">{issues.filter(i => i.status === 'Resolved').length}</p>
          </div>
        </div>
      </div>

      {/* Search Header panel */}
      <div className="relative p-4 rounded-xl glass-panel max-w-md">
        <Search size={18} className="absolute left-7.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Filter by customer, shop, issue type..."
          className="premium-input pl-10 pr-4"
          style={{ paddingLeft: '2.5rem' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Main Table Layout */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-[#E6D9B8] shadow-xl">
        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th className="p-4">Customer & Store</th>
                <th className="p-4">Issue Details</th>
                <th className="p-4">Contacts</th>
                <th className="p-4">Raised Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((issue) => (
                <tr key={issue.id}>
                  {/* Customer and Store info */}
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-[#FAF4E7] border border-[#E6D9B8] text-[#B8860B] rounded-lg">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-[#1F2937] text-sm">{issue.shopName}</p>
                        <p className="text-xs text-[#6B7280] mt-0.5">{issue.customerName}</p>
                      </div>
                    </div>
                  </td>

                  {/* Issue details summary */}
                  <td className="p-4 max-w-xs">
                    <p className="font-bold text-[#1F2937] truncate">{issue.issueType}</p>
                    <p className="text-xs text-[#6B7280] mt-1 line-clamp-1">{issue.description}</p>
                  </td>

                  {/* Quick Contacts */}
                  <td className="p-4 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-[#4B5563]">
                      <Mail size={12} className="text-slate-450" />
                      <span>{issue.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#4B5563]">
                      <Phone size={12} className="text-slate-450" />
                      <span>{issue.mobileNumber}</span>
                    </div>
                  </td>

                  {/* Raised Date */}
                  <td className="p-4 text-xs text-[#4B5563]">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-slate-450" />
                      <span>{formatDate(issue.raisedDate)}</span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="p-4">
                    {renderStatusBadge(issue.status)}
                  </td>

                  {/* Operational buttons */}
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedIssue(issue)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-medium"
                      >
                        View Details
                      </button>

                      {!isStaff && issue.status === 'Pending' && (
                        <button
                          disabled={updatingId === issue.id}
                          onClick={() => handleUpdateStatus(issue.id, 'In Progress')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-blue-600/20 text-blue-300 hover:bg-blue-600/35 border border-blue-500/30 transition-colors font-medium"
                          title="Mark In Progress"
                        >
                          <Play size={12} />
                          In Progress
                        </button>
                      )}

                      {!isStaff && issue.status !== 'Resolved' && (
                        <button
                          disabled={updatingId === issue.id}
                          onClick={() => handleUpdateStatus(issue.id, 'Resolved')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/35 border border-emerald-500/30 transition-colors font-medium"
                          title="Mark Resolved"
                        >
                          <Check size={12} />
                          Resolve
                        </button>
                      )}

                      {!isStaff && (
                        <button
                          disabled={updatingId === issue.id}
                          onClick={() => handleDeleteIssue(issue.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                          title="Delete Ticket"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredIssues.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <MessageSquare size={36} className="mx-auto mb-2.5 text-slate-700" />
                    <p className="font-medium text-slate-400">No support tickets found.</p>
                    <p className="text-xs text-slate-600 mt-1">There are no records matching your query.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Details Glass Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 bg-slate-950/50 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-indigo-400" size={20} />
                <h3 className="font-bold text-lg text-slate-100">Ticket Details</h3>
              </div>
              <button
                onClick={() => setSelectedIssue(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              
              {/* Status & Raised Date Banner */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3.5 rounded-xl bg-slate-950/40 border border-slate-850">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Current Status:</span>
                  {renderStatusBadge(selectedIssue.status)}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock size={13} className="text-slate-500" />
                  <span>Raised on {formatDate(selectedIssue.raisedDate)}</span>
                </div>
              </div>

              {/* Issue Category & Details */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue Type</h4>
                <p className="text-base font-bold text-slate-100 bg-slate-950/20 px-3 py-2 rounded-lg border border-slate-850/60">
                  {selectedIssue.issueType}
                </p>
              </div>

              {/* Description Body */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Problem Description</h4>
                <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/30 p-4 rounded-xl border border-slate-850/50 whitespace-pre-wrap">
                  {selectedIssue.description || 'No description provided.'}
                </div>
              </div>

              {/* Grid: Store Info & Customer Contacts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Store Profile */}
                <div className="space-y-2.5 p-4 rounded-xl bg-slate-950/20 border border-slate-850/50">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={13} className="text-slate-450" />
                    Merchant Account
                  </h4>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-200">{selectedIssue.shopName}</p>
                    <p className="text-xs text-slate-400">{selectedIssue.customerName}</p>
                  </div>
                </div>

                {/* Contacts Profile */}
                <div className="space-y-2.5 p-4 rounded-xl bg-slate-950/20 border border-slate-850/50">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail size={13} className="text-slate-450" />
                    Contact Info
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <p className="flex items-center gap-1.5">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-medium">{selectedIssue.email || 'N/A'}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="text-slate-500">Mobile:</span>
                      <span className="font-medium">{selectedIssue.mobileNumber || 'N/A'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Physical Address */}
              <div className="space-y-2.5 p-4 rounded-xl bg-slate-950/20 border border-slate-850/50">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={13} className="text-slate-450" />
                  Store / Shipping Address
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedIssue.address || 'No physical address stored.'}
                </p>
              </div>

              {/* Contact Actions Row */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Manual Contact Actions</h4>
                <div className="flex flex-wrap gap-3">
                  {selectedIssue.mobileNumber && (
                    <a
                      href={`tel:${selectedIssue.mobileNumber}`}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/10 transition-all flex-1"
                    >
                      <Phone size={16} />
                      📞 Call Customer
                    </a>
                  )}
                  {selectedIssue.email && (
                    <a
                      href={`mailto:${selectedIssue.email}?subject=Regarding Support Request: ${encodeURIComponent(selectedIssue.issueType)}`}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm border border-slate-700 transition-all flex-1"
                    >
                      <Mail size={16} />
                      📧 Email Customer
                    </a>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Action Controls Footer */}
            <div className="flex flex-wrap items-center justify-between p-4 bg-slate-950/50 border-t border-slate-800 gap-3">
              {!isStaff && (
                <button
                  disabled={updatingId === selectedIssue.id}
                  onClick={() => handleDeleteIssue(selectedIssue.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 transition-all font-semibold"
                >
                  <Trash2 size={13} />
                  Delete Ticket
                </button>
              )}

              <div className="flex gap-2">
                {!isStaff && selectedIssue.status === 'Pending' && (
                  <button
                    disabled={updatingId === selectedIssue.id}
                    onClick={() => handleUpdateStatus(selectedIssue.id, 'In Progress')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-500 transition-all font-semibold"
                  >
                    <Play size={13} />
                    Mark In Progress
                  </button>
                )}

                {!isStaff && selectedIssue.status !== 'Resolved' && (
                  <button
                    disabled={updatingId === selectedIssue.id}
                    onClick={() => handleUpdateStatus(selectedIssue.id, 'Resolved')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-500 transition-all font-semibold"
                  >
                    <Check size={13} />
                    Mark Resolved
                  </button>
                )}

                <button
                  onClick={() => setSelectedIssue(null)}
                  className="px-4 py-2 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-slate-100 border border-slate-700 transition-all"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
