"use client"

import * as React from "react"
import Autosuggest from "react-autosuggest"
import { cn } from "@/lib/utils"

interface BrandAutosuggestProps {
  suggestions: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function BrandAutosuggest({
  suggestions,
  value,
  onChange,
  placeholder,
  className
}: BrandAutosuggestProps) {
  const [inputValue, setInputValue] = React.useState(value)
  const [filteredSuggestions, setFilteredSuggestions] = React.useState<string[]>([])

  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  const getSuggestions = (value: string) => {
    const inputValue = value.trim().toLowerCase()
    const inputLength = inputValue.length

    return inputLength === 0
      ? []
      : suggestions.filter(suggestion =>
          suggestion.toLowerCase().startsWith(inputValue)
        )
  }

  const onSuggestionsFetchRequested = ({ value }: { value: string }) => {
    setFilteredSuggestions(getSuggestions(value))
  }

  const onSuggestionsClearRequested = () => {
    setFilteredSuggestions([])
  }

  const onSuggestionSelected = (
    _event: React.FormEvent,
    { suggestionValue }: { suggestionValue: string }
  ) => {
    onChange(suggestionValue)
  }

  const inputProps = {
    placeholder,
    value: inputValue,
    onChange: (_: React.FormEvent, { newValue }: { newValue: string }) => {
      setInputValue(newValue)
      onChange(newValue)
    },
    className: cn(
      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )
  }

  const renderSuggestion = (suggestion: string) => (
    <div className="px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
      {suggestion}
    </div>
  )

  return (
    <Autosuggest
      suggestions={filteredSuggestions}
      onSuggestionsFetchRequested={onSuggestionsFetchRequested}
      onSuggestionsClearRequested={onSuggestionsClearRequested}
      onSuggestionSelected={onSuggestionSelected}
      getSuggestionValue={(suggestion) => suggestion}
      renderSuggestion={renderSuggestion}
      inputProps={inputProps}
      theme={{
        container: "relative w-full",
        suggestionsContainer: "absolute z-50 w-full mt-1",
        suggestionsContainerOpen: "block",
        suggestionsList: "max-h-[200px] overflow-auto rounded-md border bg-popover p-0 text-popover-foreground shadow-md",
        suggestion: "cursor-default",
        suggestionHighlighted: "bg-accent"
      }}
    />
  )
}
