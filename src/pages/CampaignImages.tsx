import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useImageAssets } from "@/hooks/useImageAssets";
import { ImageDropzone } from "@/components/campaigns/ImageDropzone";
import { ImageGrid } from "@/components/campaigns/ImageGrid";

export default function CampaignImages() {
  const { data, isLoading, upload, remove } = useImageAssets();

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
            Crestwell Travel Services
          </p>
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Image Library</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Drag and drop images to use in your email campaigns.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageDropzone
              onDrop={(files) => upload.mutate(files)}
              isUploading={upload.isPending}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Library{data?.length ? ` (${data.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full" />
                ))}
              </div>
            ) : (
              <ImageGrid
                assets={data ?? []}
                onDelete={(a) => remove.mutate(a)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
