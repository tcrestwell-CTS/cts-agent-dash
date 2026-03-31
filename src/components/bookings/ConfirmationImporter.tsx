// =============================================================================
// ConfirmationImporter — upload a cruise line booking confirmation PDF,
// extract financials, and reconcile against CRM booking data.
// Used in BookingDetail sidebar.
// =============================================================================

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload, FileCheck, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, XCircle,
} from "lucide-react";
import { useBookingConfirmation } from "@/hooks/useBookingConfirmations";
import { Booking } from "@/hooks/useBookings";

interface ConfirmationImporterProps {
  booking: Booking;
}

const fmt = (v: number | null | undefined) =>
  v == null ? "—"
  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toFixed(1)}%`;

const STATUS_CONFIG = {
  pending:  { label: "Pending",   color: "bg-muted text-muted-foreground",     icon: Upload },
  matched:  { label: "Matched",   color: "bg-success/10 text-success",          icon: CheckCircle2 },
  mismatch: { label: "Mismatch",  color: "bg-warning/10 text-warning",          icon: AlertTriangle },
  accepted: { label: "Accepted",  color: "bg-primary/10 text-primary",          icon: FileCheck },
  skipped:  { label: "Noted",     color: "bg-muted text-muted-foreground",      icon: XCircle },
} as const;

export function ConfirmationImporter({ booking }: ConfirmationImporterProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const {
    confirmation,
    isLoading,
    uploadConfirmation,
    acceptConfirmedValues,
    dismissMismatch,
  } = useBookingConfirmation(booking.id);

  const isUploading = uploadConfirmation.isPending;
  const isAccepting = acceptConfirmedValues.isPending;

  const handleFile = (file: File) => {
    if (!file.type.includes("pdf")) {
      return;
    }
    uploadConfirmation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const status = confirmation?.recon_status ?? "pending";
  const cfg    = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;

  const hasMismatch = status === "mismatch";
  const hasConfirmation = !!confirmation?.extracted_at;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-muted-foreground" />
            Booking Confirmation
          </span>
          {hasConfirmation && (
            <Badge className={`text-xs ${cfg.color}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {cfg.label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Upload zone */}
        {!isUploading && (
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
              ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
          >
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">
              {hasConfirmation ? "Replace confirmation PDF" : "Upload confirmation PDF"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Drag & drop or click — Celebrity, Carnival, Royal Caribbean, etc.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {/* Processing state */}
        {isUploading && (
          <div className="flex items-center justify-center gap-3 py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div className="text-sm">
              <p className="font-medium">Extracting financials...</p>
              <p className="text-xs">Claude is reading the PDF</p>
            </div>
          </div>
        )}

        {/* Extracted data */}
        {hasConfirmation && !isUploading && (
          <div className="space-y-3">

            {/* Cruise details */}
            {(confirmation.extracted_cruise_line || confirmation.extracted_ship) && (
              <div className="text-xs bg-muted/30 rounded-lg p-3 space-y-1">
                {confirmation.extracted_cruise_line && (
                  <p><span className="text-muted-foreground">Line:</span> <span className="font-medium">{confirmation.extracted_cruise_line}</span></p>
                )}
                {confirmation.extracted_ship && (
                  <p><span className="text-muted-foreground">Ship:</span> <span className="font-medium">{confirmation.extracted_ship}</span></p>
                )}
                {confirmation.extracted_reservation_id && (
                  <p><span className="text-muted-foreground">Res ID:</span> <span className="font-medium font-mono">{confirmation.extracted_reservation_id}</span></p>
                )}
                {confirmation.extracted_stateroom && (
                  <p><span className="text-muted-foreground">Stateroom:</span> <span className="font-medium">{confirmation.extracted_stateroom}</span></p>
                )}
              </div>
            )}

            {/* Financial comparison table */}
            <div className="text-xs">
              <div className="grid grid-cols-3 gap-1 mb-1 text-muted-foreground font-medium px-1">
                <span>Field</span>
                <span className="text-right">CRM</span>
                <span className="text-right">PDF</span>
              </div>

              {[
                {
                  label:    "Gross Charges",
                  crm:      booking.gross_sales,
                  pdf:      confirmation.extracted_gross_charges,
                  variance: confirmation.gross_variance,
                },
                {
                  label:    "Commission",
                  crm:      booking.commission_revenue,
                  pdf:      confirmation.extracted_commission_amount,
                  variance: confirmation.commission_variance,
                },
                {
                  label:    "Net (Remit)",
                  crm:      booking.supplier_payout,
                  pdf:      confirmation.extracted_net_charges,
                  variance: confirmation.net_variance,
                },
              ].map(row => {
                const hasVar = (row.variance ?? 0) > 1.0;
                return (
                  <div
                    key={row.label}
                    className={`grid grid-cols-3 gap-1 px-1 py-1 rounded ${hasVar ? "bg-warning/10" : ""}`}
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={`text-right ${hasVar ? "text-warning" : ""}`}>
                      {fmt(row.crm)}
                    </span>
                    <span className={`text-right font-medium ${hasVar ? "text-warning" : "text-foreground"}`}>
                      {fmt(row.pdf)}
                      {hasVar && (
                        <span className="block text-[10px] opacity-70">
                          Δ {fmt(row.variance)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}

              {confirmation.extracted_commission_rate && (
                <div className="grid grid-cols-3 gap-1 px-1 py-1 border-t mt-1">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="text-right">{pct((booking as any).commission_rate)}</span>
                  <span className="text-right font-medium">{pct(confirmation.extracted_commission_rate)}</span>
                </div>
              )}
            </div>

            {/* Mismatch actions */}
            {hasMismatch && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-warning font-medium">
                  ⚠ Discrepancies found — review before reconciling
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-xs h-8"
                    onClick={() => setShowAcceptDialog(true)}
                    disabled={isAccepting}
                  >
                    {isAccepting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Accept PDF Values
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                    onClick={() => dismissMismatch.mutate("Variance within acceptable range")}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {/* Matched — show accept option */}
            {status === "matched" && (
              <div className="space-y-2">
                <p className="text-xs text-success">
                  ✓ Financials match within $1.00 tolerance
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-8"
                  onClick={() => setShowAcceptDialog(true)}
                  disabled={isAccepting}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sync exact values to CRM
                </Button>
              </div>
            )}

            {/* Accepted */}
            {status === "accepted" && (
              <p className="text-xs text-muted-foreground">
                ✓ CRM updated with confirmed values from PDF
              </p>
            )}

            {/* Filename + re-upload */}
            {confirmation.pdf_filename && (
              <p className="text-xs text-muted-foreground truncate">
                📄 {confirmation.pdf_filename}
              </p>
            )}
          </div>
        )}

        {/* Accept confirmation dialog */}
        <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Accept PDF Values?</AlertDialogTitle>
              <AlertDialogDescription>
                This will update the booking in the CRM with the exact values
                from the uploaded confirmation:
                <div className="mt-3 space-y-1 text-sm font-medium">
                  <p>Gross Sales: {fmt(confirmation?.extracted_gross_charges)}</p>
                  <p>Commission: {fmt(confirmation?.extracted_commission_amount)}</p>
                  <p>Supplier Remittance: {fmt(confirmation?.extracted_net_charges)}</p>
                </div>
                <p className="mt-3">Margin will be recalculated with the confirmed numbers.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  acceptConfirmedValues.mutate();
                  setShowAcceptDialog(false);
                }}
              >
                Accept & Update CRM
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
}
