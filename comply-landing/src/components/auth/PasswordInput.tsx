"use client";

import { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    const [show, setShow] = useState(false);

    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-dust-grey-800">{label}</label>
        <div className="relative">
          <input
            ref={ref}
            type={show ? "text" : "password"}
            className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm text-dust-grey-950 placeholder-dust-grey-400 outline-none transition-all duration-150
              bg-white
              ${error
                ? "border-red-400 ring-1 ring-red-300 focus:border-red-400 focus:ring-red-300"
                : "border-dust-grey-300 focus:border-hunter-green-500 focus:ring-1 focus:ring-hunter-green-400"
              }
              ${className}`}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dust-grey-400 hover:text-dust-grey-700 transition-colors"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-0.5">{error}</p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
export default PasswordInput;
