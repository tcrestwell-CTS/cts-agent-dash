import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

interface Props {
  status: string;
}

export function EmailStatusBadge({ status }: Props) {
  switch (status) {
    case "sent":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Sent
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 gap-1">
          <XCircle className="h-3 w-3" /> Failed
        </Badge>
      );
    case "retrying":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 gap-1">
          <Clock className="h-3 w-3" /> Retrying
        </Badge>
      );
    case "bounced":
      return (
        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 gap-1">
          <AlertCircle className="h-3 w-3" /> Bounced
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}