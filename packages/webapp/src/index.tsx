import { createRoot } from "react-dom/client"

import "./styles/variables.css"
import "./styles/main.css"

import App from "./App"
import { ThemeProvider } from "./ThemeContext"
import { ThemeToggle } from "./ThemeToggle"

const Root = () => (
  <ThemeProvider>
    <ThemeToggle />
    <App />
  </ThemeProvider>
)

const container = document.getElementById("root") as Element
const root = createRoot(container)
root.render(<Root />)
