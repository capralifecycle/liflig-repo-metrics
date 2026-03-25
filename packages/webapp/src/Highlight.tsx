import type * as React from "react"

interface Props {
  text: string
  search: string
}

export const Highlight: React.FC<Props> = ({ text, search }) => {
  if (search === "") return <>{text}</>

  const idx = text.toLowerCase().indexOf(search.toLowerCase())
  if (idx === -1) return <>{text}</>

  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + search.length)
  const after = text.slice(idx + search.length)
  return <span>{before}<mark>{match}</mark>{after}</span>
}
