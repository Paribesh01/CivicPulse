"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { Card, Eyebrow } from "@/components/ui";

const EXAMPLES = [
  "Streetlight near XYZ school has not been working for 5 days.",
  "Sewage is overflowing onto the road at Shastri Nagar, children walk through it to school.",
  "Open manhole near the Bus Stand, no cover for a week — someone will fall in.",
  "Model Town mein 3 din se paani nahi aa raha hai.",
  "Garbage has not been collected in Gandhi Nagar for four days and it is starting to smell.",
];

type TriageResult = {
  id: string;
  code: string;
  category: string | null;
  department: string | null;
  priority: number;
  ward: string | null;
  assigned: boolean;
  assignment: string;
  slaHours: number;
  dueAt: string;
  signals: { label: string; points: number }[];
};

export function ReportForm({
  signedIn,
  defaultPhone,
  citizenName,
}: {
  signedIn: boolean;
  defaultPhone: string;
  citizenName: string | null;
}) {
  const [text, setText] = useState("");
  const [locationHint, setLocationHint] = useState("");
  const [phone, setPhone] = useState(defaultPhone);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "error">("idle");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TriageResult | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (text.trim().length < 10) {
      setError("Please describe the problem in a little more detail.");
      return;
    }

    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          locationHint: locationHint.trim() || null,
          phone: phone.trim() || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          channel: "WEB",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not register the complaint.");
        return;
      }
      setResult(data as TriageResult);
    } catch {
      setError("Network problem — please try again.");
    } finally {
      setPending(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoState("error");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("idle");
      },
      () => setGeoState("error"),
      { timeout: 10_000 },
    );
  }

  if (result) {
    return (
      <TriageReceipt
        result={result}
        onReset={() => {
          setResult(null);
          setText("");
          setLocationHint("");
          setCoords(null);
        }}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="eyebrow">What is wrong?</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              required
              placeholder="Streetlight near XYZ school has not been working for 5 days."
              className="mt-1.5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-accent"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              Mention how long it has been happening and any nearby landmark
              &mdash; both raise the priority.
            </span>
          </label>

          <label className="block">
            <span className="eyebrow">Location (optional)</span>
            <input
              value={locationHint}
              onChange={(e) => setLocationHint(e.target.value)}
              placeholder="Street, landmark or ward"
              className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs transition-colors hover:bg-surface-2"
            >
              {geoState === "locating" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              Use my location
            </button>
            {coords && (
              <span className="font-mono text-xs text-good">
                <Check className="mr-1 inline h-3.5 w-3.5" />
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </span>
            )}
            {geoState === "error" && (
              <span className="text-xs text-warn">
                Location unavailable — the text will be used instead.
              </span>
            )}
          </div>

          {!signedIn && (
            <label className="block">
              <span className="eyebrow">Mobile for SMS updates (optional)</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                placeholder="+91 …"
                className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
            </label>
          )}

          {error && (
            <p className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Reading and routing…" : "Submit complaint"}
          </button>

          <p className="text-xs leading-relaxed text-ink-faint">
            {signedIn
              ? `Filing as ${citizenName}. You'll be able to track this from your dashboard.`
              : "You can file without an account. Sign in first if you want to track it later."}
          </p>
        </form>
      </Card>

      <div>
        <Eyebrow>Try one of these</Eyebrow>
        <p className="mt-2 text-sm text-ink-soft">
          Each is routed to a different department and lands on a different
          clock.
        </p>
        <div className="mt-3 space-y-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="w-full rounded-lg border border-line bg-surface p-3 text-left text-sm leading-relaxed text-ink-soft shadow-card transition-colors hover:border-accent hover:text-ink"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const STAGE_LABELS = [
  "AI classification",
  "Department detection",
  "Priority calculation",
  "Location detection",
  "Officer assignment",
  "SLA clock started",
];

function TriageReceipt({
  result,
  onReset,
}: {
  result: TriageResult;
  onReset: () => void;
}) {
  const rows: [string, string][] = [
    ["AI classification", result.category ?? "Could not classify"],
    ["Department detection", result.department ?? "Unrouted — held for triage"],
    ["Priority calculation", `Score ${result.priority}/100`],
    ["Location detection", result.ward ?? "Ward not resolved"],
    [
      "Officer assignment",
      result.assigned ? result.assignment : "Awaiting supervisor assignment",
    ],
    [
      "SLA clock started",
      result.assigned
        ? `${result.slaHours}h — due ${new Date(result.dueAt).toLocaleString()}`
        : "Starts when assigned",
    ],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-6">
        <div className="flex items-center gap-2 text-good">
          <Check className="h-5 w-5" />
          <span className="eyebrow text-good">Registered</span>
        </div>
        <h2 className="mt-3 font-serif text-3xl font-semibold tnum">
          {result.code}
        </h2>
        <p className="mt-2 text-ink-soft">
          {result.assigned
            ? "Assigned to a named officer with the clock already running. Nobody had to read it first."
            : "Received and queued for a supervisor to assign — the classifier wasn't confident enough to route it unattended."}
        </p>

        <div className="mt-6 divide-y divide-line border-t border-line">
          {rows.map(([label, value], i) => (
            <div key={label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
              <span className="font-mono text-[0.7rem] tracking-wider text-ink-faint">
                {String(i + 2).padStart(2, "0")}
              </span>
              <span className="w-40 shrink-0 text-sm text-ink-soft">{label}</span>
              <span className="flex-1 text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/track/${result.code}`}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Track this complaint
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm transition-colors hover:bg-surface-2"
          >
            Report another
          </button>
        </div>
      </Card>

      <div>
        <Eyebrow>Why this priority</Eyebrow>
        <p className="mt-2 text-sm text-ink-soft">
          Every point is attributable. An officer can see exactly why this
          ticket outranks another.
        </p>
        <Card className="mt-3 divide-y divide-line">
          {result.signals.map((signal) => (
            <div
              key={signal.label}
              className="flex items-baseline justify-between gap-3 p-3"
            >
              <span className="text-sm text-ink-soft">{signal.label}</span>
              <span className="font-mono text-sm tnum text-accent-ink">
                +{signal.points}
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 bg-surface-2 p-3">
            <span className="text-sm font-medium">Total</span>
            <span className="font-mono text-sm font-medium tnum">
              {result.priority}/100
            </span>
          </div>
        </Card>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Stage {STAGE_LABELS.length + 2} of 8 is the sweep that watches this
          deadline from here on — it runs whether or not anyone opens the
          dashboard.
        </p>
      </div>
    </div>
  );
}
