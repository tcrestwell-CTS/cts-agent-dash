import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateClient } from "@/hooks/useClients";
import { ArrowLeft, Loader2 } from "lucide-react";

interface QuickAddClientFormProps {
  onClientCreated: (clientId: string) => void;
  onCancel: () => void;
}

export function QuickAddClientForm({ onClientCreated, onCancel }: QuickAddClientFormProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const createClient = useCreateClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const name = `${formData.first_name} ${formData.last_name}`.trim();
    if (!name) return;

    const result = await createClient.mutateAsync({
      name,
      first_name: formData.first_name || null,
      last_name: formData.last_name || null,
      email: formData.email || null,
      phone: formData.phone || null,
      status: "lead",
    });

    if (result?.id) {
      onClientCreated(result.id);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 px-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <h3 className="text-[13.5px] font-semibold text-foreground">Quick Add Client</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-[11px]">
          <div className="space-y-1.5">
            <Label htmlFor="quick_first_name" className="text-[12.5px]">First Name *</Label>
            <Input
              id="quick_first_name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              placeholder="John"
              required
              className="text-[13.5px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick_last_name" className="text-[12.5px]">Last Name *</Label>
            <Input
              id="quick_last_name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              placeholder="Doe"
              required
              className="text-[13.5px]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quick_email" className="text-[12.5px]">Email</Label>
          <Input
            id="quick_email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@example.com"
            className="text-[13.5px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quick_phone" className="text-[12.5px]">Phone</Label>
          <Input
            id="quick_phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+1 (555) 123-4567"
            className="text-[13.5px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="text-[13px]">
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={createClient.isPending || !formData.first_name || !formData.last_name}
            className="text-[13px]"
          >
            {createClient.isPending ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              "Create & Select"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
