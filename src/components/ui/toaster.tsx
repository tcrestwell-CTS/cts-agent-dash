import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = variant === "destructive" ? AlertTriangle : CheckCircle2;
        return (
          <Toast key={id} variant={variant} {...props}>
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: variant === "destructive" ? "hsl(var(--destructive-foreground) / .25)" : "hsl(var(--accent))" }}
            >
              <Icon className="h-3 w-3" style={{ color: variant === "destructive" ? "currentColor" : "hsl(var(--primary))" }} />
            </span>
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
