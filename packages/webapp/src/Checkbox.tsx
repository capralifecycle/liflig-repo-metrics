import * as React from "react"

interface Props {
  children: React.ReactNode
  checked: boolean
  onCheck(checked: boolean): void
}

export const Checkbox: React.FC<Props> = (props) => (
  <p>
    <label>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onCheck(e.target.checked)}
      />{" "}
      {props.children}
    </label>
  </p>
)
