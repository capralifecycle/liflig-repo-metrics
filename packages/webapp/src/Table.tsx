import * as React from "react"

export interface Column<T> {
  header: string
  headerIcon?: React.ReactNode
  subheader?: string
  subheaderTitle?: string
  render: (value: T, isExpanded: boolean) => React.ReactNode
  sortOn?: (value: T) => string | number | undefined
}

interface SortState {
  column: string
  sortAsc: boolean
}

interface Props<T extends object> {
  columns: Column<T>[]
  data: T[]
  rowKey?: (item: T) => string
}

function compareValues<T>(
  mapper: (value: T) => string | number | undefined,
  sortAsc: boolean,
): (a: T, b: T) => number {
  return (a, b) => {
    const valA = mapper(a)
    const valB = mapper(b)
    if (valA === valB) return 0

    const result =
      valA == null
        ? -1
        : valB == null
          ? 1
          : valA > valB
            ? 1
            : valA < valB
              ? -1
              : 0
    return sortAsc ? result : -result
  }
}

function columnKey<T>(column: Column<T>): string {
  return column.subheader
    ? `${column.header}-${column.subheader}`
    : column.header
}

function Table<T extends object>({ columns, data, rowKey }: Props<T>) {
  const [sortState, setSortstate] = React.useState<SortState>()
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(
    new Set(),
  )

  const toggleSortState = (header: string) => {
    setSortstate((prev) => {
      if (prev?.column !== header) {
        return { column: header, sortAsc: true }
      }
      if (prev.sortAsc === true) {
        return { column: header, sortAsc: false }
      }
      return undefined
    })
  }

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const valueMapperForSorting = columns.find(
    (it) => columnKey(it) === sortState?.column,
  )?.sortOn

  const sortedData =
    valueMapperForSorting == null || sortState == null
      ? data
      : [...data].sort(compareValues(valueMapperForSorting, sortState.sortAsc))

  return (
    <table style={{ width: "100%" }}>
      <thead>
        <tr>
          {rowKey && <th className="expand-col" />}
          {columns.map((it) => (
            <th
              key={columnKey(it)}
              onClick={() =>
                it.sortOn ? toggleSortState(columnKey(it)) : undefined
              }
              className={it.sortOn ? "clickeableHeader" : undefined}
            >
              <div className="column-header-row">
                {it.headerIcon}
                {it.header}
                {sortState?.column === columnKey(it) &&
                  (sortState.sortAsc ? " ▲" : " ▼")}
              </div>
              {it.subheader && (
                <div className="column-subheader" title={it.subheaderTitle}>
                  {it.subheader}
                </div>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((item, idx) => {
          const key = rowKey ? rowKey(item) : String(idx)
          const isExpanded = expandedRows.has(key)
          return (
            <tr
              key={key}
              className={rowKey ? "expandable-row" : undefined}
              onClick={rowKey ? (e) => {
                if ((e.target as HTMLElement).closest("a, button, input")) return
                toggleRow(key)
              } : undefined}
            >
              {rowKey && (
                <td className="expand-toggle">
                  <span className={`expand-chevron ${isExpanded ? "expanded" : ""}`}>
                    ›
                  </span>
                </td>
              )}
              {columns.map((column) => (
                <td key={columnKey(column)}>
                  {column.render(item, isExpanded)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default Table
