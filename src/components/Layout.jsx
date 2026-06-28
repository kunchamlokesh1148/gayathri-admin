import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
   LayoutDashboard, 
   Package, 
   ShoppingCart, 
   Users, 
   Boxes, 
   Truck, 
   BarChart3, 
   Settings, 
   Menu, 
   X, 
   ChevronLeft, 
   ChevronRight,
   Globe,
   MessageSquare,
   LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { adminProfile, logout } = useAuth();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Products', path: '/products', icon: Package },
    { name: 'Orders', path: '/orders', icon: ShoppingCart },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Inventory', path: '/inventory', icon: Boxes },
    { name: 'Delivery Staff', path: '/delivery-staff', icon: Truck },
    { name: 'Customer Issues', path: '/customer-issues', icon: MessageSquare },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Business Settings', path: '/settings', icon: Settings },
  ];

  const toggleSidebar = () => setCollapsed(!collapsed);
  const toggleMobile = () => setMobileOpen(!mobileOpen);

  const handleLogoutClick = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      await logout();
      navigate('/login');
    }
  };

  const filteredMenuItems = menuItems.filter(item => {
    if (!adminProfile) return false;
    const role = adminProfile.role;
    if (role === 'Super Admin') return true;
    if (role === 'Manager' || role === 'Staff') {
      // Allowed: Dashboard, Products, Orders, Customers, Inventory, Customer Issues, Settings
      return ['Dashboard', 'Products', 'Orders', 'Customers', 'Inventory', 'Customer Issues', 'Business Settings'].includes(item.name);
    }
    return false;
  });

  const activeItem = menuItems.find(item => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.path);
  }) || { name: 'Portal' };

  return (
    <div className="flex h-screen overflow-hidden text-slate-100 bg-slate-950">
      {/* Mobile Sidebar overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden" 
          onClick={toggleMobile}
        />
      )}

      {/* Sidebar for Desktop */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 shrink-0
          ${collapsed ? 'w-20' : 'w-64'} 
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} 
          lg:relative lg:flex lg:shrink-0`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800 bg-slate-950/40">
          <Link to="/" className="flex items-center gap-3 overflow-hidden" onClick={() => setMobileOpen(false)}>
            <div className="w-10 h-10 rounded-full overflow-hidden border border-indigo-400/35 shrink-0 flex items-center justify-center bg-indigo-950/20">
              <img 
                src="/gayatri_mata_avatar.png" 
                alt="Gayatri Mata Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            {!collapsed && (
              <span className="font-extrabold text-xs bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 leading-snug tracking-wide uppercase">
                Gayathri Cutmit<br />Management Portal
              </span>
            )}
          </Link>
          
          <button 
            onClick={toggleSidebar} 
            className="hidden p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-100 lg:block"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          
          <button 
            onClick={toggleMobile} 
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-100 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/' 
              ? location.pathname === '/' 
              : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-4 px-3.5 py-2.5 rounded-lg transition-all duration-200 group
                  ${isActive 
                    ? 'bg-[#B8860B] text-white font-semibold shadow-md shadow-[#B8860B]/10' 
                    : 'text-[#4B5563] hover:text-[#B8860B] hover:bg-[#FAF4E7]'
                  }`}
              >
                <Icon 
                  size={22} 
                  className={`min-w-[22px] transition-transform group-hover:scale-105 
                    ${isActive ? 'text-white' : 'text-[#B8860B]'}`} 
                />
                {!collapsed && <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="flex items-center justify-between h-16 px-6 border-b border-[#E6D9B8] bg-white">
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleMobile} 
              className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-semibold tracking-wide text-[#1F2937]">
              {activeItem.name}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* User Profile Card */}
            <div className="flex items-center gap-3 pl-3 border-l border-[#E6D9B8]">
              <div className="hidden text-right md:block">
                <p className="text-sm font-semibold text-[#1F2937] leading-none mb-1">{adminProfile?.name || 'Admin'}</p>
                {adminProfile?.role === 'Super Admin' ? (
                  <span className="inline-block text-[11px] font-semibold px-3.5 py-1.5 rounded-full bg-[#FDECC8] text-[#A66B00] whitespace-nowrap leading-none">
                    🟨 Super Admin
                  </span>
                ) : (
                  <span className="inline-block text-[11px] font-semibold px-3.5 py-1.5 rounded-full bg-slate-100 text-[#4B5563] border border-[#E6D9B8] whitespace-nowrap leading-none">
                    {adminProfile?.role || 'Portal Manager'}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#B8860B] font-bold text-sm text-white border border-[#A67900]/30 uppercase">
                {(adminProfile?.name || 'AD').split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <button
                onClick={handleLogoutClick}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950/40">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
