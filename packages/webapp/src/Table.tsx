import * as React from "react"

export interface Column<T> {
  header: string
  render: (value: T) => React.ReactNode
  sortOn?: (value: T) => string | number | undefined
}

interface SortState {
  column: string
  sortAsc: boolean
}

interface Props<T extends object> {
  columns: Column<T>[]
  data: T[]
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

function Table<T extends object>({ columns, data }: Props<T>) {
  const [sortState, setSortstate] = React.useState<SortState>()

  const toggleSortState = (header: string) => {
    setSortstate((prev) => {
      if (prev?.column !== header) {
        return { column: header, sortAsc: true }
      } else if (prev.sortAsc === true) {
        return { column: header, sortAsc: false }
      } else {
        return undefined
      }
    })
  }

  const valueMapperForSorting = columns.find(
    (it) => it.header === sortState?.column,
  )?.sortOn

  const sortedData =
    valueMapperForSorting == null || sortState == null
      ? data
      : [...data].sort(compareValues(valueMapperForSorting, sortState.sortAsc))

  return (
    <table style={{ width: "min(100%, 1500px)" }}>
      <thead>
        <tr>
          {columns.map((it) => (
            <th
              key={it.header}
              onClick={() =>
                it.sortOn ? toggleSortState(it.header) : undefined
              }
              className={it.sortOn ? "clickeableHeader" : undefined}
            >
              {it.header}
              {sortState?.column === it.header &&
                (sortState.sortAsc ? "👆🏼" : "👇🏼")}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((item, idx) => (
          <tr key={idx}>
            {columns.map((column) => (
              <td key={column.header}>{column.render(item)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default Table
