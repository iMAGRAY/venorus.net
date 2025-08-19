import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={className} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export function buttonVariants({ variant = "default" }: { variant?: ButtonProps["variant"] } = {}) {
  switch (variant) {
    case "destructive":
      return "inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
    case "outline":
      return "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
    case "secondary":
      return "inline-flex items-center justify-center rounded-md bg-slate-700 px-4 py-2 text-white hover:bg-slate-800"
    case "ghost":
      return "inline-flex items-center justify-center rounded-md px-4 py-2 text-slate-700 hover:bg-slate-100"
    case "link":
      return "inline-flex items-center justify-center px-0 py-0 text-blue-700 hover:underline"
    default:
      return "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
  }
}

export { Button }
