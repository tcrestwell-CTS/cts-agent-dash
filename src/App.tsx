import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalAuthProvider } from "@/contexts/PortalAuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PortalProtectedRoute } from "@/components/client/PortalProtectedRoute";
import { PortalLayout } from "@/components/client/PortalLayout";
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
import ItineraryBuilder from "./pages/ItineraryBuilder";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SharedTrip from "./pages/SharedTrip";
import CCAuthorize from "./pages/CCAuthorize";
import PaymentSuccess from "./pages/PaymentSuccess";
import QBOHealth from "./pages/QBOHealth";
import { ScrollToTop } from "./components/ScrollToTop";
import PortalLogin from "./pages/client/PortalLogin";
import PortalDashboard from "./pages/client/PortalDashboard";
import PortalTrips from "./pages/client/PortalTrips";
import PortalTripDetail from "./pages/client/PortalTripDetail";
import PortalMessages from "./pages/client/PortalMessages";
import PortalInvoices from "./pages/client/PortalInvoices";
import PortalInvoiceDetail from "./pages/client/PortalInvoiceDetail";
import PortalPayments from "./pages/client/PortalPayments";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PortalAuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              {/* Agent Dashboard Routes */}
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
              <Route path="/qbo-health" element={<ProtectedRoute><QBOHealth /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
              <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
              <Route path="/trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
              <Route path="/trips/:tripId" element={<ProtectedRoute><TripDetail /></ProtectedRoute>} />
              <Route path="/trips/:tripId/itinerary" element={<ProtectedRoute><ItineraryBuilder /></ProtectedRoute>} />
              <Route path="/supplier-docs" element={<SupplierDocs />} />
              <Route path="/shared/:token" element={<SharedTrip />} />
              <Route path="/authorize/:token" element={<CCAuthorize />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />

              {/* Client Portal Routes */}
              <Route path="/client/login" element={<PortalLogin />} />
              <Route path="/client/verify" element={<PortalLogin />} />
              <Route path="/client" element={<PortalProtectedRoute><PortalLayout /></PortalProtectedRoute>}>
                <Route index element={<PortalDashboard />} />
                <Route path="trips" element={<PortalTrips />} />
                <Route path="trips/:tripId" element={<PortalTripDetail />} />
                <Route path="payments" element={<PortalPayments />} />
                <Route path="messages" element={<PortalMessages />} />
                <Route path="invoices" element={<PortalInvoices />} />
                <Route path="invoices/:invoiceId" element={<PortalInvoiceDetail />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </PortalAuthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
