import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DataTable primitives — light wrappers with the shared row/cell rhythm.
 * Header: bg card-2, 10.5px uppercase .11em/600 muted, padding 10px 16px.
 * Body: border-top, cells 12px 16px, primary 14px/500 with optional 12px muted secondary.
 * Money columns should get `tabular-nums text-right`.
 */

const DataTable = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table
        ref={ref}
        className={cn("w-full border-collapse text-left align-middle", className)}
        {...props}
      />
    </div>
  ),
);
DataTable.displayName = "DataTable";

const DataTableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("bg-card-2", className)} {...props} />
));
DataTableHead.displayName = "DataTableHead";

const DataTableHeaderRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => <tr ref={ref} className={cn("", className)} {...props} />);
DataTableHeaderRow.displayName = "DataTableHeaderRow";

interface DataTableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
  /** Hide this column under 900px. */
  secondary?: boolean;
}

const DataTableHeaderCell = React.forwardRef<HTMLTableCellElement, DataTableHeaderCellProps>(
  ({ className, align = "left", secondary, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "px-4 py-[10px] text-[10.5px] font-semibold uppercase tracking-[.11em] text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        secondary && "hidden min-[900px]:table-cell",
        className,
      )}
      {...props}
    />
  ),
);
DataTableHeaderCell.displayName = "DataTableHeaderCell";

const DataTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={cn("", className)} {...props} />);
DataTableBody.displayName = "DataTableBody";

interface DataTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean;
}

const DataTableRow = React.forwardRef<HTMLTableRowElement, DataTableRowProps>(
  ({ className, interactive, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-t border-border transition-colors",
        interactive && "cursor-pointer hover:bg-muted/40",
        className,
      )}
      {...props}
    />
  ),
);
DataTableRow.displayName = "DataTableRow";

interface DataTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
  money?: boolean;
  secondary?: boolean;
  primary?: React.ReactNode;
  sub?: React.ReactNode;
}

const DataTableCell = React.forwardRef<HTMLTableCellElement, DataTableCellProps>(
  ({ className, align = "left", money, secondary, primary, sub, children, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "px-4 py-3 text-[14px] font-medium text-foreground",
        (align === "right" || money) && "text-right",
        align === "center" && "text-center",
        money && "[font-variant-numeric:tabular-nums]",
        secondary && "hidden min-[900px]:table-cell",
        className,
      )}
      {...props}
    >
      {primary !== undefined ? (
        <div className={cn("flex flex-col", (align === "right" || money) && "items-end")}>
          <span>{primary}</span>
          {sub !== undefined && sub !== null && (
            <span className="text-[12px] font-normal text-muted-foreground">{sub}</span>
          )}
        </div>
      ) : (
        children
      )}
    </td>
  ),
);
DataTableCell.displayName = "DataTableCell";

export {
  DataTable,
  DataTableHead,
  DataTableHeaderRow,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
};