import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  TrendingUp,
  DollarSign,
  Calendar,
  ArrowUpRight,
} from "lucide-react";

const commissions = [
  {
    id: "COM-001",
    booking: "BK-2026-001",
    client: "Sarah Johnson",
    destination: "Maldives",
    bookingAmount: "$12,450",
    rate: "10%",
    commission: "$1,245",
    status: "paid",
    paidDate: "Feb 15, 2026",
  },
  {
    id: "COM-002",
    booking: "BK-2026-003",
    client: "Emma Williams",
    destination: "Tokyo, Japan",
    bookingAmount: "$6,800",
    rate: "10%",
    commission: "$680",
    status: "paid",
    paidDate: "Feb 10, 2026",
  },
  {
    id: "COM-003",
    booking: "BK-2026-002",
    client: "Michael Chen",
    destination: "Swiss Alps",
    bookingAmount: "$8,200",
    rate: "10%",
    commission: "$820",
    status: "pending",
    paidDate: null,
  },
  {
    id: "COM-004",
    booking: "BK-2026-004",
    client: "David Brown",
    destination: "Santorini",
    bookingAmount: "$9,100",
    rate: "10%",
    commission: "$910",
    status: "pending",
    paidDate: null,
  },
  {
    id: "COM-005",
    booking: "BK-2026-005",
    client: "Lisa Anderson",
    destination: "Bali",
    bookingAmount: "$7,500",
    rate: "10%",
    commission: "$750",
    status: "processing",
    paidDate: null,
  },
];

const monthlyData = [
  { month: "Sep", earned: 3200 },
  { month: "Oct", earned: 4100 },
  { month: "Nov", earned: 5200 },
  { month: "Dec", earned: 4800 },
  { month: "Jan", earned: 6100 },
  { month: "Feb", earned: 7400 },
];

const maxEarned = Math.max(...monthlyData.map((d) => d.earned));

const Commissions = () => {
  const totalPaid = commissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + parseFloat(c.commission.replace(/[$,]/g, "")), 0);

  const totalPending = commissions
    .filter((c) => c.status !== "paid")
    .reduce((sum, c) => sum + parseFloat(c.commission.replace(/[$,]/g, "")), 0);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            Commission Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your earnings and payment history
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Earned (YTD)</p>
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-card-foreground">$32,600</p>
          <div className="flex items-center gap-1 mt-2 text-success">
            <ArrowUpRight className="h-4 w-4" />
            <span className="text-sm font-medium">+24% vs last year</span>
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">This Month</p>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-card-foreground">$7,400</p>
          <div className="flex items-center gap-1 mt-2 text-success">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">Best month yet!</span>
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Paid</p>
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-success">
            ${totalPaid.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground mt-2">2 payments</p>
        </div>

        <div className="bg-card rounded-xl p-5 shadow-card border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Pending</p>
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-accent" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-accent">
            ${totalPending.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground mt-2">3 pending</p>
        </div>
      </div>

      {/* Chart and Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-card rounded-xl p-6 shadow-card border border-border/50">
          <h3 className="text-lg font-semibold text-card-foreground mb-6">
            Earnings Trend
          </h3>
          <div className="flex items-end justify-between gap-3 h-48">
            {monthlyData.map((data) => (
              <div
                key={data.month}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div
                  className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                  style={{ height: `${(data.earned / maxEarned) * 100}%` }}
                />
                <span className="text-xs text-muted-foreground">
                  {data.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="lg:col-span-2 bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-lg font-semibold text-card-foreground">
              Recent Commissions
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.booking}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.client}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.destination}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{item.bookingAmount}</TableCell>
                  <TableCell>{item.rate}</TableCell>
                  <TableCell className="font-semibold text-success">
                    {item.commission}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        item.status === "paid"
                          ? "bg-success/10 text-success"
                          : item.status === "pending"
                          ? "bg-accent/10 text-accent"
                          : "bg-primary/10 text-primary"
                      }
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Commissions;
