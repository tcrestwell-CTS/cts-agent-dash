import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalProvider } from "@/contexts/PortalContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PortalSubdomainRedirect } from "@/components/PortalSubdomainRedirect";
import { PortalProtectedRoute } from "@/components/portal/PortalProtectedRoute";
import Index from "./pages/Index";
import CRM from "./pages/CRM";
import ClientDetail from "./pages/ClientDetail";
import Bookings from "./pages/Bookings";
import BookingDetail from "./pages/BookingDetail";
import Training from "./pages/Training";
import Commissions from "./pages/Commissions";
import CommissionReport from "./pages/CommissionReport";
import Analytics from "./pages/Analytics";
import Branding from "./pages/Branding";
import Settings from "./pages/Settings";
import TeamManagement from "./pages/TeamManagement";
import Suppliers from "./pages/Suppliers";
import SupplierDocs from "./pages/SupplierDocs";
import Trips from "./pages/Trips";
import TripDetail from "./pages/TripDetail";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
// Portal pages
import PortalLogin from "./pages/portal/PortalLogin";
import PortalVerify from "./pages/portal/PortalVerify";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalTrips from "./pages/portal/PortalTrips";
import PortalTripDetail from "./pages/portal/PortalTripDetail";
import PortalInvoices from "./pages/portal/PortalInvoices";
import PortalMessages from "./pages/portal/PortalMessages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PortalProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PortalSubdomainRedirect>
              <Routes>
                {/* Agent dashboard routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/contacts" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
                <Route path="/contacts/:clientId" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
                <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
                <Route path="/bookings/:bookingId" element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
                <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
                <Route path="/commissions" element={<ProtectedRoute><Commissions /></ProtectedRoute>} />
                <Route path="/commission-report" element={<ProtectedRoute><CommissionReport /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/branding" element={<ProtectedRoute><Branding /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
                <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
                <Route path="/trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
                <Route path="/trips/:tripId" element={<ProtectedRoute><TripDetail /></ProtectedRoute>} />
                <Route path="/supplier-docs" element={<SupplierDocs />} />

                {/* Client portal routes */}
                <Route path="/login" element={<PortalLogin />} />
                <Route path="/verify" element={<PortalVerify />} />
                <Route path="/dashboard" element={<PortalProtectedRoute><PortalDashboard /></PortalProtectedRoute>} />
                <Route path="/trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
                <Route path="/portal/trips" element={<PortalProtectedRoute><PortalTrips /></PortalProtectedRoute>} />
                <Route path="/portal/trips/:tripId" element={<PortalProtectedRoute><PortalTripDetail /></PortalProtectedRoute>} />
                <Route path="/invoices" element={<PortalProtectedRoute><PortalInvoices /></PortalProtectedRoute>} />
                <Route path="/messages" element={<PortalProtectedRoute><PortalMessages /></PortalProtectedRoute>} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </PortalSubdomainRedirect>
          </BrowserRouter>
        </PortalProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
