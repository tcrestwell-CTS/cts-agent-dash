/**
 * Public stock imagery used for the rotating hero banner on agent storefronts.
 * Files live in the public `logos` storage bucket under `stock/`, so they are
 * served the same way as agent storefront logos and avatars.
 */
const BASE =
  "https://zbtnulzvwreqzbmxulpv.supabase.co/storage/v1/object/public/logos/stock";

export interface StorefrontStockImage {
  url: string;
  alt: string;
}

export const STOREFRONT_STOCK_IMAGES: StorefrontStockImage[] = [
  { url: `${BASE}/stock-image_1.jpg`, alt: "Aerial view of a Caribbean marina resort at golden hour" },
  { url: `${BASE}/stock-image_2.jpg`, alt: "Colorful cliffside village on the Italian coast" },
  { url: `${BASE}/stock-image_3.jpg`, alt: "Ornate temple spires in Bangkok, Thailand" },
  { url: `${BASE}/stock-image_4.jpg`, alt: "Yacht anchored below the Temple of Poseidon in Greece" },
  { url: `${BASE}/stock-image_5.jpg`, alt: "Family taking a photo at the Arc de Triomphe in Paris" },
];