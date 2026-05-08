import { Badge } from "@/components/ui/badge";

const VARS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "contact_name", label: "Full name" },
  { key: "email", label: "Email" },
];

interface Props {
  onInsert: (token: string) => void;
}

export function MergeVarChips({ onInsert }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VARS.map((v) => (
        <Badge
          key={v.key}
          variant="outline"
          className="cursor-pointer hover:bg-accent"
          onClick={() => onInsert(`{{${v.key}}}`)}
        >
          + {v.label}
        </Badge>
      ))}
    </div>
  );
}