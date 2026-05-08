import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { MarketingImageAsset } from "@/hooks/useImageAssets";

interface Props {
  assets: MarketingImageAsset[];
  onDelete?: (a: MarketingImageAsset) => void;
  onSelect?: (a: MarketingImageAsset) => void;
  selectMode?: boolean;
}

export function ImageGrid({ assets, onDelete, onSelect, selectMode }: Props) {
  if (!assets.length) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        No images yet. Upload some to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {assets.map((a) => (
        <div
          key={a.id}
          className="group relative border rounded-lg overflow-hidden bg-muted"
        >
          <div className="aspect-square bg-background flex items-center justify-center overflow-hidden">
            <img
              src={a.public_url}
              alt={a.alt_text ?? a.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="p-2 space-y-1">
            <p className="text-xs font-medium truncate" title={a.filename}>
              {a.filename}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {a.width && a.height ? `${a.width}×${a.height}` : ""}
              {a.size_bytes ? ` · ${Math.round(a.size_bytes / 1024)}KB` : ""}
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-background/95 backdrop-blur p-2 flex gap-1 translate-y-full group-hover:translate-y-0 transition-transform">
            {selectMode ? (
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => onSelect?.(a)}
              >
                Insert
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 h-7 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(a.public_url);
                    toast.success("URL copied");
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" /> URL
                </Button>
                {onDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 w-7 p-0"
                    onClick={() => onDelete(a)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}