// start of frontend/components/tool-ui/data-table/data-table.tsx
"use client";

import * as React from "react";
import { cn, Table, TableBody, TableRow, TableCell } from "./_ui";
import { sortData } from "./utilities";
import type {
  DataTableProps,
  DataTableContextValue,
  RowData,
  DataTableRowData,
  ColumnKey,
} from "./types";
import { ActionButtons, normalizeActionsConfig } from "../shared";

/**
 * Default locale for all Intl formatting operations.
 *
 * Changed to "fa-IR" for Persian localization (Solar Hijri dates, Persian digits).
 * This ensures consistent SSR/CSR behavior.
 *
 * @see {@link DataTableSerializableProps.locale}
 */
export const DEFAULT_LOCALE = "fa-IR" as const;


// We intentionally use `any` here to store the context value,
// then expose a strongly-typed hook via `useDataTable<T>()` that
// casts to the caller's row type.
const DataTableContext = React.createContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataTableContextValue<any> | undefined
>(undefined);

export function useDataTable<T extends object = RowData>() {
  const context = React.useContext(DataTableContext) as
    | DataTableContextValue<T>
    | undefined;
  if (!context) {
    throw new Error("useDataTable must be used within a DataTable");
  }
  return context;
}

export function DataTable<T extends object = RowData>({
  columns,
  data: rawData,
  rowIdKey,
  layout = "auto",
  defaultSort,
  sort: controlledSort,
  emptyMessage = "داده‌ای موجود نیست", // Translated: No data available
  isLoading = false,
  maxHeight,
  messageId,
  onSortChange,
  className,
  locale,
  footerActions,
  onFooterAction,
  onBeforeFooterAction,
}: DataTableProps<T>) {
  /**
   * Resolved locale with explicit default.
   */
  const resolvedLocale = locale ?? DEFAULT_LOCALE;

  const [internalSortBy, setInternalSortBy] = React.useState<
    ColumnKey<T> | undefined
  >(defaultSort?.by);
  const [internalSortDirection, setInternalSortDirection] = React.useState<
    "asc" | "desc" | undefined
  >(defaultSort?.direction);

  const sortBy = controlledSort?.by ?? internalSortBy;
  const sortDirection = controlledSort?.direction ?? internalSortDirection;

  const data = React.useMemo(() => {
    if (!sortBy || !sortDirection) return rawData;
    return sortData(rawData, sortBy, sortDirection, resolvedLocale);
  }, [rawData, sortBy, sortDirection, resolvedLocale]);

  /**
   * Tri-state sorting cycle implementation
   */
  const handleSort = React.useCallback(
    (key: ColumnKey<T>) => {
      let newDirection: "asc" | "desc" | undefined;

      if (sortBy === key) {
        if (sortDirection === "asc") {
          newDirection = "desc";
        } else if (sortDirection === "desc") {
          newDirection = undefined;
        } else {
          newDirection = "asc";
        }
      } else {
        newDirection = "asc";
      }

      const next = {
        by: newDirection ? key : undefined,
        direction: newDirection,
      } as const;

      if (controlledSort) {
        onSortChange?.(next);
      } else {
        setInternalSortBy(next.by);
        setInternalSortDirection(next.direction);
      }
    },
    [sortBy, sortDirection, controlledSort, onSortChange],
  );

  const contextValue: DataTableContextValue<T> = {
    columns,
    data,
    rowIdKey,
    sortBy,
    sortDirection,
    toggleSort: handleSort,
    messageId,
    isLoading,
    locale: resolvedLocale,
  };

  const sortAnnouncement = React.useMemo(() => {
    const col = columns.find((c) => c.key === sortBy);
    const label = col?.label ?? sortBy;
    if (sortBy && sortDirection) {
        // Translated sort announcement
        return `مرتب‌سازی بر اساس ${label}، ${sortDirection === "asc" ? "صعودی" : "نزولی"}`;
    }
    return "";
  }, [columns, sortBy, sortDirection]);

  const normalizedFooterActions = React.useMemo(
    () => normalizeActionsConfig(footerActions),
    [footerActions],
  );

  return (
    <DataTableContext.Provider value={contextValue}>
      <div
        className={cn("@container w-full", className)}
        data-layout={layout}
        dir="rtl" // Enforce RTL for the table container
      >
        {/* Table view: visible at @md+ in auto mode */}
        <div
          className={cn(
            layout === "table"
              ? "block"
              : layout === "cards"
                ? "hidden"
                : "hidden @md:block",
          )}
        >
          <div className="relative">
            <div
              className={cn(
                "bg-card relative w-full overflow-clip overflow-y-auto rounded-lg border",
                "touch-pan-x",
                maxHeight && "max-h-[--max-height]",
              )}
              style={
                maxHeight
                  ? ({ "--max-height": maxHeight } as React.CSSProperties)
                  : undefined
              }
            >
              <DataTableErrorBoundary>
                <Table aria-busy={isLoading || undefined}>
                  {columns.length > 0 && (
                    <colgroup>
                      {columns.map((col) => (
                        <col
                          key={String(col.key)}
                          style={col.width ? { width: col.width } : undefined}
                        />
                      ))}
                    </colgroup>
                  )}
                  {isLoading ? (
                    <DataTableSkeleton />
                  ) : data.length === 0 ? (
                    <DataTableEmpty message={emptyMessage} />
                  ) : (
                    <>
                      {React.Children.toArray(
                        React.Children.map(
                          React.createElement(DataTableContent, null),
                          (child) => child,
                        ),
                      )}
                    </>
                  )}
                </Table>
              </DataTableErrorBoundary>
            </div>
          </div>
        </div>

        {/* Card view: visible below @md in auto mode */}
        <div
          className={cn(
            layout === "cards"
              ? ""
              : layout === "table"
                ? "hidden"
                : "@md:hidden",
          )}
          role="list"
          aria-label="جدول داده‌ها (نمای کارتی موبایل)" // Data table (mobile card view)
          aria-describedby="mobile-table-description"
        >
          <div id="mobile-table-description" className="sr-only">
            داده‌های جدول به صورت کارت‌های بازشونده نمایش داده می‌شوند. هر کارت نشان‌دهنده یک سطر است.
            {columns.length > 0 &&
              ` ستون‌ها: ${columns.map((c) => c.label).join(", ")}.`}
          </div>

          <DataTableErrorBoundary>
            {isLoading ? (
              <DataTableSkeletonCards />
            ) : data.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                {emptyMessage}
              </div>
            ) : (
              <div className="bg-card flex flex-col overflow-hidden rounded-2xl border shadow-xs">
                {data.map((row, i) => {
                  const keyVal = rowIdKey ? row[rowIdKey] : undefined;
                  const rowKey = keyVal != null ? String(keyVal) : String(i);
                  return (
                    <DataTableAccordionCard
                      key={rowKey}
                      row={row as unknown as DataTableRowData}
                      index={i}
                      isFirst={i === 0}
                    />
                  );
                })}
              </div>
            )}
          </DataTableErrorBoundary>
        </div>

        {sortAnnouncement && (
          <div className="sr-only" aria-live="polite">
            {sortAnnouncement}
          </div>
        )}

        {normalizedFooterActions ? (
          <div className="@container/actions mt-4">
            <ActionButtons
              actions={normalizedFooterActions.items}
              align={normalizedFooterActions.align}
              confirmTimeout={normalizedFooterActions.confirmTimeout}
              onAction={(id) => onFooterAction?.(id)}
              onBeforeAction={onBeforeFooterAction}
            />
          </div>
        ) : null}
      </div>
    </DataTableContext.Provider>
  );
}

