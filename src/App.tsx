import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalAuthProvider } from "@/contexts/PortalAuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PortalProtectedRoute } from "@/components/client/PortalProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { PortalLayout } from "@/components/client/PortalLayout";
import { ScrollToTop } from "./components/ScrollToTop";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const CRM = lazy(() => import("./pages/CRM"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Bookings = lazy(() => import("./pages/Bookings"));
const BookingDetail = lazy(() => import("./pages/BookingDetail"));
const Training = lazy(() => import("./pages/Training"));
const Commissions = lazy(() => import("./pages/Commissions"));
const CommissionReport = lazy(() => import("./pages/CommissionReport"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Branding = lazy(() => import("./pages/Branding"));
const Settings = lazy(() => import("./pages/Settings"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const SupplierDocs = lazy(() => import("./pages/SupplierDocs"));
const Trips = lazy(() => import("./pages/Trips"));
const TripDetail = lazy(() => import("./pages/TripDetail"));
const ItineraryBuilder = lazy(() => import("./pages/ItineraryBuilder"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SharedTrip = lazy(() => import("./pages/SharedTrip"));
const CCAuthorize = lazy(() => import("./pages/CCAuthorize"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const QBOHealth = lazy(() => import("./pages/QBOHealth"));
const RiskCompliance = lazy(() => import("./pages/RiskCompliance"));
const MonthlyReconciliation = lazy(() => import("./pages/MonthlyReconciliation"));
const PortalLogin = lazy(() => import("./pages/client/PortalLogin"));
const PortalDashboard = lazy(() => import("./pages/client/PortalDashboard"));
const PortalTrips = lazy(() => import("./pages/client/PortalTrips"));
const PortalTripDetail = lazy(() => import("./pages/client/PortalTripDetail"));
const PortalMessages = lazy(() => import("./pages/client/PortalMessages"));
const PortalInvoices = lazy(() => import("./pages/client/PortalInvoices"));
const PortalInvoiceDetail = lazy(() => import("./pages/client/PortalInvoiceDetail"));
const PortalPayments = lazy(() => import("./pages/client/PortalPayments"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PortalAuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse flex flex-col items-center gap-4"><div className="h-12 w-12 rounded-xl bg-primary/20" /><div className="h-4 w-32 rounded bg-muted" /></div></div>}>
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
              <Route path="/risk-compliance" element={<ProtectedRoute><RiskCompliance /></ProtectedRoute>} />
              <Route path="/reconciliation" element={<ProtectedRoute><MonthlyReconciliation /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><AdminRoute allowOfficeAdmin><TeamManagement /></AdminRoute></ProtectedRoute>} />
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
            </Suspense>
          </BrowserRouter>
        </PortalAuthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
