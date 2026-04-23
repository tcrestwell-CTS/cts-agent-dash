import { Anchor, Phone } from "lucide-react";

export function CruiseSearchHeader() {
  return (
    <div className="flex items-center justify-between border-b pb-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
          <Anchor className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cruise Search</h1>
          <p className="text-xs text-muted-foreground">Powered by Crestwell Travel Network</p>
        </div>
      </div>
      <a
        href="tel:+18889999999"
        className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Phone className="h-4 w-4" />
        <span>Need help? Call your advisor</span>
      </a>
    </div>
  );
}