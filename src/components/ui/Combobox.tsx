"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, User, Phone, Mail, X } from "lucide-react";

export interface ComboboxItem {
  value: string;
  label: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string, item?: ComboboxItem) => void;
  items: ComboboxItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  showDetails?: boolean;
  emptyMessage?: string;
}

export function Combobox({
  value,
  onValueChange,
  items,
  placeholder = "请选择",
  searchPlaceholder = "搜索...",
  className,
  disabled = false,
  showDetails = true,
  emptyMessage = "暂无可选项",
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((item) => item.value === value);

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setShowDetailOnMobile(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (item: ComboboxItem) => {
    onValueChange(item.value, item);
    setIsOpen(false);
    setSearchQuery("");
    setShowDetailOnMobile(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-all",
          "focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent",
          "hover:border-brand-green/30",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className={cn("flex-1 text-left", !selectedItem && "text-muted-foreground")}>
          {selectedItem ? selectedItem.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn("text-muted-foreground transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          <div className="flex items-center border-b border-border px-3 py-2">
            <Search size={16} className="mr-2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="ml-2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-auto py-1">
            {filteredItems.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {searchQuery ? "未找到匹配项" : emptyMessage}
              </div>
            ) : (
              filteredItems.map((item, index) => (
                <div
                  key={item.value}
                  className={cn(
                    "relative",
                    hoveredIndex === index && "bg-brand-green/5"
                  )}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "flex w-full items-center px-3 py-2 text-left text-sm transition-colors",
                      "hover:bg-brand-green/10",
                      item.value === value && "bg-brand-green/10 text-brand-green",
                    )}
                  >
                    {item.label}
                  </button>

                  {/* 桌面端：hover 显示详情气泡 */}
                  {showDetails && (
                    <div
                      className="pointer-events-none absolute left-full top-0 z-10 ml-2 hidden w-48 rounded-lg border border-border bg-background p-3 shadow-lg md:block"
                      style={{
                        opacity: hoveredIndex === index ? 1 : 0,
                        visibility: hoveredIndex === index ? "visible" : "hidden",
                        transition: "opacity 150ms",
                      }}
                    >
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 text-foreground">
                          <User size={12} className="text-muted-foreground" />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {item.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone size={12} />
                            <span>{item.phone}</span>
                          </div>
                        )}
                        {item.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail size={12} />
                            <span className="truncate">{item.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 移动端：点击显示详情 */}
                  {showDetails && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetailOnMobile(showDetailOnMobile ? false : true);
                      }}
                      className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      <User size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 移动端选中后显示详情 */}
          {selectedItem && showDetails && (
            <div className="border-t border-border bg-muted/50 px-3 py-2 md:hidden">
              <div className="flex items-center gap-2 text-xs">
                {selectedItem.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone size={12} />
                    {selectedItem.phone}
                  </span>
                )}
                {selectedItem.email && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail size={12} />
                    {selectedItem.email}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
