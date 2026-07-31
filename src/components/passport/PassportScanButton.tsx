import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ScanLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export interface ParsedPassport {
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  passport_full_name: string | null;
  passport_number: string | null;
  passport_nationality: string | null;
  passport_issuing_country: string | null;
  passport_date_of_birth: string | null;
  passport_expiry: string | null;
  passport_sex: string | null;
}

interface PassportScanButtonProps {
  /** Extra headers (portal JWT / legacy portal token) for the edge function call. */
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  /** Token-based flow (public "complete your profile" link). */
  updateToken?: string;
  onParsed: (parsed: ParsedPassport) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

export default function PassportScanButton({
  getHeaders,
  updateToken,
  onParsed,
}: PassportScanButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);

  const handleFile = async (file: File) => {
    setScanning(true);
    try {
      const image = await fileToBase64(file);
      const extra = getHeaders ? await getHeaders() : {};
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-passport`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
            ...extra,
          },
          body: JSON.stringify({ image, updateToken }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not scan that passport");
      onParsed(data.parsed as ParsedPassport);
      toast.success("Passport scanned — please review each field before saving");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not scan that passport");
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={scanning}
          onClick={() => inputRef.current?.click()}
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ScanLine className="h-4 w-4 mr-2" />
          )}
          {scanning ? "Reading passport…" : "Scan passport"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Photograph the passport information page.
        </p>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-xs">
          The photo is read once and never stored. Scanned values are filled in below
          for you to review — nothing is saved until you save the form.
        </AlertDescription>
      </Alert>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}