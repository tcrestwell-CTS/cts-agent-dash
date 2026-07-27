import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AppModal — shared modal shell used across the app.
 * Scrim hsl(213 53% 11% / .55) with backdrop-blur(2px).
 * Panel: min(600px, 100%), max-height 92vh, radius 14px, --shadow-lg, entry 0.22s.
 * Sticky header + footer. On mobile it becomes a bottom sheet (radius 14px 14px 0 0).
 */

const AppModal = DialogPrimitive.Root;
const AppModalTrigger = DialogPrimitive.Trigger;
const AppModalClose = DialogPrimitive.Close;
const AppModalPortal = DialogPrimitive.Portal;

const AppModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      className,
    )}
    style={{ backgroundColor: "hsl(213 53% 11% / 0.55)" }}
    {...props}
  />
));
AppModalOverlay.displayName = "AppModalOverlay";

interface AppModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideClose?: boolean;
}

const AppModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  AppModalContentProps
>(({ className, children, hideClose, ...props }, ref) => (
  <AppModalPortal>
    <AppModalOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Mobile: bottom sheet
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] w-full flex-col overflow-hidden",
        "rounded-t-[14px] border border-border bg-card text-card-foreground shadow-lg",
        // Desktop: centered dialog
        "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
        "sm:w-full sm:max-w-[600px] sm:rounded-[14px]",
        // Animation ~0.22s
        "duration-200",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:slide-in-from-bottom-2",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-4 sm:data-[state=closed]:slide-out-to-bottom-2",
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </AppModalPortal>
));
AppModalContent.displayName = "AppModalContent";

const AppModalHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-card px-5 py-4",
        className,
      )}
      {...props}
    />
  ),
);
AppModalHeader.displayName = "AppModalHeader";

const AppModalTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[15.5px] font-semibold text-foreground", className)}
    {...props}
  />
));
AppModalTitle.displayName = "AppModalTitle";

const AppModalDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("mt-0.5 text-[12.5px] text-muted-foreground", className)}
    {...props}
  />
));
AppModalDescription.displayName = "AppModalDescription";

const AppModalBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 overflow-y-auto px-5 py-4", className)} {...props} />
  ),
);
AppModalBody.displayName = "AppModalBody";

const AppModalFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-3",
        className,
      )}
      {...props}
    />
  ),
);
AppModalFooter.displayName = "AppModalFooter";

export {
  AppModal,
  AppModalTrigger,
  AppModalClose,
  AppModalPortal,
  AppModalOverlay,
  AppModalContent,
  AppModalHeader,
  AppModalTitle,
  AppModalDescription,
  AppModalBody,
  AppModalFooter,
};