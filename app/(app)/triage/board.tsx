"use client";

import { DndContext, MouseSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { COLUMN_LABELS, deriveRepoOptions, filterBoard, groupByColumn, isUnseen, type BoardFilters } from "@/lib/board";
import { COLUMNS, type BoardColumn, type ItemKind, type Priority } from "@/lib/model";
import type { ItemSummary } from "@/lib/triage/types";
import { moveItemAction } from "./actions";
import { Card } from "./card";
import { Drawer } from "./drawer";
import { SyncButton } from "./sync-button";

const PAGE = 30;

const selectClass =
  "min-h-9 rounded-md border border-hairline bg-canvas px-2 text-body-sm text-ink focus-visible:outline-2 focus-visible:outline-primary";

function Column({
  column,
  items,
  active,
  owner,
  onOpen,
  onMove,
}: {
  column: BoardColumn;
  items: ItemSummary[];
  active: boolean;
  owner: string;
  onOpen: (ref: string) => void;
  onMove: (ref: string, column: BoardColumn) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const [shown, setShown] = useState(PAGE);
  const unseen = items.filter(isUnseen).length;

  return (
    <section
      ref={setNodeRef}
      aria-label={COLUMN_LABELS[column]}
      className={[
        active ? "flex" : "hidden md:flex",
        "w-full shrink-0 flex-col rounded-lg md:w-72",
        isOver ? "bg-card-tint-lavender" : "bg-surface",
      ].join(" ")}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <h2 className="text-body-sm font-medium text-ink">{COLUMN_LABELS[column]}</h2>
        <span className="text-caption text-stone">{items.length}</span>
        {unseen > 0 ? <span className="ml-auto text-micro text-primary">{unseen} new</span> : null}
      </header>
      <div className="flex flex-col gap-2 px-2 pb-2">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline px-3 py-6 text-center text-caption text-stone">
            Nothing here
          </p>
        ) : null}
        {items.slice(0, shown).map((item) => (
          <Card key={item.ref} item={item} owner={owner} onOpen={onOpen} onMove={onMove} />
        ))}
        {items.length > shown ? (
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="min-h-9 rounded-md text-body-sm text-slate hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            Show {Math.min(PAGE, items.length - shown)} more
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function Board({
  initialItems,
  owner,
  lastSyncStatus,
}: {
  initialItems: ItemSummary[];
  owner: string;
  lastSyncStatus: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openRef = searchParams.get("item");

  const [items, setItems] = useState(initialItems);
  const [filters, setFilters] = useState<BoardFilters>({});
  const [activeColumn, setActiveColumn] = useState<BoardColumn>("inbox");
  const [error, setError] = useState<string | null>(null);
  const lastDragEnd = useRef(0);

  // Mouse only: touch scrolling stays native, and keyboard users get the select/drawer controls.
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }));

  const repoOptions = useMemo(() => deriveRepoOptions(items), [items]);
  const grouped = useMemo(() => groupByColumn(filterBoard(items, filters)), [items, filters]);

  const updateItem = useCallback((next: ItemSummary) => {
    setItems((prev) => prev.map((i) => (i.ref === next.ref ? next : i)));
  }, []);

  const move = useCallback(
    async (ref: string, column: BoardColumn) => {
      const before = items.find((i) => i.ref === ref);
      if (!before || before.column === column) return;
      setError(null);
      updateItem({ ...before, column, lastReason: "moved on board" });
      const result = await moveItemAction(ref, column);
      if ("error" in result) {
        updateItem(before);
        setError(`Couldn't move ${ref}: ${result.error}`);
      } else {
        updateItem(result.item);
      }
    },
    [items, updateItem],
  );

  const open = useCallback(
    (ref: string) => {
      if (Date.now() - lastDragEnd.current < 250) return; // ignore the click that ends a drag
      const params = new URLSearchParams(searchParams.toString());
      params.set("item", ref);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      setItems((prev) => prev.map((i) => (i.ref === ref ? { ...i, seenAt: new Date().toISOString() } : i)));
    },
    [pathname, router, searchParams],
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("item");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  function onDragEnd(event: DragEndEvent) {
    lastDragEnd.current = Date.now();
    if (event.over) void move(String(event.active.id), event.over.id as BoardColumn);
  }

  const total = COLUMNS.reduce((n, c) => n + grouped[c].length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-heading-4 text-ink">Triage</h1>
          <p className="text-caption text-stone">
            {total} items{lastSyncStatus === "partial" ? " · last sync didn't finish" : ""}
          </p>
        </div>
        <SyncButton />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filter by repository"
          value={filters.repo ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, repo: e.target.value || undefined }))}
          className={selectClass}
        >
          <option value="">All repos</option>
          {repoOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by type"
          value={filters.kind ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, kind: (e.target.value || undefined) as ItemKind | undefined }))}
          className={selectClass}
        >
          <option value="">Issues & PRs</option>
          <option value="issue">Issues</option>
          <option value="pr">Pull requests</option>
        </select>
        <select
          aria-label="Filter by priority"
          value={filters.priority ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, priority: (e.target.value || undefined) as Priority | undefined }))
          }
          className={selectClass}
        >
          <option value="">Any priority</option>
          <option value="p0">P0</option>
          <option value="p1">P1</option>
          <option value="p2">P2</option>
          <option value="p3">P3</option>
        </select>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-card-tint-rose px-3 py-2 text-body-sm text-semantic-error">
          {error}
        </p>
      ) : null}

      {/* Mobile: one column at a time. */}
      <div role="tablist" aria-label="Board columns" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:hidden">
        {COLUMNS.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === activeColumn}
            onClick={() => setActiveColumn(c)}
            className={
              c === activeColumn
                ? "min-h-9 shrink-0 whitespace-nowrap rounded-full bg-ink px-3 text-caption font-medium text-on-dark"
                : "min-h-9 shrink-0 whitespace-nowrap rounded-full bg-surface px-3 text-caption text-slate"
            }
          >
            {COLUMN_LABELS[c]} <span className={c === activeColumn ? "text-on-dark-muted" : "text-stone"}>{grouped[c].length}</span>
          </button>
        ))}
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="md:-mx-6 md:flex md:gap-3 md:overflow-x-auto md:px-6 md:pb-4">
          {COLUMNS.map((c) => (
            <Column
              key={c}
              column={c}
              items={grouped[c]}
              active={c === activeColumn}
              owner={owner}
              onOpen={open}
              onMove={move}
            />
          ))}
        </div>
      </DndContext>

      {openRef ? <Drawer itemRef={openRef} onClose={close} onChanged={updateItem} /> : null}
    </div>
  );
}