function DataTableContent() {
  return (
    <>
      <DataTableHeader />
      <DataTableBody />
    </>
  );
}

function DataTableEmpty({ message }: { message: string }) {
  const { columns } = useDataTable();

  return (
    <TableBody>
      <TableRow className="bg-card h-24 text-center">
        <TableCell colSpan={columns.length} role="status" aria-live="polite">
          {message}
        </TableCell>
      </TableRow>
    </TableBody>
  );
}

function DataTableSkeleton() {
  const { columns } = useDataTable();

  return (
    <>
      <DataTableHeader />
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            {columns.map((_, j) => (
              <TableCell key={j}>
                <div className="bg-muted/50 h-4 animate-pulse rounded" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </>
  );
}

function DataTableSkeletonCards() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border p-4 text-right">
          <div className="bg-muted/50 h-5 w-1/2 animate-pulse rounded" />
          <div className="bg-muted/50 h-4 w-3/4 animate-pulse rounded" />
          <div className="bg-muted/50 h-4 w-2/3 animate-pulse rounded" />
        </div>
      ))}
    </>
  );
}

import { DataTableHeader } from "./data-table-header";
import { DataTableBody } from "./data-table-body";
import { DataTableAccordionCard } from "./data-table-accordion-card";
import { DataTableErrorBoundary } from "./error-boundary";
// end of frontend/components/tool-ui/data-table/data-table.tsx