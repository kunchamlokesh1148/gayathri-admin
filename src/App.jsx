
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import AddProduct from './pages/AddProduct';
import EditProduct from './pages/EditProduct';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import CustomerDetails from './pages/CustomerDetails';
import Inventory from './pages/Inventory';
import DeliveryStaff from './pages/DeliveryStaff';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import CustomerIssues from './pages/CustomerIssues';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { dbService } from './services/db';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="products" element={<Products />} />
                  <Route path="products/add" element={<ProtectedRoute allowedRoles={['Super Admin', 'Manager']}><AddProduct /></ProtectedRoute>} />
                  <Route path="products/edit/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Manager']}><EditProduct /></ProtectedRoute>} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="customers/:id" element={<CustomerDetails />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="delivery-staff" element={<ProtectedRoute allowedRoles={['Super Admin']}><DeliveryStaff /></ProtectedRoute>} />
                  <Route path="customer-issues" element={<CustomerIssues />} />
                  <Route path="reports" element={<ProtectedRoute allowedRoles={['Super Admin']}><Reports /></ProtectedRoute>} />
                  <Route path="settings" element={<ProtectedRoute allowedRoles={['Super Admin', 'Manager']}><Settings /></ProtectedRoute>} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
