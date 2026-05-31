import type { HTMLAttributes, ReactNode } from "react";

export function Badge({ children, color = "default", className = "", ...props }: {
  children: ReactNode;
  color?: "default" | "success" | "danger" | "warning";
  className?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  const colorMap = {
    default: "bg-gray-100 text-gray-800 border-gray-300",
    success: "bg-green-100 text-green-700 border-green-300",
    danger: "bg-red-100 text-red-700 border-red-300",
    warning: "bg-orange-100 text-orange-700 border-orange-300",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${colorMap[color] || colorMap.default} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
