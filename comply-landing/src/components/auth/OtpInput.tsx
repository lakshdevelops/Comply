"use client";

import { useRef, useState, ClipboardEvent, KeyboardEvent } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export default function OtpInput({
  value,
  onChange,
  error,
  disabled = false,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const update = (index: number, char: string) => {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join(""));
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKey = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        update(index, "");
      } else if (index > 0) {
        update(index - 1, "");
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-2.5">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(-1);
              update(i, v);
            }}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`h-14 w-12 rounded-xl border text-center text-xl font-bold text-dust-grey-950 outline-none transition-all duration-150 bg-white
              ${error
                ? "border-red-400 ring-1 ring-red-300"
                : digit
                  ? "border-hunter-green-500 ring-1 ring-hunter-green-300"
                  : "border-dust-grey-300 focus:border-hunter-green-500 focus:ring-1 focus:ring-hunter-green-400"
              }
              disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        ))}
      </div>
      {error && (
        <p className="text-center text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
