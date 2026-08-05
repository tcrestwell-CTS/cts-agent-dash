import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

/** Normalizes an itinerary item's images into an ordered, de-duplicated list. */
export function getItemImages(item: any): string[] {
  const raw = item?.gallery_urls;
  const gallery: string[] = Array.isArray(raw)
    ? raw.filter((u: any) => typeof u === "string" && u.trim())
    : [];
  const all = [item?.image_url, ...gallery].filter(
    (u: any): u is string => typeof u === "string" && !!u.trim()
  );
  return Array.from(new Set(all));
}

interface Props {
  images: string[];
  alt?: string;
  className?: string;
  /** aspect ratio class for each slide */
  aspectClassName?: string;
}

/** Simple carousel gallery for itinerary item photos. Renders a plain image when there's only one. */
export function ItineraryGallery({ images, alt = "", className, aspectClassName = "aspect-[16/9]" }: Props) {
  if (!images.length) return null;

  if (images.length === 1) {
    return (
      <div className={`overflow-hidden rounded-lg border ${className || ""}`}>
        <img src={images[0]} alt={alt} loading="lazy" className={`w-full object-cover ${aspectClassName}`} />
      </div>
    );
  }

  return (
    <div className={`relative ${className || ""}`}>
      <Carousel className="w-full" opts={{ loop: true }}>
        <CarouselContent>
          {images.map((url, i) => (
            <CarouselItem key={`${url}-${i}`}>
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={url}
                  alt={alt ? `${alt} — photo ${i + 1}` : `Photo ${i + 1}`}
                  loading="lazy"
                  className={`w-full object-cover ${aspectClassName}`}
                />
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
