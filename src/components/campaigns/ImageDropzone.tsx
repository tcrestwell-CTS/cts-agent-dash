import { useDropzone } from "react-dropzone";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onDrop: (files: File[]) => void;
  isUploading?: boolean;
  compact?: boolean;
}

export function ImageDropzone({ onDrop, isUploading, compact }: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
        compact ? "p-4" : "p-10",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
        isUploading && "opacity-50 cursor-not-allowed",
      )}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <Loader2 className={cn("animate-spin text-primary", compact ? "h-5 w-5" : "h-8 w-8")} />
      ) : (
        <Upload className={cn("text-muted-foreground", compact ? "h-5 w-5" : "h-8 w-8")} />
      )}
      {!compact && (
        <>
          <p className="mt-3 text-sm font-medium">
            {isDragActive ? "Drop images here" : "Drag images here or click to browse"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, GIF, WebP — multiple files allowed</p>
        </>
      )}
      {compact && (
        <p className="mt-2 text-xs text-muted-foreground">
          {isDragActive ? "Drop here" : "Drag or click to upload"}
        </p>
      )}
    </div>
  );
}