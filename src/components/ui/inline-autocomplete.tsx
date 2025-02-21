"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InlineAutocompleteProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  options: string[]
  value?: string
  onChange?: (value: string) => void
}

export function InlineAutocomplete({
  options,
  value = "",
  onChange,
  className,
  ...props
}: InlineAutocompleteProps) {
  const [suggestion, setSuggestion] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const ghostRef = React.useRef<HTMLInputElement>(null)

  const updateSuggestion = (inputValue: string) => {
    if (!inputValue) {
      setSuggestion("")
      return
    }

    const match = options.find(
      (option) =>
        option.toLowerCase().startsWith(inputValue.toLowerCase()) &&
        option.length > inputValue.length
    )

    setSuggestion(match || "")
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange?.(newValue)
    updateSuggestion(newValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" && suggestion) {
      e.preventDefault()
      const newValue = suggestion
      onChange?.(newValue)
      updateSuggestion(newValue)
    }
  }

  return (
    <div className="relative">
      {/* Ghost input showing the suggestion */}
      <input
        ref={ghostRef}
        type="text"
        className={cn(
          "absolute inset-0 text-muted-foreground bg-transparent pointer-events-none",
          className
        )}
        value={suggestion}
        readOnly
        {...props}
      />
      {/* Actual input */}
      <input
        ref={inputRef}
        type="text"
        className={cn(
          "absolute inset-0 bg-transparent",
          className
        )}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />
    </div>
  )
}
