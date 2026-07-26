import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/patterns/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useCreateClient } from "@/hooks/useClients";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    // Personal Information
    title: "",
    first_name: "",
    last_name: "",
    preferred_first_name: "",
    birthday: "",
    anniversary: "",
    // Contact Information
    email: "",
    secondary_email: "",
    phone: "",
    secondary_phone: "",
    // Address
    address_line_1: "",
    address_line_2: "",
    address_city: "",
    address_state: "",
    address_zip_code: "",
    address_country: "",
    // Travel IDs
    redress_number: "",
    known_traveler_number: "",
    passport_info: "",
    // Preferences
    activities_interests: "",
    food_drink_allergies: "",
    // Travel Preferences
    flight_seating_preference: "",
    flight_bulkhead_preference: "",
    lodging_floor_preference: "",
    lodging_elevator_preference: "",
    cruise_cabin_floor_preference: "",
    cruise_cabin_location_preference: "",
    // Other
    loyalty_programs: "",
    tags: "",
    status: "lead",
    lead_source: "",
    notes: "",
  });

  const createClient = useCreateClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = `${formData.first_name} ${formData.last_name}`.trim();
    if (!name) return;

    await createClient.mutateAsync({
      name,
      title: formData.title || null,
      first_name: formData.first_name || null,
      last_name: formData.last_name || null,
      preferred_first_name: formData.preferred_first_name || null,
      birthday: formData.birthday || null,
      anniversary: formData.anniversary || null,
      email: formData.email || null,
      secondary_email: formData.secondary_email || null,
      phone: formData.phone || null,
      secondary_phone: formData.secondary_phone || null,
      address_line_1: formData.address_line_1 || null,
      address_line_2: formData.address_line_2 || null,
      address_city: formData.address_city || null,
      address_state: formData.address_state || null,
      address_zip_code: formData.address_zip_code || null,
      address_country: formData.address_country || null,
      redress_number: formData.redress_number || null,
      known_traveler_number: formData.known_traveler_number || null,
      passport_info: formData.passport_info || null,
      activities_interests: formData.activities_interests || null,
      food_drink_allergies: formData.food_drink_allergies || null,
      flight_seating_preference: formData.flight_seating_preference || null,
      flight_bulkhead_preference: formData.flight_bulkhead_preference || null,
      lodging_floor_preference: formData.lodging_floor_preference || null,
      lodging_elevator_preference: formData.lodging_elevator_preference || null,
      cruise_cabin_floor_preference: formData.cruise_cabin_floor_preference || null,
      cruise_cabin_location_preference: formData.cruise_cabin_location_preference || null,
      loyalty_programs: formData.loyalty_programs || null,
      tags: formData.tags || null,
      status: formData.status,
      lead_source: formData.lead_source || null,
      notes: formData.notes || null,
      location: formData.address_city && formData.address_state
        ? `${formData.address_city}, ${formData.address_state}`
        : null,
    });

    setFormData({
      title: "",
      first_name: "",
      last_name: "",
      preferred_first_name: "",
      birthday: "",
      anniversary: "",
      email: "",
      secondary_email: "",
      phone: "",
      secondary_phone: "",
      address_line_1: "",
      address_line_2: "",
      address_city: "",
      address_state: "",
      address_zip_code: "",
      address_country: "",
      redress_number: "",
      known_traveler_number: "",
      passport_info: "",
      activities_interests: "",
      food_drink_allergies: "",
      flight_seating_preference: "",
      flight_bulkhead_preference: "",
      lodging_floor_preference: "",
      lodging_elevator_preference: "",
      cruise_cabin_floor_preference: "",
      cruise_cabin_location_preference: "",
      loyalty_programs: "",
      tags: "",
      status: "lead",
      lead_source: "",
      notes: "",
    });
    setOpen(false);
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button className="gap-2 rounded-[8px] text-[13px]">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </ModalTrigger>
      <ModalContent className="sm:w-[min(720px,100%)]">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ModalHeader>
            <ModalTitle>Add New Client</ModalTitle>
            <ModalDescription>
              Add a new client to your contacts with their travel profile.
            </ModalDescription>
          </ModalHeader>

          <ModalBody className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <Tabs defaultValue="personal" className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="border-b border-border px-[17px] py-[11px]">
                <TabsList className="grid h-auto w-full grid-cols-5 gap-1 rounded-[9px] bg-muted p-1">
                  <TabsTrigger value="personal" className="rounded-[7px] py-[7px] text-[12.5px]">
                    Personal
                  </TabsTrigger>
                  <TabsTrigger value="contact" className="rounded-[7px] py-[7px] text-[12.5px]">
                    Contact
                  </TabsTrigger>
                  <TabsTrigger value="travel-ids" className="rounded-[7px] py-[7px] text-[12.5px]">
                    Travel IDs
                  </TabsTrigger>
                  <TabsTrigger value="preferences" className="rounded-[7px] py-[7px] text-[12.5px]">
                    Preferences
                  </TabsTrigger>
                  <TabsTrigger value="other" className="rounded-[7px] py-[7px] text-[12.5px]">
                    Other
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="px-[17px] py-[14px]">
                  {/* Personal Information Tab */}
                  <TabsContent value="personal" className="mt-0 space-y-[14px]">
                    <div className="grid grid-cols-4 gap-[11px]">
                      <div className="grid gap-2">
                        <Label htmlFor="title" className="text-[12.5px]">Title</Label>
                        <Select
                          value={formData.title}
                          onValueChange={(value) => updateField("title", value)}
                        >
                          <SelectTrigger className="h-9 rounded-[8px] text-[13.5px]">
                            <SelectValue placeholder="Title" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mr.">Mr.</SelectItem>
                            <SelectItem value="Mrs.">Mrs.</SelectItem>
                            <SelectItem value="Ms.">Ms.</SelectItem>
                            <SelectItem value="Dr.">Dr.</SelectItem>
                            <SelectItem value="Mx.">Mx.</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="first_name" className="text-[12.5px]">First Name *</Label>
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) => updateField("first_name", e.target.value)}
                          placeholder="John"
                          required
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                      <div className="col-span-2 grid gap-2">
                        <Label htmlFor="last_name" className="text-[12.5px]">Last Name *</Label>
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) => updateField("last_name", e.target.value)}
                          placeholder="Doe"
                          required
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="preferred_first_name" className="text-[12.5px]">Preferred First Name</Label>
                      <Input
                        id="preferred_first_name"
                        value={formData.preferred_first_name}
                        onChange={(e) => updateField("preferred_first_name", e.target.value)}
                        placeholder="Johnny"
                        className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-[11px]">
                      <div className="grid gap-2">
                        <Label htmlFor="birthday" className="text-[12.5px]">Birthday</Label>
                        <Input
                          id="birthday"
                          type="date"
                          value={formData.birthday}
                          onChange={(e) => updateField("birthday", e.target.value)}
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="anniversary" className="text-[12.5px]">Anniversary</Label>
                        <Input
                          id="anniversary"
                          type="date"
                          value={formData.anniversary}
                          onChange={(e) => updateField("anniversary", e.target.value)}
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="status" className="text-[12.5px]">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => updateField("status", value)}
                      >
                        <SelectTrigger className="h-9 rounded-[8px] text-[13.5px]">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  {/* Contact Information Tab */}
                  <TabsContent value="contact" className="mt-0 space-y-[14px]">
                    <div className="space-y-[14px]">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Email Addresses</h4>
                      <div className="grid gap-2">
                        <Label htmlFor="email" className="text-[12.5px]">Primary Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => updateField("email", e.target.value)}
                          placeholder="john@example.com"
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="secondary_email" className="text-[12.5px]">Secondary Email</Label>
                        <Input
                          id="secondary_email"
                          type="email"
                          value={formData.secondary_email}
                          onChange={(e) => updateField("secondary_email", e.target.value)}
                          placeholder="john.work@example.com"
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-[14px]">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Phone Numbers</h4>
                      <div className="grid gap-2">
                        <Label htmlFor="phone" className="text-[12.5px]">Primary Phone</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => updateField("phone", e.target.value)}
                          placeholder="+1 (555) 123-4567"
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="secondary_phone" className="text-[12.5px]">Secondary Phone</Label>
                        <Input
                          id="secondary_phone"
                          value={formData.secondary_phone}
                          onChange={(e) => updateField("secondary_phone", e.target.value)}
                          placeholder="+1 (555) 987-6543"
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-[14px]">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Address</h4>
                      <div className="grid gap-2">
                        <Label htmlFor="address_line_1" className="text-[12.5px]">Address Line 1</Label>
                        <Input
                          id="address_line_1"
                          value={formData.address_line_1}
                          onChange={(e) => updateField("address_line_1", e.target.value)}
                          placeholder="123 Main Street"
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="address_line_2" className="text-[12.5px]">Address Line 2</Label>
                        <Input
                          id="address_line_2"
                          value={formData.address_line_2}
                          onChange={(e) => updateField("address_line_2", e.target.value)}
                          placeholder="Apt 4B"
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-[11px]">
                        <div className="grid gap-2">
                          <Label htmlFor="address_city" className="text-[12.5px]">City</Label>
                          <Input
                            id="address_city"
                            value={formData.address_city}
                            onChange={(e) => updateField("address_city", e.target.value)}
                            placeholder="New York"
                            className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="address_state" className="text-[12.5px]">State</Label>
                          <Input
                            id="address_state"
                            value={formData.address_state}
                            onChange={(e) => updateField("address_state", e.target.value)}
                            placeholder="NY"
                            className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-[11px]">
                        <div className="grid gap-2">
                          <Label htmlFor="address_zip_code" className="text-[12.5px]">ZIP Code</Label>
                          <Input
                            id="address_zip_code"
                            value={formData.address_zip_code}
                            onChange={(e) => updateField("address_zip_code", e.target.value)}
                            placeholder="10001"
                            className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="address_country" className="text-[12.5px]">Country</Label>
                          <Input
                            id="address_country"
                            value={formData.address_country}
                            onChange={(e) => updateField("address_country", e.target.value)}
                            placeholder="United States"
                            className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Travel IDs Tab */}
                  <TabsContent value="travel-ids" className="mt-0 space-y-[14px]">
                    <div className="space-y-[14px]">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Secure Travel IDs</h4>
                      <div className="grid gap-2">
                        <Label htmlFor="redress_number" className="text-[12.5px]">Redress Number</Label>
                        <Input
                          id="redress_number"
                          value={formData.redress_number}
                          onChange={(e) => updateField("redress_number", e.target.value)}
                          placeholder="Enter redress number"
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="known_traveler_number" className="text-[12.5px]">Known Traveler Number (TSA PreCheck/Global Entry)</Label>
                        <Input
                          id="known_traveler_number"
                          value={formData.known_traveler_number}
                          onChange={(e) => updateField("known_traveler_number", e.target.value)}
                          placeholder="Enter known traveler number"
                          className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-[14px]">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Passport Information</h4>
                      <div className="grid gap-2">
                        <Label htmlFor="passport_info" className="text-[12.5px]">Passport Details</Label>
                        <Textarea
                          id="passport_info"
                          value={formData.passport_info}
                          onChange={(e) => updateField("passport_info", e.target.value)}
                          placeholder="Passport number, issuing country, expiration date..."
                          rows={3}
                          className="rounded-[8px] text-[13.5px]"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Preferences Tab */}
                  <TabsContent value="preferences" className="mt-0 space-y-[14px]">
                    <div className="space-y-[14px]">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Activities & Interests</h4>
                      <div className="grid gap-2">
                        <Label htmlFor="activities_interests" className="text-[12.5px]">Activities & Interests</Label>
                        <Textarea
                          id="activities_interests"
                          value={formData.activities_interests}
                          onChange={(e) => updateField("activities_interests", e.target.value)}
                          placeholder="Beach, adventure sports, cultural tours, wine tasting..."
                          rows={2}
                          className="rounded-[8px] text-[13.5px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-[14px]">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Food, Drink & Allergy Preferences</h4>
                      <div className="grid gap-2">
                        <Label htmlFor="food_drink_allergies" className="text-[12.5px]">Dietary Requirements & Allergies</Label>
                        <Textarea
                          id="food_drink_allergies"
                          value={formData.food_drink_allergies}
                          onChange={(e) => updateField("food_drink_allergies", e.target.value)}
                          placeholder="Vegetarian, nut allergy, gluten-free..."
                          rows={2}
                          className="rounded-[8px] text-[13.5px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-[14px]">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Flight Preferences</h4>
                      <div className="grid grid-cols-2 gap-[11px]">
                        <div className="grid gap-2">
                          <Label htmlFor="flight_seating_preference" className="text-[12.5px]">Seating Preference</Label>
                          <Select
                            value={formData.flight_seating_preference}
                            onValueChange={(value) => updateField("flight_seating_preference", value)}
                          >
                            <SelectTrigger className="h-9 rounded-[8px] text-[13.5px]">
                              <SelectValue placeholder="Select preference" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="window">Window</SelectItem>
                              <SelectItem value="aisle">Aisle</SelectItem>
                              <SelectItem value="middle">Middle</SelectItem>
                              <SelectItem value="no_preference">No Preference</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="flight_bulkhead_preference" className="text-[12.5px]">Bulkhead Preference</Label>
                          <Select
                            value={formData.flight_bulkhead_preference}
                            onValueChange={(value) => updateField("flight_bulkhead_preference", value)}
                          >
                            <SelectTrigger className="h-9 rounded-[8px] text-[13.5px]">
                              <SelectValue placeholder="Select preference" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="prefer">Prefer Bulkhead</SelectItem>
                              <SelectItem value="avoid">Avoid Bulkhead</SelectItem>
                              <SelectItem value="no_preference">No Preference</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-[14px]">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Lodging Preferences</h4>
                      <div className="grid grid-cols-2 gap-[11px]">
                        <div className="grid gap-2">
                          <Label htmlFor="lodging_floor_preference" className="text-[12.5px]">Floor Preference</Label>
                          <Select
                            value={formData.lodging_floor_preference}
                            onValueChange={(value) => updateField("lodging_floor_preference", value)}
                          >
                            <SelectTrigger className="h-9 rounded-[8px] text-[13.5px]">
                              <SelectValue placeholder="Select preference" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High Floor</SelectItem>
                              <SelectItem value="low">Low Floor</SelectItem>
                              <SelectItem value="ground">Ground Floor</SelectItem>
                              <SelectItem value="no_preference">No Preference</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="lodging_elevator_preference" className="text-[12.5px]">Elevator Proximity</Label>
                          <Select
                            value={formData.lodging_elevator_preference}
                            onValueChange={(value) => updateField("lodging_elevator_preference", value)}
                          >
                            <SelectTrigger className="h-9 rounded-[8px] text-[13.5px]">
                              <SelectValue placeholder="Select preference" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="near">Near Elevator</SelectItem>
                              <SelectItem value="away">Away from Elevator</SelectItem>
                              <SelectItem value="no_preference">No Preference</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-[14px]">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Cruise Preferences</h4>
                      <div className="grid grid-cols-2 gap-[11px]">
                        <div className="grid gap-2">
                          <Label htmlFor="cruise_cabin_floor_preference" className="text-[12.5px]">Cabin Floor</Label>
                          <Select
                            value={formData.cruise_cabin_floor_preference}
                            onValueChange={(value) => updateField("cruise_cabin_floor_preference", value)}
                          >
                            <SelectTrigger className="h-9 rounded-[8px] text-[13.5px]">
                              <SelectValue placeholder="Select preference" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High Deck</SelectItem>
                              <SelectItem value="mid">Mid Deck</SelectItem>
                              <SelectItem value="low">Low Deck</SelectItem>
                              <SelectItem value="no_preference">No Preference</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="cruise_cabin_location_preference" className="text-[12.5px]">Cabin Location</Label>
                          <Select
                            value={formData.cruise_cabin_location_preference}
                            onValueChange={(value) => updateField("cruise_cabin_location_preference", value)}
                          >
                            <SelectTrigger className="h-9 rounded-[8px] text-[13.5px]">
                              <SelectValue placeholder="Select preference" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="forward">Forward</SelectItem>
                              <SelectItem value="midship">Midship</SelectItem>
                              <SelectItem value="aft">Aft</SelectItem>
                              <SelectItem value="no_preference">No Preference</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Other Tab */}
                  <TabsContent value="other" className="mt-0 space-y-[14px]">
                    <div className="grid gap-2">
                      <Label htmlFor="lead_source" className="text-[12.5px]">Lead Source</Label>
                      <Select
                        value={formData.lead_source}
                        onValueChange={(value) => updateField("lead_source", value)}
                      >
                        <SelectTrigger className="h-9 rounded-[8px] text-[13.5px]">
                          <SelectValue placeholder="How did they find you?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                          <SelectItem value="repeat">Repeat Client</SelectItem>
                          <SelectItem value="social_media">Social Media</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="loyalty_programs" className="text-[12.5px]">Loyalty Programs</Label>
                      <Textarea
                        id="loyalty_programs"
                        value={formData.loyalty_programs}
                        onChange={(e) => updateField("loyalty_programs", e.target.value)}
                        placeholder="Delta SkyMiles #12345, Marriott Bonvoy #67890..."
                        rows={2}
                        className="rounded-[8px] text-[13.5px]"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="tags" className="text-[12.5px]">Tags</Label>
                      <Input
                        id="tags"
                        value={formData.tags}
                        onChange={(e) => updateField("tags", e.target.value)}
                        placeholder="VIP, Family, Business..."
                        className="h-9 rounded-[8px] text-[13.5px] md:text-[13.5px]"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="notes" className="text-[12.5px]">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => updateField("notes", e.target.value)}
                        placeholder="Any additional notes about this client..."
                        rows={4}
                        className="rounded-[8px] text-[13.5px]"
                      />
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </ModalBody>

          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="rounded-[8px] text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createClient.isPending}
              className="rounded-[8px] text-[13px]"
            >
              {createClient.isPending ? "Adding..." : "Add Client"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
