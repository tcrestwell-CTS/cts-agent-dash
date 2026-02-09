import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface InvoiceResult {
  id: string;
  invoice_number: string;
  trip_id: string | null;
  client_id: string | null;
  client_name: string | null;
  trip_name: string | null;
  total_amount: number;
  status: string;
}

export function InvoiceSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<InvoiceResult | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || !user) return;

    setSearching(true);
    setSearched(true);
    setResult(null);

    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, trip_id, client_id, client_name, trip_name, total_amount, status")
        .eq("user_id", user.id)
        .ilike("invoice_number", `%${query.trim()}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setResult(data);

      if (!data) {
        toast.info("No invoice found matching that number");
      }
    } catch (error) {
      console.error("Error searching invoice:", error);
      toast.error("Failed to search for invoice");
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleNavigate = () => {
    if (!result) return;
    
    if (result.trip_id) {
      navigate(`/trips/${result.trip_id}`);
    } else if (result.client_id) {
      navigate(`/contacts/${result.client_id}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="bg-card shadow-card border border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Invoice Lookup</h3>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoice number..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 h-9"
            />
          </div>
          <Button 
            size="sm" 
            onClick={handleSearch} 
            disabled={searching || !query.trim()}
            className="h-9"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>

        {searched && result && (
          <div 
            className="mt-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
            onClick={handleNavigate}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{result.invoice_number}</p>
                <p className="text-xs text-muted-foreground">
                  {result.trip_name || result.client_name || "Unknown"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{formatCurrency(result.total_amount)}</p>
                <p className="text-xs text-muted-foreground capitalize">{result.status}</p>
              </div>
            </div>
          </div>
        )}

        {searched && !result && !searching && (
          <p className="mt-3 text-xs text-muted-foreground text-center py-2">
            No invoice found
          </p>
        )}
      </CardContent>
    </Card>
  );
}
