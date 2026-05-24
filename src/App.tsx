import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalAuthProvider } from "@/contexts/PortalAuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FeatureRoute } from "@/components/FeatureRoute";
import { BookkeeperRoute } from "@/components/BookkeeperRoute";
import { PortalProtectedRoute } from "@/components/client/PortalProtectedRoute";
import { PortalLayout } from "@/components/client/PortalLayout";
import { ScrollToTop } from "./components/ScrollToTop";

// ─── Lazy-loaded Agent Pages ──────────────────────────────────────────────────
// These are only loaded when the user navigates to that route,
// significantly reducing the initial bundle size and startup time.
const Index               = lazy(() => import("./pages/Index"));
const CRM                 = lazy(() => import("./pages/CRM"));
const ClientDetail        = lazy(() => import("./pages/ClientDetail"));
const Bookings            = lazy(() => import("./pages/Bookings"));
const BookingDetail       = lazy(() => import("./pages/BookingDetail"));
const Training            = lazy(() => import("./pages/Training"));
const TrainingLibrary     = lazy(() => import("./pages/TrainingLibrary"));
const TrainingPhaseDetail = lazy(() => import("./pages/TrainingPhaseDetail"));
const TrainingModuleDetail = lazy(() => import("./pages/TrainingModuleDetail"));
const TrainingLessonDetail = lazy(() => import("./pages/TrainingLessonDetail"));
const TrainingAdmin       = lazy(() => import("./pages/TrainingAdmin"));
const Commissions         = lazy(() => import("./pages/Commissions"));
const CommissionReport    = lazy(() => import("./pages/CommissionReport"));
const SupplierPaymentsDue = lazy(() => import("./pages/SupplierPaymentsDue"));
const Analytics           = lazy(() => import("./pages/Analytics"));
const Branding            = lazy(() => import("./pages/Branding"));
const Settings            = lazy(() => import("./pages/Settings"));
const TeamManagement      = lazy(() => import("./pages/TeamManagement"));
const Suppliers           = lazy(() => import("./pages/Suppliers"));
const SupplierDocs        = lazy(() => import("./pages/SupplierDocs"));
const Trips               = lazy(() => import("./pages/Trips"));
const TripDetail          = lazy(() => import("./pages/TripDetail"));
const ItineraryBuilder    = lazy(() => import("./pages/ItineraryBuilder"));
const Auth                = lazy(() => import("./pages/Auth"));
const NotFound            = lazy(() => import("./pages/NotFound"));
const SharedTrip          = lazy(() => import("./pages/SharedTrip"));
const GroupLanding        = lazy(() => import("./pages/GroupLanding"));
const GroupLandingBuilder = lazy(() => import("./pages/GroupLandingBuilder"));
const CCAuthorize         = lazy(() => import("./pages/CCAuthorize"));
const PaymentSuccess      = lazy(() => import("./pages/PaymentSuccess"));
const QBOHealth           = lazy(() => import("./pages/QBOHealth"));
const QboPaymentSync      = lazy(() => import("./pages/QboPaymentSync"));
const QboUnmatchedReview  = lazy(() => import("./pages/QboUnmatchedReview"));
const EmailActivity       = lazy(() => import("./pages/EmailActivity"));
const RiskCompliance      = lazy(() => import("./pages/RiskCompliance"));
const MonthlyReconciliation = lazy(() => import("./pages/MonthlyReconciliation"));
const Kandi               = lazy(() => import("./pages/Kandi"));
const Notifications       = lazy(() => import("./pages/Notifications"));
const PaymentsDue         = lazy(() => import("./pages/PaymentsDue"));
const PaymentReminders    = lazy(() => import("./pages/PaymentReminders"));
const ClientUpdateForm    = lazy(() => import("./pages/ClientUpdateForm"));
const TripPublishManager  = lazy(() => import("./pages/TripPublishManager"));
const FlightSearch        = lazy(() => import("./pages/FlightSearch"));
const FlightMonitoring    = lazy(() => import("./pages/FlightMonitoring"));
const HotelSearch         = lazy(() => import("./pages/HotelSearch"));
const CruiseSearch        = lazy(() => import("./pages/CruiseSearch"));
const TripInsurance       = lazy(() => import("./pages/TripInsurance"));
const FeaturedTrips       = lazy(() => import("./pages/FeaturedTrips"));
const LoanApplications   = lazy(() => import("./pages/LoanApplications"));
const CarRentals         = lazy(() => import("./pages/CarRentals"));
const Leads              = lazy(() => import("./pages/Leads"));
const PortalManagement   = lazy(() => import("./pages/PortalManagement"));
const AdminPortalPreview = lazy(() => import("./pages/AdminPortalPreview"));
const BusinessContacts   = lazy(() => import("./pages/BusinessContacts"));
const ReconDashboard  = lazy(() => import("./pages/ReconDashboard"));
const ReconMatches    = lazy(() => import("./pages/ReconMatches"));
const ReconExceptions = lazy(() => import("./pages/ReconExceptions"));
const ReconApprovals  = lazy(() => import("./pages/ReconApprovals"));
const ReconPayouts    = lazy(() => import("./pages/ReconPayouts"));
const ReconSettings   = lazy(() => import("./pages/ReconSettings"));
const ReconStripe     = lazy(() => import("./pages/ReconStripe"));
const Excursions         = lazy(() => import("./pages/Excursions"));
const TaskMonitor        = lazy(() => import("./pages/TaskMonitor"));
const TernImport         = lazy(() => import("./pages/TernImport"));
const Campaigns          = lazy(() => import("./pages/Campaigns"));
const CampaignEditor     = lazy(() => import("./pages/CampaignEditor"));
const CampaignAudiences  = lazy(() => import("./pages/CampaignAudiences"));
const CampaignImages     = lazy(() => import("./pages/CampaignImages"));

