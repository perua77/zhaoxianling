"use client";

import { cn } from "@/lib/utils";
import React, { useState, useContext, createContext, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface SelectContextValue {
  value: string | undefined;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLabel: ReactNode | null;
  disabled: boolean;
}

const SelectContext = createContext<SelectContextValue | null>(null);

interface SelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}

interface SelectTriggerProps {
  className?: string;
  id?: string;
  children: ReactNode;
}

interface SelectContentProps {
  children: ReactNode;
}

interface SelectItemProps {
  value: string;
  children: ReactNode;
}

interface SelectValueProps {
  placeholder?: string;
}

export function Select({
  value,
  onValueChange,
  className,
  disabled = false,
  children,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [open]);

  const findSelectedLabel = (): ReactNode | null => {
    if (!value) return null;
    let selectedLabel: ReactNode | null = null;

    const searchInChildren = (nodes: ReactNode): void => {
      if (selectedLabel) return;
      React.Children.forEach(nodes, (child) => {
        if (selectedLabel) return;
        if (React.isValidElement(child)) {
          if (child.type === SelectContent) {
            searchInChildren((child as React.ReactElement).props.children);
          } else if (child.type === SelectItem) {
            const itemProps = child.props as SelectItemProps;
            if (itemProps.value === value) {
              selectedLabel = itemProps.children;
            }
          }
        }
      });
    };

    searchInChildren(children);
    return selectedLabel;
  };

  const selectedLabel = findSelectedLabel();

  const triggerChild = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === SelectTrigger) {
      return React.cloneElement(child as React.ReactElement, { ref: triggerRef });
    }
    return null;
  });

  return (
    <div className={cn("relative", className)}>
      <SelectContext.Provider value={{ value, onValueChange, open, setOpen, selectedLabel, disabled }}>
        {triggerChild}
        {open && !disabled && (
          <div
            ref={contentRef}
            className={cn(
              "absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-background py-1 shadow-md"
            )}
          >
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child) && child.type === SelectContent) {
                return child;
              }
              return null;
            })}
          </div>
        )}
      </SelectContext.Provider>
    </div>
  );
}

export function SelectTrigger({ className, id, children }: SelectTriggerProps) {
  const context = useContext(SelectContext);
  if (!context) return null;

  const { open, setOpen, selectedLabel, disabled } = context;

  const renderChildren = () => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === SelectValue) {
        const placeholder = (child.props as SelectValueProps).placeholder;
        return (
          <span className="flex-1 text-left">
            {selectedLabel || placeholder}
          </span>
        );
      }
      return child;
    });
  };

  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      onClick={() => !disabled && setOpen(!open)}
      className={cn(
        "flex h-11 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-sm text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent",
        "hover:border-brand-green/30",
        disabled && "cursor-not-allowed opacity-50 hover:border-border",
        className
      )}
    >
      {renderChildren()}
      <ChevronDown
        size={16}
        className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
      />
    </button>
  );
}

export function SelectContent({ children }: SelectContentProps) {
  return (
    <React.Fragment>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === SelectItem) {
          return child;
        }
        return null;
      })}
    </React.Fragment>
  );
}

export function SelectItem({ value, children }: SelectItemProps) {
  const context = useContext(SelectContext);
  if (!context) return null;

  const { onValueChange, setOpen } = context;

  const handleClick = () => {
    onValueChange(value);
    setOpen(false);
  };

  return (
    <button
      onClick={handleClick}
      value={value}
      className={cn(
        "flex w-full items-center px-3 py-2 text-sm text-foreground",
        "hover:bg-brand-green/10 active:bg-brand-green/15",
        "focus:outline-none focus:bg-brand-green/10"
      )}
    >
      {children}
    </button>
  );
}

export function SelectValue({ placeholder }: SelectValueProps) {
  return <span className={cn("flex-1 text-left", "placeholder:text-muted-foreground")}>{placeholder}</span>;
}