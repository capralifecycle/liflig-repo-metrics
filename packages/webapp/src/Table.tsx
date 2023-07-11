/* eslint-disable react/jsx-key */
import cn from "classnames"
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
      : [...data].sort((a, b) => {
          const valA = valueMapperForSorting(a)
          const valB = valueMapperForSorting(b)
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
          return sortState.sortAsc ? result : -result
        })

  return (
    <table style={{ width: "min(100%, 1500px)" }}>
      <thead>
        {columns.map((it) => (
          <th
            onClick={() => (it.sortOn ? toggleSortState(it.header) : undefined)}
            className={it.sortOn ? "clickeableHeader" : undefined}
          >
            {it.header}
            {sortState?.column === it.header &&
              (sortState.sortAsc ? "👆🏼" : "👇🏼")}
          </th>
        ))}
      </thead>
      <tbody>
        {sortedData.map((item) => (
          <tr>
            {columns.map((column) => (
              <td>{column.render(item)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default Table