// ─── Lazy-loaded Client Portal Pages ─────────────────────────────────────────
const PortalLogin         = lazy(() => import("./pages/client/PortalLogin"));
const PortalDashboard     = lazy(() => import("./pages/client/PortalDashboard"));
const PortalTrips         = lazy(() => import("./pages/client/PortalTrips"));
const PortalTripDetail    = lazy(() => import("./pages/client/PortalTripDetail"));
const PortalMessages      = lazy(() => import("./pages/client/PortalMessages"));
const PortalInvoices      = lazy(() => import("./pages/client/PortalInvoices"));
const PortalInvoiceDetail = lazy(() => import("./pages/client/PortalInvoiceDetail"));
const PortalPayments      = lazy(() => import("./pages/client/PortalPayments"));

// ─── Bookkeeper Pages ────────────────────────────────────────────────────────
const BookkeeperDashboard    = lazy(() => import("./pages/bookkeeper/BookkeeperDashboard"));
const BookkeeperPL           = lazy(() => import("./pages/bookkeeper/BookkeeperPL"));
const BookkeeperBalanceSheet = lazy(() => import("./pages/bookkeeper/BookkeeperBalanceSheet"));
const BookkeeperIncome       = lazy(() => import("./pages/bookkeeper/BookkeeperIncome"));
const BookkeeperExpenses     = lazy(() => import("./pages/bookkeeper/BookkeeperExpenses"));
const BookkeeperUnattributed = lazy(() => import("./pages/bookkeeper/BookkeeperUnattributed"));
const BookkeeperBankRecon    = lazy(() => import("./pages/bookkeeper/BookkeeperBankRecon"));
const BookkeeperPayouts      = lazy(() => import("./pages/bookkeeper/BookkeeperPayouts"));
const Bookkeeper1099         = lazy(() => import("./pages/bookkeeper/Bookkeeper1099"));
const BookkeeperExport       = lazy(() => import("./pages/bookkeeper/BookkeeperExport"));
const BookkeeperQboLogs      = lazy(() => import("./pages/bookkeeper/BookkeeperQboLogs"));
const BookkeeperAuditLog     = lazy(() => import("./pages/bookkeeper/BookkeeperAuditLog"));
const BookkeeperAging        = lazy(() => import("./pages/bookkeeper/BookkeeperAging"));
const BookkeeperARAging      = lazy(() => import("./pages/bookkeeper/BookkeeperARAging"));
const BookkeeperAPAging      = lazy(() => import("./pages/bookkeeper/BookkeeperAPAging"));
const BookkeeperTrialBalance = lazy(() => import("./pages/bookkeeper/BookkeeperTrialBalance"));
const BookkeeperPacket       = lazy(() => import("./pages/bookkeeper/BookkeeperPacket"));

// ─── QueryClient Configuration ───────────────────────────────────────────────
// FIX: Previously used `new QueryClient()` with no options, meaning:
//   - staleTime = 0  → every component mount triggered a Supabase refetch
//   - refetchOnWindowFocus = true → switching tabs hammered the DB
// Now data stays fresh for 5 min and won't refetch on tab focus.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // Data is fresh for 5 minutes
      gcTime: 1000 * 60 * 10,       // Keep unused cache for 10 minutes
      retry: 1,                      // Only retry once on failure (was 3)
      refetchOnWindowFocus: false,   // Stop refetching when tab regains focus
      refetchOnReconnect: true,      // Still refresh after network loss
    },
  },
});

