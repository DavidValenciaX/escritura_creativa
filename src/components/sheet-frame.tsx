"use client";
import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { SHEET_WIDTH } from "@/lib/sheet-layout";

export function SheetFrame({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = frame.current!;
    let lastWidth = 0;
    let animation = 0;
    const update = () => {
      const width = element.clientWidth;
      if (width > 0 && width !== lastWidth && canvas.current) {
        lastWidth = width;
        canvas.current.style.zoom = String(Math.min(1, width / SHEET_WIDTH));
      }
    };
    update();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(animation);
      animation = requestAnimationFrame(update);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animation);
    };
  }, []);
  return (
    <div ref={frame} className={`sheet-frame ${className}`} style={style}>
      <div ref={canvas} className="sheet-canvas">
        {children}
      </div>
    </div>
  );
}

export function SheetField({
  value,
  onChange,
  label,
  className,
  disabled,
  maxLength,
  placeholder,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className: string;
  disabled?: boolean;
  maxLength: number;
  placeholder?: string;
  onBlur?: () => void;
}) {
  return (
    <div className={`sheet-field ${className}`}>
      <div className="sheet-field-measure" aria-hidden="true">
        {value || "\u00a0"}
        {value.endsWith("\n") ? "\u200b" : ""}
      </div>
      <textarea
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        onBlur={onBlur}
      />
    </div>
  );
}
