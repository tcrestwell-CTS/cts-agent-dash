import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

interface Props {
  status: string;
}

export function EmailStatusBadge({ status }: Props) {
  switch (status) {
    case "sent":
      return (
        <Badge className="bg-success/10 text-success hover:bg-success/10 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Sent
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 gap-1">
          <XCircle className="h-3 w-3" /> Failed
        </Badge>
      );
    case "retrying":
      return (
        <Badge className="bg-warning/10 text-warning hover:bg-warning/10 gap-1">
          <Clock className="h-3 w-3" /> Retrying
        </Badge>
      );
    case "bounced":
      return (
        <Badge className="bg-warning/10 text-warning hover:bg-warning/10 gap-1">
          <AlertCircle className="h-3 w-3" /> Bounced
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}