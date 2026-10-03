import { lazy, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { ThemeProvider } from "next-themes";
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
import { AdminRoute } from "@/components/AdminRoute";
import { BackOfficeRoute } from "@/components/BackOfficeRoute";
import { PortalProtectedRoute } from "@/components/client/PortalProtectedRoute";
import { PortalLayout } from "@/components/client/PortalLayout";
import { ScrollToTop } from "./components/ScrollToTop";
import { AgentChatWidget } from "@/components/chat/AgentChatWidget";

// ─── Lazy-loaded Agent Pages ──────────────────────────────────────────────────
// These are only loaded when the user navigates to that route,
// significantly reducing the initial bundle size and startup time.
const Index               = lazyWithRetry(() => import("./pages/Index"));
const CRM                 = lazyWithRetry(() => import("./pages/CRM"));
const ClientDetail        = lazyWithRetry(() => import("./pages/ClientDetail"));
const Bookings            = lazyWithRetry(() => import("./pages/Bookings"));
const BookingDetail       = lazyWithRetry(() => import("./pages/BookingDetail"));
const Training            = lazyWithRetry(() => import("./pages/Training"));
const UserGuide           = lazyWithRetry(() => import("./pages/UserGuide"));
const TrainingLibrary     = lazyWithRetry(() => import("./pages/TrainingLibrary"));
const TrainingPhaseDetail = lazyWithRetry(() => import("./pages/TrainingPhaseDetail"));
const TrainingModuleDetail = lazyWithRetry(() => import("./pages/TrainingModuleDetail"));
const TrainingLessonDetail = lazyWithRetry(() => import("./pages/TrainingLessonDetail"));
const TrainingAdmin       = lazyWithRetry(() => import("./pages/TrainingAdmin"));
const AcademyDashboard    = lazyWithRetry(() => import("./pages/academy/AcademyDashboard"));
const AcademyCurriculum   = lazyWithRetry(() => import("./pages/academy/AcademyCurriculum"));
const AcademyLibrary      = lazyWithRetry(() => import("./pages/academy/AcademyLibrary"));
const AcademyCertificates = lazyWithRetry(() => import("./pages/academy/AcademyCertificates"));
const AcademyLesson       = lazyWithRetry(() => import("./pages/academy/AcademyLesson"));
const AcademyMaterials    = lazyWithRetry(() => import("./pages/academy/AcademyMaterials"));
const Commissions         = lazyWithRetry(() => import("./pages/Commissions"));
const CommissionReport    = lazyWithRetry(() => import("./pages/CommissionReport"));
const SupplierPaymentsDue = lazyWithRetry(() => import("./pages/SupplierPaymentsDue"));
const IssuedCards         = lazyWithRetry(() => import("./pages/IssuedCards"));
const Analytics           = lazyWithRetry(() => import("./pages/Analytics"));
const Branding            = lazyWithRetry(() => import("./pages/Branding"));
const Settings            = lazyWithRetry(() => import("./pages/Settings"));
const TeamManagement      = lazyWithRetry(() => import("./pages/TeamManagement"));
const Suppliers           = lazyWithRetry(() => import("./pages/Suppliers"));
const SupplierDocs        = lazyWithRetry(() => import("./pages/SupplierDocs"));
const Trips               = lazyWithRetry(() => import("./pages/Trips"));
const TripDetail          = lazyWithRetry(() => import("./pages/TripDetail"));
import TripBuilderEntry from "@/pages/TripBuilderEntry";
const Auth                = lazyWithRetry(() => import("./pages/Auth"));
const OAuthConsent        = lazyWithRetry(() => import("./pages/OAuthConsent"));
const NotFound            = lazyWithRetry(() => import("./pages/NotFound"));
const SharedTrip          = lazyWithRetry(() => import("./pages/SharedTrip"));
const GroupLanding        = lazyWithRetry(() => import("./pages/GroupLanding"));
const GroupLandingBuilder = lazyWithRetry(() => import("./pages/GroupLandingBuilder"));
const GroupReservation    = lazyWithRetry(() => import("./pages/GroupReservation"));
const GroupBooking        = lazyWithRetry(() => import("./pages/GroupBooking"));
const GroupBookingSetup   = lazyWithRetry(() => import("./pages/GroupBookingSetup"));
const CCAuthorize         = lazyWithRetry(() => import("./pages/CCAuthorize"));
const ProposalView        = lazyWithRetry(() => import("./pages/ProposalView"));
const PaymentSuccess      = lazyWithRetry(() => import("./pages/PaymentSuccess"));
const QBOHealth           = lazyWithRetry(() => import("./pages/QBOHealth"));
const QboPaymentSync      = lazyWithRetry(() => import("./pages/QboPaymentSync"));
const QboUnmatchedReview  = lazyWithRetry(() => import("./pages/QboUnmatchedReview"));
const EmailActivity       = lazyWithRetry(() => import("./pages/EmailActivity"));
const RiskCompliance      = lazyWithRetry(() => import("./pages/RiskCompliance"));
const PaymentSecurity     = lazyWithRetry(() => import("./pages/PaymentSecurity"));
const MonthlyReconciliation = lazyWithRetry(() => import("./pages/MonthlyReconciliation"));
const Kandi               = lazyWithRetry(() => import("./pages/Kandi"));
const Notifications       = lazyWithRetry(() => import("./pages/Notifications"));
const AgentOnboarding     = lazyWithRetry(() => import("./pages/AgentOnboarding"));
const Approvals           = lazyWithRetry(() => import("./pages/Approvals"));
const InboxSync           = lazyWithRetry(() => import("./pages/InboxSync"));
const PaymentsDue         = lazyWithRetry(() => import("./pages/PaymentsDue"));
const MyPayments          = lazyWithRetry(() => import("./pages/MyPayments"));
const LineInbox           = lazyWithRetry(() => import("./pages/LineInbox"));
const PaymentReminders    = lazyWithRetry(() => import("./pages/PaymentReminders"));
const ClientUpdateForm    = lazyWithRetry(() => import("./pages/ClientUpdateForm"));
const Scheduling          = lazyWithRetry(() => import("./pages/Scheduling"));
const BookMeeting         = lazyWithRetry(() => import("./pages/BookMeeting"));
const IntakeForms         = lazyWithRetry(() => import("./pages/IntakeForms"));
const PublicIntakeForm    = lazyWithRetry(() => import("./pages/PublicIntakeForm"));
const AgentStorefront     = lazyWithRetry(() => import("./pages/AgentStorefront"));

/** True when the app is served from an agent storefront subdomain (e.g. jane.crestwelltravels.com) */
const isStorefrontHost = (() => {
  const host = window.location.hostname;
  // Only real production subdomains count. Lovable preview/sandbox hosts and
  // localhost must never be treated as an agent storefront.
  if (!host.endsWith("crestwelltravels.com")) return false;
  const parts = host.split(".");
  if (parts.length < 3) return false;
  const sub = parts[0].toLowerCase();
  return !["www", "app", "compass"].includes(sub);
})();
const TripFeedback        = lazyWithRetry(() => import("./pages/TripFeedback"));
const TripPublishManager  = lazyWithRetry(() => import("./pages/TripPublishManager"));
const FlightSearch        = lazyWithRetry(() => import("./pages/FlightSearch"));
const FlightMonitoring    = lazyWithRetry(() => import("./pages/FlightMonitoring"));
const HotelSearch         = lazyWithRetry(() => import("./pages/HotelSearch"));
const RateHawkOrders      = lazyWithRetry(() => import("./pages/RateHawkOrders"));
const CruiseSearch        = lazyWithRetry(() => import("./pages/CruiseSearch"));
const TripInsurance       = lazyWithRetry(() => import("./pages/TripInsurance"));
const FeaturedTrips       = lazyWithRetry(() => import("./pages/FeaturedTrips"));
const TemplateLibrary     = lazyWithRetry(() => import("./pages/TemplateLibrary"));
const NotesChat           = lazyWithRetry(() => import("./pages/NotesChat"));
const LoanApplications   = lazyWithRetry(() => import("./pages/LoanApplications"));
const CarRentals         = lazyWithRetry(() => import("./pages/CarRentals"));
const CircleMembers      = lazyWithRetry(() => import("./pages/CircleMembers"));
const Leads              = lazyWithRetry(() => import("./pages/Leads"));
const PortalManagement   = lazyWithRetry(() => import("./pages/PortalManagement"));
const AdminPortalPreview = lazyWithRetry(() => import("./pages/AdminPortalPreview"));
const BusinessContacts   = lazyWithRetry(() => import("./pages/BusinessContacts"));
const ReconDashboard  = lazyWithRetry(() => import("./pages/ReconDashboard"));
const ReconMatches    = lazyWithRetry(() => import("./pages/ReconMatches"));
const ReconExceptions = lazyWithRetry(() => import("./pages/ReconExceptions"));
const ReconApprovals  = lazyWithRetry(() => import("./pages/ReconApprovals"));
const ReconPayouts    = lazyWithRetry(() => import("./pages/ReconPayouts"));
const ReconSettings   = lazyWithRetry(() => import("./pages/ReconSettings"));
const ReconStripe     = lazyWithRetry(() => import("./pages/ReconStripe"));
const HotelbedsCoverage = lazyWithRetry(() => import("./pages/HotelbedsCoverage"));
const Excursions         = lazyWithRetry(() => import("./pages/Excursions"));
const TaskMonitor        = lazyWithRetry(() => import("./pages/TaskMonitor"));
const TernImport         = lazyWithRetry(() => import("./pages/TernImport"));
const Campaigns          = lazyWithRetry(() => import("./pages/Campaigns"));
const CampaignEditor     = lazyWithRetry(() => import("./pages/CampaignEditor"));
const CampaignAudiences  = lazyWithRetry(() => import("./pages/CampaignAudiences"));
const CampaignImages     = lazyWithRetry(() => import("./pages/CampaignImages"));
const DailyPaymentReport = lazyWithRetry(() => import("./pages/DailyPaymentReport"));
const SecurePay          = lazyWithRetry(() => import("./pages/SecurePay"));

// ─── Lazy-loaded Client Portal Pages ─────────────────────────────────────────
const PortalLogin         = lazyWithRetry(() => import("./pages/client/PortalLogin"));
const PortalDashboard     = lazyWithRetry(() => import("./pages/client/PortalDashboard"));
const PortalTrips         = lazyWithRetry(() => import("./pages/client/PortalTrips"));
const PortalTripDetail    = lazyWithRetry(() => import("./pages/client/PortalTripDetail"));
const PortalMessages      = lazyWithRetry(() => import("./pages/client/PortalMessages"));
const PortalInvoices      = lazyWithRetry(() => import("./pages/client/PortalInvoices"));
const PortalInvoiceDetail = lazyWithRetry(() => import("./pages/client/PortalInvoiceDetail"));
const PortalPayments      = lazyWithRetry(() => import("./pages/client/PortalPayments"));
const PortalDocuments     = lazyWithRetry(() => import("./pages/client/PortalDocuments"));
const PortalProfile       = lazyWithRetry(() => import("./pages/client/PortalProfile"));
const PortalExcursions    = lazyWithRetry(() => import("./pages/client/PortalExcursions"));
const PortalLiffEntry     = lazyWithRetry(() => import("./pages/client/PortalLiffEntry"));

// ─── Bookkeeper Pages ────────────────────────────────────────────────────────
const BookkeeperDashboard    = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperDashboard"));
const BookkeeperPL           = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperPL"));
const BookkeeperBalanceSheet = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperBalanceSheet"));
const BookkeeperIncome       = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperIncome"));
const AgencyOtherIncome      = lazyWithRetry(() => import("./pages/bookkeeper/AgencyOtherIncome"));
const BookkeeperExpenses     = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperExpenses"));
const BookkeeperUnattributed = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperUnattributed"));
const BookkeeperBankRecon    = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperBankRecon"));
const BookkeeperPayouts      = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperPayouts"));
const Bookkeeper1099         = lazyWithRetry(() => import("./pages/bookkeeper/Bookkeeper1099"));
const BookkeeperExport       = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperExport"));
const BookkeeperQboLogs      = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperQboLogs"));
const BookkeeperAuditLog     = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperAuditLog"));
const BookkeeperAging        = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperAging"));
const BookkeeperARAging      = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperARAging"));
const BookkeeperAPAging      = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperAPAging"));
const BookkeeperTrialBalance = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperTrialBalance"));
const BookkeeperPacket       = lazyWithRetry(() => import("./pages/bookkeeper/BookkeeperPacket"));
const BackOffice             = lazyWithRetry(() => import("./pages/BackOffice"));

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
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
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
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route
                  path="/"
                  element={isStorefrontHost ? <AgentStorefront /> : <ProtectedRoute><Index /></ProtectedRoute>}
                />
                <Route path="/storefront/:slug" element={<AgentStorefront />} />
                <Route path="/contacts" element={<ProtectedRoute><FeatureRoute feature="clients"><CRM /></FeatureRoute></ProtectedRoute>} />
                <Route path="/contacts/:clientId" element={<ProtectedRoute><FeatureRoute feature="clients"><ClientDetail /></FeatureRoute></ProtectedRoute>} />
                <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
                <Route path="/bookings/:bookingId" element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
                <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
                <Route path="/user-guide" element={<ProtectedRoute><UserGuide /></ProtectedRoute>} />
                <Route path="/training/library" element={<ProtectedRoute><TrainingLibrary /></ProtectedRoute>} />
                <Route path="/training/phase/:phaseId" element={<ProtectedRoute><TrainingPhaseDetail /></ProtectedRoute>} />
                <Route path="/training/module/:moduleId" element={<ProtectedRoute><TrainingModuleDetail /></ProtectedRoute>} />
                <Route path="/training/lesson/:lessonId" element={<ProtectedRoute><TrainingLessonDetail /></ProtectedRoute>} />
                <Route path="/training/admin" element={<ProtectedRoute><AdminRoute allowOfficeAdmin><TrainingAdmin /></AdminRoute></ProtectedRoute>} />
                <Route path="/academy" element={<ProtectedRoute><AcademyDashboard /></ProtectedRoute>} />
                <Route path="/academy/curriculum" element={<ProtectedRoute><AcademyCurriculum /></ProtectedRoute>} />
                <Route path="/academy/library" element={<ProtectedRoute><AcademyLibrary /></ProtectedRoute>} />
                <Route path="/academy/certificates" element={<ProtectedRoute><AcademyCertificates /></ProtectedRoute>} />
                <Route path="/academy/lesson/:lessonId" element={<ProtectedRoute><AcademyLesson /></ProtectedRoute>} />
                <Route path="/academy/materials" element={<ProtectedRoute><AdminRoute allowOfficeAdmin><AcademyMaterials /></AdminRoute></ProtectedRoute>} />
                <Route path="/commissions" element={<ProtectedRoute><FeatureRoute feature="commissions"><Commissions /></FeatureRoute></ProtectedRoute>} />
                <Route path="/back-office" element={<ProtectedRoute><BackOfficeRoute><BackOffice /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/commission-report" element={<ProtectedRoute><BackOfficeRoute><CommissionReport /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/supplier-payments-due" element={<ProtectedRoute><BackOfficeRoute><SupplierPaymentsDue /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/issued-cards" element={<ProtectedRoute><BackOfficeRoute><IssuedCards /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><FeatureRoute feature="analytics"><Analytics /></FeatureRoute></ProtectedRoute>} />
                <Route path="/branding" element={<ProtectedRoute><FeatureRoute feature="email_branding"><Branding /></FeatureRoute></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/qbo-health" element={<ProtectedRoute><BackOfficeRoute><QBOHealth /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/qbo-payment-sync" element={<ProtectedRoute><BackOfficeRoute><QboPaymentSync /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/qbo-unmatched-review" element={<ProtectedRoute><BackOfficeRoute><QboUnmatchedReview /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/email-activity" element={<ProtectedRoute><EmailActivity /></ProtectedRoute>} />
                <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
                <Route path="/campaigns/new" element={<ProtectedRoute><CampaignEditor /></ProtectedRoute>} />
                <Route path="/campaigns/audiences" element={<ProtectedRoute><CampaignAudiences /></ProtectedRoute>} />
                <Route path="/campaigns/images" element={<ProtectedRoute><CampaignImages /></ProtectedRoute>} />
                <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignEditor /></ProtectedRoute>} />
                <Route path="/risk-compliance" element={<ProtectedRoute><RiskCompliance /></ProtectedRoute>} />
                <Route path="/payment-security" element={<ProtectedRoute><AdminRoute allowOfficeAdmin><PaymentSecurity /></AdminRoute></ProtectedRoute>} />
                <Route path="/recon"            element={<ProtectedRoute><BackOfficeRoute><ReconDashboard /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/recon/matches"    element={<ProtectedRoute><BackOfficeRoute><ReconMatches /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/recon/exceptions" element={<ProtectedRoute><BackOfficeRoute><ReconExceptions /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/recon/approvals"  element={<ProtectedRoute><BackOfficeRoute><ReconApprovals /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/recon/payouts"    element={<ProtectedRoute><BackOfficeRoute><ReconPayouts /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/recon/settings"   element={<ProtectedRoute><BackOfficeRoute><ReconSettings /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/recon/stripe"     element={<ProtectedRoute><BackOfficeRoute><ReconStripe /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/reconciliation" element={<ProtectedRoute><BackOfficeRoute><MonthlyReconciliation /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/reports/daily-payments" element={<ProtectedRoute><BackOfficeRoute><DailyPaymentReport /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/kandi" element={<ProtectedRoute><Kandi /></ProtectedRoute>} />
                <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
                <Route path="/scheduling" element={<ProtectedRoute><Scheduling /></ProtectedRoute>} />
                <Route path="/book/:slug" element={<BookMeeting />} />
                <Route path="/forms" element={<ProtectedRoute><IntakeForms /></ProtectedRoute>} />
                <Route path="/intake/:slug" element={<PublicIntakeForm />} />
                <Route path="/trip-feedback" element={<TripFeedback />} />
                <Route path="/suppliers" element={<ProtectedRoute><FeatureRoute feature="suppliers"><Suppliers /></FeatureRoute></ProtectedRoute>} />
                <Route path="/trips" element={<ProtectedRoute><FeatureRoute feature="trips"><Trips /></FeatureRoute></ProtectedRoute>} />
                <Route path="/trips/:tripId" element={<ProtectedRoute><FeatureRoute feature="trips"><TripDetail /></FeatureRoute></ProtectedRoute>} />
                <Route path="/trip-builder" element={<ProtectedRoute><FeatureRoute feature="trips"><TripBuilderEntry /></FeatureRoute></ProtectedRoute>} />
        <Route path="/trips/:tripId/itinerary" element={<ProtectedRoute><FeatureRoute feature="trips"><TripDetail /></FeatureRoute></ProtectedRoute>} />
                <Route path="/trips/:tripId/insurance" element={<ProtectedRoute><TripInsurance /></ProtectedRoute>} />
                <Route path="/trips/:tripId/landing-page" element={<ProtectedRoute><GroupLandingBuilder /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="/onboarding" element={<ProtectedRoute><AgentOnboarding /></ProtectedRoute>} />
                <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
                <Route path="/inbox-sync" element={<ProtectedRoute><InboxSync /></ProtectedRoute>} />
                <Route path="/payments-due" element={<ProtectedRoute><BackOfficeRoute><PaymentsDue /></BackOfficeRoute></ProtectedRoute>} />
                <Route path="/my-payments" element={<ProtectedRoute><MyPayments /></ProtectedRoute>} />
                <Route path="/line-inbox" element={<ProtectedRoute><LineInbox /></ProtectedRoute>} />
                <Route path="/payment-reminders" element={<ProtectedRoute><FeatureRoute feature="payment_reminders"><PaymentReminders /></FeatureRoute></ProtectedRoute>} />
                <Route path="/publish-manager" element={<ProtectedRoute><FeatureRoute feature="publish_manager"><TripPublishManager /></FeatureRoute></ProtectedRoute>} />
                <Route path="/flights" element={<ProtectedRoute><FeatureRoute feature="flight_search"><FlightSearch /></FeatureRoute></ProtectedRoute>} />
                <Route path="/flight-monitoring" element={<ProtectedRoute><FeatureRoute feature="flight_monitoring"><FlightMonitoring /></FeatureRoute></ProtectedRoute>} />
                <Route path="/hotels" element={<ProtectedRoute><FeatureRoute feature="hotel_search"><HotelSearch /></FeatureRoute></ProtectedRoute>} />
                <Route path="/hotels/orders" element={<ProtectedRoute><FeatureRoute feature="hotel_search"><RateHawkOrders /></FeatureRoute></ProtectedRoute>} />
                <Route path="/hotelbeds-coverage" element={<ProtectedRoute><AdminRoute allowOfficeAdmin><HotelbedsCoverage /></AdminRoute></ProtectedRoute>} />
                <Route path="/cruises" element={<ProtectedRoute><FeatureRoute feature="cruise_search"><CruiseSearch /></FeatureRoute></ProtectedRoute>} />
                <Route path="/featured-trips" element={<ProtectedRoute><FeatureRoute feature="featured_trips"><FeaturedTrips /></FeatureRoute></ProtectedRoute>} />
                <Route path="/template-library" element={<ProtectedRoute><TemplateLibrary /></ProtectedRoute>} />
                <Route path="/notes-chat" element={<ProtectedRoute><NotesChat /></ProtectedRoute>} />
                <Route path="/loan-applications" element={<ProtectedRoute><FeatureRoute feature="loan_applications"><LoanApplications /></FeatureRoute></ProtectedRoute>} />
                <Route path="/car-rentals" element={<ProtectedRoute><CarRentals /></ProtectedRoute>} />
                <Route path="/circle-members" element={<ProtectedRoute><CircleMembers /></ProtectedRoute>} />
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
                <Route path="/group/:token/book" element={<GroupBooking />} />
                <Route path="/trips/:tripId/booking-setup" element={<ProtectedRoute><GroupBookingSetup /></ProtectedRoute>} />
                <Route path="/group/:token/reservation/:subTripId" element={<GroupReservation />} />
                <Route path="/authorize/:token" element={<CCAuthorize />} />
                <Route path="/proposal/:token" element={<ProposalView />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                {/* Public token-gated pay page used by branded advisor payment links */}
                <Route path="/pay" element={<SecurePay />} />
                <Route path="/payment" element={<SecurePay />} />
                <Route path="/checkout" element={<SecurePay />} />
                <Route path="/update-info/:token" element={<ClientUpdateForm />} />

                {/* Bookkeeper Routes */}
                <Route path="/bookkeeper"                element={<ProtectedRoute><BookkeeperRoute><BookkeeperDashboard /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/pl"             element={<ProtectedRoute><BookkeeperRoute><BookkeeperPL /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/balance-sheet"  element={<ProtectedRoute><BookkeeperRoute><BookkeeperBalanceSheet /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/income"         element={<ProtectedRoute><BookkeeperRoute><BookkeeperIncome /></BookkeeperRoute></ProtectedRoute>} />
                <Route path="/bookkeeper/other-income"   element={<ProtectedRoute><BookkeeperRoute><AgencyOtherIncome /></BookkeeperRoute></ProtectedRoute>} />
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
                <Route path="/client/line" element={<PortalLiffEntry />} />
                <Route path="/client" element={<PortalProtectedRoute><PortalLayout /></PortalProtectedRoute>}>
                  <Route index element={<PortalDashboard />} />
                  <Route path="trips" element={<PortalTrips />} />
                  <Route path="trips/:tripId" element={<PortalTripDetail />} />
                  <Route path="excursions" element={<PortalExcursions />} />
                  <Route path="payments" element={<PortalPayments />} />
                  <Route path="messages" element={<PortalMessages />} />
                  <Route path="invoices" element={<PortalInvoices />} />
                  <Route path="invoices/:invoiceId" element={<PortalInvoiceDetail />} />
                  <Route path="documents" element={<PortalDocuments />} />
                  <Route path="profile" element={<PortalProfile />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <AgentChatWidget />
          </BrowserRouter>
        </PortalAuthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
