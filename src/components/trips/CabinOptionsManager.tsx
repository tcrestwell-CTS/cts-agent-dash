import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, BedDouble, Users, Loader2 } from "lucide-react";

interface CabinOption {
  id: string;
  trip_id: string;
  category_name: string;
  description: string | null;
  price_per_person: number;
  deposit_amount: number;
  capacity: number | null;
  image_url: string | null;
  sort_order: number;
}

interface CabinOptionsManagerProps {
  tripId: string;
  onDataChange?: () => void;
}

export function CabinOptionsManager({ tripId, onDataChange }: CabinOptionsManagerProps) {
  const [options, setOptions] = useState<CabinOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newOption, setNewOption] = useState({
    category_name: "",
    description: "",
    price_per_person: "",
    deposit_amount: "",
    capacity: "",
    image_url: "",
  });

  const fetchOptions = async () => {
    const { data, error } = await supabase
      .from("trip_cabin_options")
      .select("*")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true });

    if (!error && data) {
      setOptions(data as CabinOption[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOptions();
  }, [tripId]);

  const handleAdd = async () => {
    if (!newOption.category_name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("trip_cabin_options").insert({
      trip_id: tripId,
      category_name: newOption.category_name.trim(),
      description: newOption.description.trim() || null,
      price_per_person: parseFloat(newOption.price_per_person) || 0,
      deposit_amount: parseFloat(newOption.deposit_amount) || 0,
      capacity: newOption.capacity ? parseInt(newOption.capacity) : null,
      image_url: newOption.image_url.trim() || null,
      sort_order: options.length,
    } as any);

    if (error) {
      toast.error("Failed to add cabin option");
    } else {
      toast.success("Cabin option added");
      setNewOption({ category_name: "", description: "", price_per_person: "", deposit_amount: "", capacity: "", image_url: "" });
      setShowAddForm(false);
      fetchOptions();
      onDataChange?.();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("trip_cabin_options").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Cabin option removed");
      fetchOptions();
      onDataChange?.();
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <BedDouble className="h-5 w-5" />
          Cabin / Category Options
        </CardTitle>
        <Button size="sm" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Option
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {options.length === 0 && !showAddForm && (
          <div className="text-center py-8">
            <BedDouble className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground font-medium">No cabin options defined</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add cabin categories so travelers can choose during signup.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add First Option
            </Button>
          </div>
        )}

        {options.map((opt) => (
          <div
            key={opt.id}
            className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
          >
            {opt.image_url && (
              <img
                src={opt.image_url}
                alt={opt.category_name}
                className="w-20 h-14 rounded object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{opt.category_name}</span>
                <Badge variant="outline" className="text-xs">
                  {formatCurrency(opt.price_per_person)} / person
                </Badge>
                {opt.deposit_amount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {formatCurrency(opt.deposit_amount)} deposit
                  </Badge>
                )}
              </div>
              {opt.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{opt.description}</p>
              )}
              {opt.capacity && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Max {opt.capacity} travelers
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={() => handleDelete(opt.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {showAddForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
            <p className="font-medium text-sm">New Cabin / Category</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Category Name *</Label>
                <Input
                  placeholder="e.g. Interior Cabin, Balcony Suite"
                  value={newOption.category_name}
                  onChange={(e) => setNewOption((p) => ({ ...p, category_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Price Per Person</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={newOption.price_per_person}
                  onChange={(e) => setNewOption((p) => ({ ...p, price_per_person: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Deposit Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={newOption.deposit_amount}
                  onChange={(e) => setNewOption((p) => ({ ...p, deposit_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Max Capacity</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Leave empty for unlimited"
                  value={newOption.capacity}
                  onChange={(e) => setNewOption((p) => ({ ...p, capacity: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Description</Label>
              <Textarea
                placeholder="Describe what's included in this category..."
                rows={2}
                value={newOption.description}
                onChange={(e) => setNewOption((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Image URL (optional)</Label>
              <Input
                placeholder="https://..."
                value={newOption.image_url}
                onChange={(e) => setNewOption((p) => ({ ...p, image_url: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? "Adding..." : "Add Option"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
