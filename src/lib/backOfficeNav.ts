import {
  LayoutDashboard,
  TrendingUp,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  DollarSign,
  Banknote,
  FileWarning,
  Wallet,
  HeartPulse,
  ArrowRightLeft,
  Landmark,
  Activity,
  Download,
  ShieldCheck,
  CreditCard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type BackOfficeItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export type BackOfficeSection = {
  label: string;
  items: BackOfficeItem[];
  defaultCollapsed?: boolean;
};

/**
 * Agency Back Office — all financial & accounting surfaces.
 * Visible to admin / office_admin / bookkeeper only.
 */
export const backOfficeSections: BackOfficeSection[] = [
  {
    label: "Overview",
    items: [
      { name: "Back Office Home", href: "/back-office", icon: LayoutDashboard, description: "Entry point for all agency financials" },
      { name: "Accounting Dashboard", href: "/bookkeeper", icon: FileBarChart, description: "Bookkeeping KPIs and alerts" },
    ],
  },
  {
    label: "Financial Statements",
    items: [
      { name: "P&L", href: "/bookkeeper/pl", icon: TrendingUp, description: "Profit & loss by period" },
      { name: "Balance Sheet", href: "/bookkeeper/balance-sheet", icon: FileBarChart, description: "Assets, liabilities, equity" },
      { name: "Trial Balance", href: "/bookkeeper/trial-balance", icon: FileSpreadsheet, description: "Account-level balances" },
      { name: "Financial Packet", href: "/bookkeeper/packet", icon: FileText, description: "Month-end close packet" },
    ],
  },
  {
    label: "AR / AP",
    items: [
      { name: "AR Aging", href: "/bookkeeper/ar-aging", icon: AlertTriangle, description: "Client balances outstanding" },
      { name: "AP Aging", href: "/bookkeeper/ap-aging", icon: AlertTriangle, description: "Supplier balances outstanding" },
      { name: "Supplier Payments Due", href: "/supplier-payments-due", icon: Banknote, description: "Upcoming supplier deadlines" },
      { name: "Payments Due", href: "/payments-due", icon: CreditCard, description: "Client installments coming due" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { name: "Income", href: "/bookkeeper/income", icon: DollarSign, description: "Revenue transactions" },
      { name: "Expenses", href: "/bookkeeper/expenses", icon: Banknote, description: "Supplier and operating spend" },
      { name: "Unattributed", href: "/bookkeeper/unattributed", icon: FileWarning, description: "Payments needing attribution" },
      { name: "Daily Payment Report", href: "/reports/daily-payments", icon: FileText, description: "Daily & monthly payment activity" },
    ],
  },
  {
    label: "Commissions & Payouts",
    items: [
      { name: "Commission Report", href: "/commission-report", icon: FileText, description: "Statements, splits, payouts" },
      { name: "Agent Payouts", href: "/bookkeeper/payouts", icon: Wallet, description: "Advisor payout runs" },
      { name: "1099 Prep", href: "/bookkeeper/1099", icon: FileText, description: "Year-end contractor totals" },
      { name: "Issued Cards", href: "/issued-cards", icon: CreditCard, description: "Virtual supplier payment cards" },
    ],
  },
  {
    label: "Reconciliation",
    defaultCollapsed: true,
    items: [
      { name: "Recon Dashboard", href: "/recon", icon: ArrowRightLeft, description: "Reconciliation overview" },
      { name: "Match Center", href: "/recon/matches", icon: ArrowRightLeft, description: "Match payments to bookings" },
      { name: "Exceptions", href: "/recon/exceptions", icon: AlertTriangle, description: "Mismatches needing review" },
      { name: "Recon Approvals", href: "/recon/approvals", icon: ShieldCheck, description: "Approve reconciliation actions" },
      { name: "Stripe Payouts", href: "/recon/payouts", icon: CreditCard, description: "Stripe payout batches" },
      { name: "Stripe Recon", href: "/recon/stripe", icon: ArrowRightLeft, description: "Charges, fees, refunds" },
      { name: "Bank Reconciliation", href: "/bookkeeper/bank-recon", icon: Landmark, description: "Bank statement matching" },
      { name: "Monthly Recon", href: "/reconciliation", icon: FileSpreadsheet, description: "Period close reconciliation" },
      { name: "Recon Settings", href: "/recon/settings", icon: Settings, description: "Accounts and rules" },
    ],
  },
  {
    label: "QuickBooks Sync",
    defaultCollapsed: true,
    items: [
      { name: "QBO Health", href: "/qbo-health", icon: HeartPulse, description: "Connection and entity sync status" },
      { name: "QBO Payment Sync", href: "/qbo-payment-sync", icon: ArrowRightLeft, description: "Push payments to QuickBooks" },
      { name: "QBO Unmatched Review", href: "/qbo-unmatched-review", icon: FileWarning, description: "Resolve unmatched records" },
      { name: "QBO Sync Logs", href: "/bookkeeper/qbo-logs", icon: Activity, description: "Sync history and errors" },
    ],
  },
  {
    label: "Compliance & Export",
    defaultCollapsed: true,
    items: [
      { name: "Export Center", href: "/bookkeeper/export", icon: Download, description: "CSV exports for accountants" },
      { name: "Audit Log", href: "/bookkeeper/audit", icon: ShieldCheck, description: "Who changed what, when" },
    ],
  },
];

export const backOfficePaths = backOfficeSections.flatMap((s) => s.items.map((i) => i.href));