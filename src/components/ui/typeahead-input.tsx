"use client"

import * as React from "react"
import { Input } from "./input"

export interface TypeaheadInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  options: string[]
  value?: string
  onChange?: (value: string) => void
}

export function TypeaheadInput({
  options,
  value = "",
  onChange,
  ...props
}: TypeaheadInputProps) {
  const inputId = React.useId()
  const datalistId = `datalist-${inputId}`

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value)
  }

  return (
    <div className="relative">
      <Input
        {...props}
        value={value}
        onChange={handleChange}
        list={datalistId}
        autoComplete="off"
      />
      <datalist id={datalistId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  )
}
