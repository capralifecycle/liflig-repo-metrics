import * as React from "react"
import { createRoot } from "react-dom/client"

import "./styles/variables.css"
import "./styles/main.css"

import App from "./App"

const container = document.getElementById("root") as Element
const root = createRoot(container)
root.render(<App />)