// ─── Loading Fallback ─────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen text-muted-foreground text-sm">
    Loading...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PortalAuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            {/* Suspense wraps all routes so lazy-loaded pages show a fallback */}
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Agent Dashboard Routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/contacts" element={<ProtectedRoute><FeatureRoute feature="clients"><CRM /></FeatureRoute></ProtectedRoute>} />
                <Route path="/contacts/:clientId" element={<ProtectedRoute><FeatureRoute feature="clients"><ClientDetail /></FeatureRoute></ProtectedRoute>} />
                <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
                <Route path="/bookings/:bookingId" element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
                <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
                <Route path="/training/library" element={<ProtectedRoute><TrainingLibrary /></ProtectedRoute>} />
                <Route path="/training/phase/:phaseId" element={<ProtectedRoute><TrainingPhaseDetail /></ProtectedRoute>} />
                <Route path="/training/module/:moduleId" element={<ProtectedRoute><TrainingModuleDetail /></ProtectedRoute>} />
                <Route path="/training/lesson/:lessonId" element={<ProtectedRoute><TrainingLessonDetail /></ProtectedRoute>} />
                <Route path="/training/admin" element={<ProtectedRoute><TrainingAdmin /></ProtectedRoute>} />
                <Route path="/commissions" element={<ProtectedRoute><FeatureRoute feature="commissions"><Commissions /></FeatureRoute></ProtectedRoute>} />
                <Route path="/commission-report" element={<ProtectedRoute><FeatureRoute feature="quotes"><CommissionReport /></FeatureRoute></ProtectedRoute>} />
                <Route path="/supplier-payments-due" element={<ProtectedRoute><FeatureRoute feature="commissions"><SupplierPaymentsDue /></FeatureRoute></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><FeatureRoute feature="analytics"><Analytics /></FeatureRoute></ProtectedRoute>} />
                <Route path="/branding" element={<ProtectedRoute><FeatureRoute feature="email_branding"><Branding /></FeatureRoute></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/qbo-health" element={<ProtectedRoute><QBOHealth /></ProtectedRoute>} />
                <Route path="/qbo-payment-sync" element={<ProtectedRoute><QboPaymentSync /></ProtectedRoute>} />
                <Route path="/qbo-unmatched-review" element={<ProtectedRoute><QboUnmatchedReview /></ProtectedRoute>} />
                <Route path="/email-activity" element={<ProtectedRoute><EmailActivity /></ProtectedRoute>} />
                <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
                <Route path="/campaigns/new" element={<ProtectedRoute><CampaignEditor /></ProtectedRoute>} />
                <Route path="/campaigns/audiences" element={<ProtectedRoute><CampaignAudiences /></ProtectedRoute>} />
                <Route path="/campaigns/images" element={<ProtectedRoute><CampaignImages /></ProtectedRoute>} />
                <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignEditor /></ProtectedRoute>} />
                <Route path="/risk-compliance" element={<ProtectedRoute><RiskCompliance /></ProtectedRoute>} />
                <Route path="/recon"            element={<ProtectedRoute><ReconDashboard /></ProtectedRoute>} />
                <Route path="/recon/matches"    element={<ProtectedRoute><ReconMatches /></ProtectedRoute>} />
                <Route path="/recon/exceptions" element={<ProtectedRoute><ReconExceptions /></ProtectedRoute>} />
                <Route path="/recon/approvals"  element={<ProtectedRoute><ReconApprovals /></ProtectedRoute>} />
                <Route path="/recon/payouts"    element={<ProtectedRoute><ReconPayouts /></ProtectedRoute>} />
                <Route path="/recon/settings"   element={<ProtectedRoute><ReconSettings /></ProtectedRoute>} />
                <Route path="/recon/stripe"     element={<ProtectedRoute><ReconStripe /></ProtectedRoute>} />
                <Route path="/reconciliation" element={<ProtectedRoute><MonthlyReconciliation /></ProtectedRoute>} />
                <Route path="/kandi" element={<ProtectedRoute><Kandi /></ProtectedRoute>} />
                <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
                <Route path="/suppliers" element={<ProtectedRoute><FeatureRoute feature="suppliers"><Suppliers /></FeatureRoute></ProtectedRoute>} />
                <Route path="/trips" element={<ProtectedRoute><FeatureRoute feature="trips"><Trips /></FeatureRoute></ProtectedRoute>} />
                <Route path="/trips/:tripId" element={<ProtectedRoute><FeatureRoute feature="trips"><TripDetail /></FeatureRoute></ProtectedRoute>} />
                <Route path="/trips/:tripId/itinerary" element={<ProtectedRoute><ItineraryBuilder /></ProtectedRoute>} />
                <Route path="/trips/:tripId/insurance" element={<ProtectedRoute><TripInsurance /></ProtectedRoute>} />
                <Route path="/trips/:tripId/landing-page" element={<ProtectedRoute><GroupLandingBuilder /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="/payments-due" element={<ProtectedRoute><PaymentsDue /></ProtectedRoute>} />
                <Route path="/payment-reminders" element={<ProtectedRoute><FeatureRoute feature="payment_reminders"><PaymentReminders /></FeatureRoute></ProtectedRoute>} />
                <Route path="/publish-manager" element={<ProtectedRoute><FeatureRoute feature="publish_manager"><TripPublishManager /></FeatureRoute></ProtectedRoute>} />
                <Route path="/flights" element={<ProtectedRoute><FeatureRoute feature="flight_search"><FlightSearch /></FeatureRoute></ProtectedRoute>} />
                <Route path="/flight-monitoring" element={<ProtectedRoute><FeatureRoute feature="flight_monitoring"><FlightMonitoring /></FeatureRoute></ProtectedRoute>} />
                <Route path="/hotels" element={<ProtectedRoute><FeatureRoute feature="hotel_search"><HotelSearch /></FeatureRoute></ProtectedRoute>} />
                <Route path="/cruises" element={<ProtectedRoute><FeatureRoute feature="cruise_search"><CruiseSearch /></FeatureRoute></ProtectedRoute>} />
                <Route path="/featured-trips" element={<ProtectedRoute><FeatureRoute feature="featured_trips"><FeaturedTrips /></FeatureRoute></ProtectedRoute>} />
                <Route path="/loan-applications" element={<ProtectedRoute><FeatureRoute feature="loan_applications"><LoanApplications /></FeatureRoute></ProtectedRoute>} />
                <Route path="/car-rentals" element={<ProtectedRoute><CarRentals /></ProtectedRoute>} />
                <Route path="/leads" element={<ProtectedRoute><FeatureRoute feature="leads"><Leads /></FeatureRoute></ProtectedRoute>} />
                <Route path="/portal-management" element={<ProtectedRoute><PortalManagement /></ProtectedRoute>} />
                <Route path="/portal-preview/:clientId" element={<ProtectedRoute><AdminPortalPreview /></ProtectedRoute>} />
                <Route path="/business-contacts" element={<ProtectedRoute><FeatureRoute feature="business_contacts"><BusinessContacts /></FeatureRoute></ProtectedRoute>} />
                <Route path="/excursions" element={<ProtectedRoute><FeatureRoute feature="excursions"><Excursions /></FeatureRoute></ProtectedRoute>} />
                <Route path="/task-monitor" element={<ProtectedRoute><TaskMonitor /></ProtectedRoute>} />
                <Route path="/import/tern" element={<ProtectedRoute><TernImport /></ProtectedRoute>} />
                <Route path="/supplier-docs" element={<SupplierDocs />} />
                <Route path="/shared/:token" element={<SharedTrip />} />
                <Route path="/group/:token" element={<GroupLanding />} />
                <Route path="/authorize/:token" element={<CCAuthorize />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/update-info/:token" element={<ClientUpdateForm />} />

                {/* Bookkeeper Routes */}
                <Route path="/bookkeeper"                element={<ProtectedRoute><BookkeeperRoute><BookkeeperDashboard /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/pl"             element={<ProtectedRoute><BookkeeperRoute><BookkeeperPL /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/balance-sheet"  element={<ProtectedRoute><BookkeeperRoute><BookkeeperBalanceSheet /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/income"         element={<ProtectedRoute><BookkeeperRoute><BookkeeperIncome /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/expenses"       element={<ProtectedRoute><BookkeeperRoute><BookkeeperExpenses /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/unattributed"   element={<ProtectedRoute><BookkeeperRoute><BookkeeperUnattributed /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/bank-recon"     element={<ProtectedRoute><BookkeeperRoute><BookkeeperBankRecon /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/payouts"        element={<ProtectedRoute><BookkeeperRoute><BookkeeperPayouts /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/1099"           element={<ProtectedRoute><BookkeeperRoute><Bookkeeper1099 /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/export"         element={<ProtectedRoute><BookkeeperRoute><BookkeeperExport /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/qbo-logs"       element={<ProtectedRoute><BookkeeperRoute><BookkeeperQboLogs /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/audit"          element={<ProtectedRoute><BookkeeperRoute><BookkeeperAuditLog /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/aging"          element={<ProtectedRoute><BookkeeperRoute><BookkeeperAging /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/ar-aging"       element={<ProtectedRoute><BookkeeperRoute><BookkeeperARAging /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/ap-aging"       element={<ProtectedRoute><BookkeeperRoute><BookkeeperAPAging /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/trial-balance"  element={<ProtectedRoute><BookkeeperRoute><BookkeeperTrialBalance /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/packet"         element={<ProtectedRoute><BookkeeperRoute><BookkeeperPacket /></BookkeeperRoute></ProtectedRoute>} />

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
