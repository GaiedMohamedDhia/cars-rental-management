import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`px-4 py-2 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 shadow ${className}`}
      {...props}
    />
  )
);
Button.displayName = "Button";

export default Button;
