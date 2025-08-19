import * as React from "react"

type AnyProps = React.PropsWithChildren<Record<string, unknown>>

export const Dialog: React.FC<AnyProps> = ({ children, ...props }) => (
  <div {...props as any}>{children}</div>
)
export const DialogContent: React.FC<AnyProps> = ({ children, ...props }) => (
  <div {...props as any}>{children}</div>
)
export const DialogHeader: React.FC<AnyProps> = ({ children, ...props }) => (
  <div {...props as any}>{children}</div>
)
export const DialogTitle: React.FC<AnyProps> = ({ children, ...props }) => (
  <h2 {...props as any}>{children}</h2>
)
export const DialogDescription: React.FC<AnyProps> = ({ children, ...props }) => (
  <p {...props as any}>{children}</p>
)
export const DialogTrigger: React.FC<AnyProps> = ({ children, ...props }) => (
  <button type="button" {...props as any}>{children}</button>
)
export const DialogFooter: React.FC<AnyProps> = ({ children, ...props }) => (
  <div {...props as any}>{children}</div>
)
