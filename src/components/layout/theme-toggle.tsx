"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  function toggle() {
    const isDarkNow = document.documentElement.classList.contains("dark");
    const next = isDarkNow ? "light" : "dark";
    localStorage.setItem("gfsuite-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Design umschalten">
      <Sun className="size-4 scale-100 dark:scale-0" />
      <Moon className="absolute size-4 scale-0 dark:scale-100" />
    </Button>
  );
}
