import { Card, CardContent } from "@/components/ui/card";
import { Mail, CheckCircle2, XCircle, RotateCw, Percent } from "lucide-react";

interface Props {
  total: number;
  sent: number;
  failed: number;
  retries: number;
  successRate: number;
}

export function EmailActivityStats({ total, sent, failed, retries, successRate }: Props) {
  const items = [
    { label: "Total", value: total, icon: Mail, color: "text-foreground" },
    { label: "Sent", value: sent, icon: CheckCircle2, color: "text-green-600" },
    { label: "Failed", value: failed, icon: XCircle, color: "text-red-600" },
    { label: "Retries", value: retries, icon: RotateCw, color: "text-yellow-600" },
    { label: "Success rate", value: `${successRate.toFixed(1)}%`, icon: Percent, color: "text-primary" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{it.label}</p>
                <p className={`text-2xl font-semibold ${it.color}`}>{it.value}</p>
              </div>
              <it.icon className={`h-5 w-5 ${it.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}