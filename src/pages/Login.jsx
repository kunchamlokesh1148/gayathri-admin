import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error("Login failure details:", err);
      const code = err.code || err.message || "";
      const errorText = typeof code === 'string' ? code.toLowerCase() : "";

      if (
        errorText.includes("invalid-credential") ||
        errorText.includes("wrong-password") ||
        errorText.includes("invalid-email")
      ) {
        setError("Invalid credentials. Please check your email and password and try again.");
      } else if (errorText.includes("user-not-found")) {
        setError("No account found with the provided credentials.");
      } else if (errorText.includes("network-request-failed") || errorText.includes("network")) {
        setError("Network error. Please check your internet connection and try again.");
      } else if (errorText.includes("too-many-requests")) {
        setError("Too many failed login attempts. Please try again later.");
      } else if (errorText.includes("access denied")) {
        setError("Access denied. Your account may be inactive.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-950 px-4">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-900/15 to-transparent blur-3xl -z-10"></div>
      
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-indigo-400/10 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full overflow-hidden border border-indigo-400/35 mx-auto mb-4 bg-indigo-950/20 flex items-center justify-center">
            <img 
              src="/gayatri_mata_avatar.png" 
              alt="Gayatri Mata Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-black text-[#B8860B] uppercase tracking-wider">
            Gayathri Cutmit
          </h2>
          <p className="text-xs text-[#4B5563] mt-1 uppercase font-bold tracking-widest">
            Wholesale - Admin Portal
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-650/10 border border-red-500/25 text-red-400 text-xs font-semibold mb-6 flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-[#1F2937] uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="email"
                required
                className="premium-input pl-11 pr-4 py-3 w-full"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email address"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-[#1F2937] uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type={showPassword ? "text" : "password"}
                required
                className="premium-input pl-11 pr-11 py-3 w-full"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="premium-btn-primary w-full text-xs font-bold tracking-widest uppercase cursor-pointer flex items-center justify-center gap-2 mt-6"
            style={{ height: '44px' }}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <ShieldCheck size={16} />
                Sign In
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
