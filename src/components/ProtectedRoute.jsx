import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, adminProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-100 space-y-4 animate-fade-in">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Validating security credentials...</p>
      </div>
    );
  }

  if (!user || !adminProfile) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(adminProfile.role)) {
    return (
      <div className="min-h-[60vh] w-full flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl border border-slate-850 max-w-md w-full text-center space-y-6 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto text-red-500">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Access Denied</h3>
            <p className="text-xs text-slate-500 mt-2">
              You do not have permission to access this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
