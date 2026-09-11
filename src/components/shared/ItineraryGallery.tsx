import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

export interface GalleryImage {
  url: string;
  caption?: string;
}

/** Accepts a string or {url, caption} and normalizes to GalleryImage. */
function toGalleryImage(u: any): GalleryImage | null {
  if (typeof u === "string" && u.trim()) return { url: u };
  if (u && typeof u === "object" && typeof u.url === "string" && u.url.trim()) {
    return { url: u.url, caption: typeof u.caption === "string" && u.caption.trim() ? u.caption : undefined };
  }
  return null;
}

/** Normalizes an itinerary item's images into an ordered, de-duplicated list (with optional captions). */
export function getItemImages(item: any): GalleryImage[] {
  const raw = item?.gallery_urls;
  const gallery: GalleryImage[] = Array.isArray(raw)
    ? raw.map(toGalleryImage).filter((g): g is GalleryImage => !!g)
    : [];
  const all = [toGalleryImage(item?.image_url), ...gallery].filter(
    (g): g is GalleryImage => !!g
  );
  const seen = new Set<string>();
  return all.filter((g) => (seen.has(g.url) ? false : (seen.add(g.url), true)));
}

interface Props {
  images: GalleryImage[];
  alt?: string;
  className?: string;
  /** aspect ratio class for each slide */
  aspectClassName?: string;
}

function CaptionOverlay({ caption }: { caption?: string }) {
  if (!caption) return null;
  return (
    <span className="absolute bottom-2 left-2 max-w-[75%] rounded-md bg-background/85 px-2 py-1 text-[11px] font-medium text-foreground backdrop-blur">
      {caption}
    </span>
  );
}

/** Carousel gallery for itinerary item photos with optional captions. Renders a plain image when there's only one. */
export function ItineraryGallery({ images, alt = "", className, aspectClassName = "aspect-[16/9]" }: Props) {
  if (!images.length) return null;

  if (images.length === 1) {
    return (
      <div className={`relative overflow-hidden rounded-lg border ${className || ""}`}>
        <img src={images[0].url} alt={images[0].caption || alt} loading="lazy" className={`w-full object-cover ${aspectClassName}`} />
        <CaptionOverlay caption={images[0].caption} />
      </div>
    );
  }

  return (
    <div className={`relative ${className || ""}`}>
      <Carousel className="w-full" opts={{ loop: true }}>
        <CarouselContent>
          {images.map((img, i) => (
            <CarouselItem key={`${img.url}-${i}`}>
              <div className="relative overflow-hidden rounded-lg border">
                <img
                  src={img.url}
                  alt={img.caption || (alt ? `${alt} — photo ${i + 1}` : `Photo ${i + 1}`)}
                  loading="lazy"
                  className={`w-full object-cover ${aspectClassName}`}
                />
                <CaptionOverlay caption={img.caption} />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2 h-7 w-7" />
        <CarouselNext className="right-2 h-7 w-7" />
      </Carousel>
      <span className="absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
        {images.length} photos
      </span>
    </div>
  );
}
