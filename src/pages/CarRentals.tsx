import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CarRentalsManager } from "@/components/car-rentals/CarRentalsManager";

export default function CarRentals() {
  return (
    <DashboardLayout>
      <CarRentalsManager />
    </DashboardLayout>
  );
}