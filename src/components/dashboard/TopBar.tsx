import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Send, UserPlus } from "lucide-react";

export function TopBar() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    navigate(`/contacts?search=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients, trips, bookings..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={() => navigate("/trips?action=new")}>
          <Plus className="h-4 w-4 mr-1" />
          New Trip
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate("/contacts")}>
          <Send className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Send Quote</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate("/contacts?action=new")}>
          <UserPlus className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Add Client</span>
        </Button>
      </div>
    </div>
  );
}
