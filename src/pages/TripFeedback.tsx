import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/trip-feedback`;

interface Context {
  tripName: string;
  destination: string | null;
  clientName: string | null;
  agencyName: string;
  logoUrl: string | null;
  alreadySubmitted: boolean;
}

const CATEGORIES = [
  { key: "accommodations_rating", label: "Accommodations" },
  { key: "activities_rating", label: "Activities & excursions" },
  { key: "communication_rating", label: "Communication with your advisor" },
  { key: "value_rating", label: "Value for the price" },
] as const;

function StarRow({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-6 w-6 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TripFeedback() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const initialRating = Number(params.get("rating")) || 0;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [overall, setOverall] = useState(initialRating >= 1 && initialRating <= 5 ? initialRating : 0);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [reviewText, setReviewText] = useState("");
  const [privateComments, setPrivateComments] = useState("");
  const [allowPublic, setAllowPublic] = useState(false);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setError("This feedback link is missing its access token.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load your survey");
        setContext(data);
        if (data.alreadySubmitted) setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your survey");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const heading = useMemo(() => {
    if (!context) return "How was your trip?";
    return context.destination
      ? `How was ${context.destination}?`
      : `How was ${context.tripName}?`;
  }, [context]);

  const submit = async () => {
    if (!overall) {
      toast.error("Please give an overall star rating first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          overall_rating: overall,
          ...ratings,
          review_text: reviewText,
          private_comments: privateComments,
          allow_public_use: allowPublic,
          would_recommend: wouldRecommend,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit your feedback");
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit your feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          {context?.logoUrl && (
            <img src={context.logoUrl} alt={context.agencyName} className="mx-auto h-14 object-contain" />
          )}
          <h1 className="text-2xl font-semibold">{context?.agencyName || "Trip Feedback"}</h1>
        </div>

        {error ? (
          <Card>
            <CardHeader>
              <CardTitle>Link not valid</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : done ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <h2 className="text-xl font-semibold">Thank you!</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Your feedback has been sent to your travel advisor. We truly appreciate you taking
                the time — it helps us make every future trip better.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{heading}</CardTitle>
              <CardDescription>
                {context?.clientName ? `${context.clientName}, ` : ""}this takes less than a minute
                and goes straight to your travel advisor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-background p-4">
                <Label className="text-base">Overall experience</Label>
                <div className="mt-2 flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`Overall: ${n} star${n > 1 ? "s" : ""}`}
                      onClick={() => setOverall(n)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-9 w-9 ${n <= overall ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y rounded-lg border bg-background px-4">
                {CATEGORIES.map((c) => (
                  <StarRow
                    key={c.key}
                    label={c.label}
                    value={ratings[c.key] || 0}
                    onChange={(v) => setRatings((prev) => ({ ...prev, [c.key]: v }))}
                  />
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="review">What stood out about your trip?</Label>
                <Textarea
                  id="review"
                  rows={4}
                  placeholder="The resort, the excursions, the little details..."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="allow"
                    checked={allowPublic}
                    onCheckedChange={(v) => setAllowPublic(v === true)}
                  />
                  <Label htmlFor="allow" className="text-sm font-normal text-muted-foreground">
                    You may share this review publicly (website, social media).
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="private">Anything we should improve? (private)</Label>
                <Textarea
                  id="private"
                  rows={3}
                  placeholder="Only your advisor sees this."
                  value={privateComments}
                  onChange={(e) => setPrivateComments(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Would you recommend us to friends and family?</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={wouldRecommend === true ? "default" : "outline"}
                    onClick={() => setWouldRecommend(true)}
                  >
                    Yes, absolutely
                  </Button>
                  <Button
                    type="button"
                    variant={wouldRecommend === false ? "default" : "outline"}
                    onClick={() => setWouldRecommend(false)}
                  >
                    Not this time
                  </Button>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit feedback
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
