import { ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, ArrowDown, ChevronsUpDown, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodLockButton } from "@/components/bookkeeper/PeriodLockButton";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────── breadcrumb ── */

export function BookkeeperBreadcrumb({ page }: { page: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/bookkeeper">Bookkeeper</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{page}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/* ────────────────────────────────────────────────────────────── header ─── */

interface BookkeeperHeaderProps {
  title: string;
  description?: string;
  year: number;
  month: number; // 1-12
  actions?: ReactNode;
}

export function BookkeeperHeader({ title, description, year, month, actions }: BookkeeperHeaderProps) {
  return (
    <div className="space-y-2">
      <BookkeeperBreadcrumb page={title} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">{title}</h1>
            <PeriodLockButton year={year} month={month} />
          </div>
          {description && <p className="text-[13.5px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── period picker ─── */

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface PeriodPickerProps {
  year: number;
  month: number;
  onChange: (y: number, m: number) => void;
  yearsBack?: number;
}

export function PeriodPicker({ year, month, onChange, yearsBack = 3 }: PeriodPickerProps) {
  const now = new Date();
  const years: number[] = [];
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - yearsBack; y--) years.push(y);
  return (
    <>
      <Select value={String(month)} onValueChange={(v) => onChange(year, parseInt(v, 10))}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MONTH_LABELS.map((m, i) => (
            <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(v) => onChange(parseInt(v, 10), month)}>
        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start, end: next };
}

/* ────────────────────────────────────────────────────────── empty state ── */

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-12 text-center", className)}>
      <div className="mb-3 rounded-full bg-card-2 p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-[15px] font-semibold text-foreground">{title}</div>
      {description && (
        <div className="mt-1 max-w-md text-[13px] text-muted-foreground">{description}</div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────── table skeleton ── */

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-3 pb-2 border-b" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3 py-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── sortable ── */

export type SortDir = "asc" | "desc";
export interface SortState<K extends string = string> {
  key: K;
  dir: SortDir;
}

interface SortableHeadProps<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: "left" | "right";
  className?: string;
}

export function SortableHead<K extends string>({ label, sortKey, sort, onSort, align = "left", className }: SortableHeadProps<K>) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={cn(
        "bg-card-2 text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground",
        align === "right" && "text-right",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground",
          align === "right" && "ml-auto",
        )}
      >
        <span>{label}</span>
        <Icon className="h-3 w-3 opacity-60" />
      </button>
    </TableHead>
  );
}

export function useSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const onSort = (key: K) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  return { sort, onSort, setSort };
}

export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  accessor: (row: T, key: K) => unknown,
): T[] {
  const out = [...rows];
  out.sort((a, b) => {
    const av = accessor(a, sort.key);
    const bv = accessor(b, sort.key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return sort.dir === "asc" ? av - bv : bv - av;
    }
    const as = String(av);
    const bs = String(bv);
    return sort.dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
  });
  return out;
}

/* ──────────────────────────────────────────────────────── pagination ─── */

export const DEFAULT_PAGE_SIZE = 25;

export function usePagination<T>(rows: T[], pageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = useMemo(() => rows.slice(start, start + pageSize), [rows, start, pageSize]);
  return {
    page: safePage,
    setPage,
    pageSize,
    totalPages,
    pageRows,
    total: rows.length,
    rangeStart: rows.length === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, rows.length),
  };
}

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({ page, totalPages, total, rangeStart, rangeEnd, onPageChange }: TablePaginationProps) {
  if (total === 0) return null;
  const go = (p: number) => onPageChange(Math.max(1, Math.min(totalPages, p)));
  const pages: (number | "…")[] = [];
  const push = (n: number | "…") => pages.push(n);
  // Window around current page
  const window = 1;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
      push(i);
    } else if (pages[pages.length - 1] !== "…") {
      push("…");
    }
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <div className="text-[12px] text-muted-foreground">
        Showing <span className="tabular-nums">{rangeStart}</span>–<span className="tabular-nums">{rangeEnd}</span> of{" "}
        <span className="tabular-nums">{total}</span>
      </div>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => { e.preventDefault(); go(page - 1); }}
              aria-disabled={page === 1}
              className={cn(page === 1 && "pointer-events-none opacity-50")}
            />
          </PaginationItem>
          {pages.map((p, i) =>
            p === "…" ? (
              <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => { e.preventDefault(); go(p); }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => { e.preventDefault(); go(page + 1); }}
              aria-disabled={page === totalPages}
              className={cn(page === totalPages && "pointer-events-none opacity-50")}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── money cell ── */

export function MoneyCell({ value, className, bold }: { value: number; className?: string; bold?: boolean }) {
  return (
    <TableCell className={cn("text-right text-[14px] tabular-nums", bold && "font-semibold", className)}>
      {Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
    </TableCell>
  );
}

/* spacer rows for skeleton bodies inside an existing Table */
export function TableBodySkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}