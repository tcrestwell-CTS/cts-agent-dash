import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageBanner } from "@/components/layout/PageBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Sparkles, ArrowRight, BookOpen } from "lucide-react";
import { userGuideSections, guideNewCount, USER_GUIDE_VERSION } from "@/data/userGuide";

const UserGuide = () => {
  const [query, setQuery] = useState("");
  const [newOnly, setNewOnly] = useState(false);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return userGuideSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (newOnly && !item.isNew) return false;
          if (!q) return true;
          return (
            item.title.toLowerCase().includes(q) ||
            item.body.toLowerCase().includes(q) ||
            section.title.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, newOnly]);

  return (
    <DashboardLayout>
      <PageBanner
        title="User Guide"
        subtitle={`How the dashboard works, end to end — updated ${USER_GUIDE_VERSION}`}
      >
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3.5 w-3.5" />
          {guideNewCount} new features
        </Badge>
      </PageBanner>

      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the guide — split payments, passport OCR, storefronts…"
              className="pl-9"
              aria-label="Search the user guide"
            />
          </div>
          <Button
            variant={newOnly ? "default" : "outline"}
            onClick={() => setNewOnly((v) => !v)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {newOnly ? "Showing new only" : "What's new"}
          </Button>
        </div>

        <nav aria-label="Guide sections" className="flex flex-wrap gap-2">
          {userGuideSections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s.title}
            </a>
          ))}
        </nav>

        {sections.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No guide entries match that search.
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {sections.map((section) => (
            <Card key={section.id} id={section.id} className="scroll-mt-24">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  {section.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{section.summary}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {section.items.map((item) => (
                  <div key={item.title} className="border-l-2 border-border pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{item.title}</h3>
                      {item.isNew && (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                    {item.path && (
                      <Link
                        to={item.path}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserGuide;
