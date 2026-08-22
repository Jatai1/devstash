"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host, mounted once in the `(app)` layout.
 *
 * The generated component read the theme from `next-themes`, which this project
 * does not use: `src/app/layout.tsx` hard-codes `dark` on `<html>` and light
 * mode is not built yet. With no provider above it, `useTheme()` would have
 * fallen back to `"system"` and rendered a light toast over a dark page on any
 * machine set to a light OS theme. Hard-coding `dark` here keeps the toast
 * matched to the only theme the app ships; it becomes the seam to re-wire if a
 * theme switcher ever lands.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
