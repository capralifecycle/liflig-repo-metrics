import type * as React from "react"

interface Props {
  children: React.ReactNode
  checked: boolean
  onCheck(checked: boolean): void
}

export const Checkbox: React.FC<Props> = (props) => (
  <div>
    <label>
      <input
        style={{ display: "inline" }}
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onCheck(e.target.checked)}
      />{" "}
      {props.children}
    </label>
  </div>
)
