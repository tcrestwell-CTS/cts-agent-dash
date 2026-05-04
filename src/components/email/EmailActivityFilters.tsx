import { useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  from: Date;
  to: Date;
  template: string;
  status: string;
  search: string;
  templates: string[];
  onChange: (next: {
    from: Date;
    to: Date;
    template: string;
    status: string;
    search: string;
  }) => void;
}

export function EmailActivityFilters({
  from,
  to,
  template,
  status,
  search,
  templates,
  onChange,
}: Props) {
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);

  const setPreset = (days: number) => {
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(end, days - 1));
    onChange({ from: start, to: end, template, status, search });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={() => setPreset(1)}>24h</Button>
        <Button variant="outline" size="sm" onClick={() => setPreset(7)}>7d</Button>
        <Button variant="outline" size="sm" onClick={() => setPreset(30)}>30d</Button>
      </div>

      <Popover open={openFrom} onOpenChange={setOpenFrom}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(from, "MMM d, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={from}
            onSelect={(d) => {
              if (d) {
                onChange({ from: startOfDay(d), to, template, status, search });
                setOpenFrom(false);
              }
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <Popover open={openTo} onOpenChange={setOpenTo}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(to, "MMM d, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={to}
            onSelect={(d) => {
              if (d) {
                onChange({ from, to: endOfDay(d), template, status, search });
                setOpenTo(false);
              }
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <Select value={template} onValueChange={(v) => onChange({ from, to, template: v, status, search })}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All templates" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All templates</SelectItem>
          {templates.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => onChange({ from, to, template, status: v, search })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="retrying">Retrying</SelectItem>
          <SelectItem value="bounced">Bounced</SelectItem>
        </SelectContent>
      </Select>

      <Input
        placeholder="Search recipient or subject..."
        value={search}
        onChange={(e) => onChange({ from, to, template, status, search: e.target.value })}
        className="w-[260px]"
      />
    </div>
  );
}