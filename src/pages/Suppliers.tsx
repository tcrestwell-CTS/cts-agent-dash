import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierCard } from "@/components/suppliers/SupplierCard";
import { SupplierNotesDialog } from "@/components/suppliers/SupplierNotesDialog";
import { QuickBookingDialog } from "@/components/suppliers/QuickBookingDialog";
import { Plane, Ship, Hotel, Car, Palmtree, ExternalLink } from "lucide-react";

export type IntegrationType = "api" | "redirect" | "hybrid";

export interface Supplier {
  id: string;
  name: string;
  url: string;
  logo?: string;
  description: string;
  category: "flights" | "cruises" | "hotels" | "transportation" | "all-inclusive";
  isFavorite: boolean;
  notes: string;
  lastVisited?: Date;
  visitCount: number;
  integrationType: IntegrationType;
  apiStatus?: "available" | "coming_soon" | "none";
}

const initialSuppliers: Supplier[] = [
  // Flights
  {
    id: "centrav",
    name: "Centrav",
    url: "https://www.centrav.com",
    description: "Centrav consolidator portal for discounted international airfare.",
    category: "flights",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "skybird-travel",
    name: "Skybird Travel",
    url: "https://crestwelltravelservices.mywingsbooking.com/agent-login",
    description: "Skybird Travel MyWings portal for flight bookings and consolidator fares.",
    category: "flights",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  // Cruises
  {
    id: "cruisingpower",
    name: "CruisingPower",
    url: "https://www.cruisingpower.com",
    description: "Royal Caribbean's travel agent booking portal for cruise reservations and training.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "princess-cruises",
    name: "Princess Cruises",
    url: "https://www.onesourcecruises.com/onesource/login",
    description: "Princess Cruises agent portal via OneSource for cruise bookings.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "carnival",
    name: "Carnival GoCCL",
    url: "https://www.goccl.com",
    description: "Carnival Cruise Line's travel agent booking and resource center.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "ncl",
    name: "NCL Central",
    url: "https://norwegiancentral.com",
    description: "Norwegian Cruise Line's travel partner portal.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "virgin-voyages",
    name: "Virgin Voyages",
    url: "https://myfirstmates.com",
    description: "Virgin Voyages First Mates agent portal for cruise bookings.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "traveltek",
    name: "Traveltek Cruise API",
    url: "https://www.traveltek.com/travel-api-provider/cruise-api/",
    description: "Third-party API aggregator with access to multiple cruise lines. Contact for API access.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "api",
    apiStatus: "coming_soon",
  },
  // All-Inclusive Resorts
  {
    id: "sandals",
    name: "Sandals & Beaches",
    url: "https://www.sandals.com/travel-agents/",
    description: "Sandals and Beaches Resorts travel agent portal for all-inclusive Caribbean bookings.",
    category: "all-inclusive",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "amresorts",
    name: "AMResorts",
    url: "https://agents.amresorts.com",
    description: "AMResorts agent portal for Dreams, Secrets, Breathless, and other luxury all-inclusive brands.",
    category: "all-inclusive",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "palace-resorts",
    name: "Palace Resorts",
    url: "https://www.palaceproagent.com",
    description: "Palace Resorts Pro Agent portal for Moon Palace, Le Blanc, and other luxury properties.",
    category: "all-inclusive",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "all-in-agents",
    name: "All In Agents",
    url: "https://www.allinagents.com",
    description: "All In Agents portal powered by AIA for booking multiple all-inclusive resort brands.",
    category: "all-inclusive",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  // Transportation
  {
    id: "carey",
    name: "Carey International",
    url: "https://www.carey.com",
    description: "Carey International luxury chauffeured transportation and ground services worldwide.",
    category: "transportation",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "carmel",
    name: "Carmel",
    url: "https://www.carmellimo.com",
    description: "Carmel limousine and car service for airport transfers and ground transportation.",
    category: "transportation",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "welcome-pickups",
    name: "Welcome Pickups",
    url: "https://www.welcomepickups.com",
    description: "Welcome Pickups airport transfers and personalized travel experiences worldwide.",
    category: "transportation",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "moveo",
    name: "Moveo",
    url: "https://www.moveogroup.com",
    description: "Moveo ground transportation and transfer services for travelers.",
    category: "transportation",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
];

const categories = [
  { id: "all", label: "All Suppliers", icon: ExternalLink },
  { id: "flights", label: "Flights", icon: Plane },
  { id: "cruises", label: "Cruises", icon: Ship },
  { id: "hotels", label: "Hotels", icon: Hotel },
  { id: "transportation", label: "Transportation", icon: Car },
  { id: "all-inclusive", label: "All-Inclusive", icon: Palmtree },
];

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [quickBookDialogOpen, setQuickBookDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const filteredSuppliers = selectedCategory === "all" 
    ? suppliers 
    : suppliers.filter(s => s.category === selectedCategory);

  const favoriteSuppliers = suppliers.filter(s => s.isFavorite);

  const handleToggleFavorite = (id: string) => {
    setSuppliers(prev => 
      prev.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s)
    );
  };

  const handleOpenSite = (supplier: Supplier) => {
    setSuppliers(prev =>
      prev.map(s => 
        s.id === supplier.id 
          ? { ...s, lastVisited: new Date(), visitCount: s.visitCount + 1 }
          : s
      )
    );
    window.open(supplier.url, "_blank", "noopener,noreferrer");
  };

  const handleOpenNotes = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = (id: string, notes: string) => {
    setSuppliers(prev =>
      prev.map(s => s.id === id ? { ...s, notes } : s)
    );
    setNotesDialogOpen(false);
  };

  const handleQuickBook = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setQuickBookDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Supplier Directory</h1>
          <p className="text-muted-foreground mt-1">
            Quick access to booking portals with notes and usage tracking
          </p>
        </div>

        {/* Favorites Section */}
        {favoriteSuppliers.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              ⭐ Quick Access
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {favoriteSuppliers.map(supplier => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  onToggleFavorite={handleToggleFavorite}
                  onOpenSite={handleOpenSite}
                  onOpenNotes={handleOpenNotes}
                  compact
                />
              ))}
            </div>
          </div>
        )}

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
            {categories.map(category => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-lg border border-border"
              >
                <category.icon className="h-4 w-4 mr-2" />
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-6">
            {filteredSuppliers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No suppliers in this category yet.</p>
                <p className="text-sm mt-1">More suppliers coming soon!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSuppliers.map(supplier => (
                  <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    onToggleFavorite={handleToggleFavorite}
                    onOpenSite={handleOpenSite}
                    onOpenNotes={handleOpenNotes}
                    onQuickBook={handleQuickBook}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Notes Dialog */}
      <SupplierNotesDialog
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        supplier={selectedSupplier}
        onSave={handleSaveNotes}
      />

      {/* Quick Booking Dialog */}
      <QuickBookingDialog
        open={quickBookDialogOpen}
        onOpenChange={setQuickBookDialogOpen}
        supplier={selectedSupplier}
      />
    </DashboardLayout>
  );
}
