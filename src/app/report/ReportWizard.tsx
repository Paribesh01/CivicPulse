"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Camera,
  Check,
  CircleAlert,
  Clock,
  Building2,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";
import { BigButton, Card, StepDots } from "@/components/ui";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

type Step = "photo" | "describe" | "location" | "review" | "done";

type Analysis = {
  summary: string;
  question: string | null;
  category: string | null;
  categoryLabel: string | null;
  department: string | null;
  ward: string | null;
  locationResolved: boolean;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priorityScore: number;
  slaHours: number;
  dueAt: string;
  willAssign: boolean;
};

type Receipt = {
  id: string;
  code: string;
  department: string | null;
  ward: string | null;
  slaHours: number;
  dueAt: string;
  assigned: boolean;
  pointsAwarded: number;
};

const URGENCY_STYLE: Record<Analysis["priority"], string> = {
  CRITICAL: "bg-critical text-white",
  HIGH: "bg-warn text-white",
  MEDIUM: "bg-accent text-white",
  LOW: "bg-surface-2 text-ink-soft",
};

export function ReportWizard({
  t,
  locale,
  photoRequired,
  defaultPhone,
}: {
  t: Dictionary;
  locale: Locale;
  photoRequired: boolean;
  defaultPhone: string;
}) {
  const [step, setStep] = useState<Step>("photo");
  const [error, setError] = useState<string | null>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPublicId, setPhotoPublicId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [locationHint, setLocationHint] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [answer, setAnswer] = useState("");
  const [analysing, setAnalysing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const STEPS: Step[] = ["photo", "describe", "location", "review"];
  const stepIndex = STEPS.indexOf(step);

  /// The text sent to the server: the description, plus the answer to the
  /// system's follow-up question if one was asked and answered.
  function composedText(): string {
    return answer.trim() ? `${text.trim()}\n\n${answer.trim()}` : text.trim();
  }

  async function handlePhoto(file: File) {
    setError(null);
    setUploading(true);
    setPhotoPreview(URL.createObjectURL(file));

    try {
      const signRes = await fetch("/api/uploads/signature", { method: "POST" });
      const signed = await signRes.json();

      if (!signRes.ok || !signed.configured) {
        setError(t.report.photoFailed);
        return;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", signed.apiKey);
      form.append("timestamp", String(signed.timestamp));
      form.append("signature", signed.signature);
      form.append("folder", signed.folder);

      // Straight to Cloudinary — the photo never passes through our server.
      const upload = await fetch(signed.uploadUrl, { method: "POST", body: form });
      const result = await upload.json();

      if (!upload.ok || !result.secure_url) {
        setError(t.report.photoFailed);
        return;
      }

      setPhotoUrl(result.secure_url);
      setPhotoPublicId(result.public_id ?? null);
    } catch {
      setError(t.report.photoFailed);
    } finally {
      setUploading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError(t.report.locationFailed);
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoBusy(false);
      },
      () => {
        setError(t.report.locationFailed);
        setGeoBusy(false);
      },
      { timeout: 10_000 },
    );
  }

  async function runAnalysis() {
    setError(null);
    setAnalysing(true);
    try {
      const res = await fetch("/api/complaints/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: composedText(),
          locationHint: locationHint.trim() || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.report.photoFailed);
        return;
      }
      setAnalysis(data as Analysis);
      setStep("review");
    } catch {
      setError(t.report.photoFailed);
    } finally {
      setAnalysing(false);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: composedText(),
          locationHint: locationHint.trim() || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          phone: defaultPhone || null,
          photoUrl,
          photoPublicId,
          channel: "WEB",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.report.photoFailed);
        return;
      }
      setReceipt(data as Receipt);
      setStep("done");
    } catch {
      setError(t.report.photoFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done" && receipt) {
    return <Done t={t} receipt={receipt} locale={locale} />;
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">{t.report.title}</h1>
      <div className="mt-4">
        <StepDots
          total={STEPS.length}
          current={stepIndex + 1}
          label={`${t.report.step} ${stepIndex + 1} ${t.report.of} ${STEPS.length}`}
        />
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-critical-soft p-4 text-critical">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* 1 — Photo evidence */}
      {step === "photo" && (
        <Card className="mt-5 p-5">
          <div className="flex items-start gap-3">
            <Camera className="mt-0.5 h-7 w-7 shrink-0 text-accent" />
            <div>
              <h2 className="font-serif text-2xl font-semibold">
                {t.report.photoTitle}
              </h2>
              <p className="mt-1 text-ink-soft">{t.report.photoBody}</p>
            </div>
          </div>

          {photoPreview && (
            <div className="relative mt-5 aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt=""
                className="h-full w-full object-cover"
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/60 font-medium text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t.report.photoUploading}
                </div>
              )}
              {photoUrl && !uploading && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-good px-3 py-1 text-sm font-semibold text-white">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </div>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhoto(file);
            }}
          />

          <div className="mt-5 space-y-3">
            <BigButton
              variant={photoUrl ? "secondary" : "primary"}
              icon={<Camera className="h-5 w-5" />}
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {photoUrl ? t.report.photoChange : t.report.photoButton}
            </BigButton>

            {!photoRequired && !photoUrl && (
              <p className="text-sm text-warn">{t.report.photoOptionalNotice}</p>
            )}

            <BigButton
              icon={<ArrowRight className="h-5 w-5" />}
              disabled={uploading || (photoRequired && !photoUrl)}
              onClick={() => setStep("describe")}
            >
              {t.common.next}
            </BigButton>
          </div>
        </Card>
      )}

      {/* 2 — Describe */}
      {step === "describe" && (
        <Card className="mt-5 p-5">
          <h2 className="font-serif text-2xl font-semibold">
            {t.report.describeTitle}
          </h2>
          <p className="mt-1 text-ink-soft">{t.report.describeBody}</p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            autoFocus
            placeholder={t.report.describePlaceholder}
            className="mt-4 w-full resize-y rounded-xl border-2 border-line bg-bg p-4 text-lg leading-relaxed outline-none transition-colors focus:border-accent"
          />
          <p className="mt-2 text-sm text-ink-soft">{t.report.describeHint}</p>

          <div className="mt-5 flex gap-3">
            <BigButton
              variant="secondary"
              icon={<ArrowLeft className="h-5 w-5" />}
              onClick={() => setStep("photo")}
              className="flex-1"
            >
              {t.common.back}
            </BigButton>
            <BigButton
              icon={<ArrowRight className="h-5 w-5" />}
              disabled={text.trim().length < 10}
              onClick={() => {
                setError(null);
                setStep("location");
              }}
              className="flex-[2]"
            >
              {t.common.next}
            </BigButton>
          </div>
          {text.length > 0 && text.trim().length < 10 && (
            <p className="mt-2 text-sm text-warn">{t.report.describeTooShort}</p>
          )}
        </Card>
      )}

      {/* 3 — Location */}
      {step === "location" && (
        <Card className="mt-5 p-5">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-7 w-7 shrink-0 text-accent" />
            <div>
              <h2 className="font-serif text-2xl font-semibold">
                {t.report.locationTitle}
              </h2>
              <p className="mt-1 text-ink-soft">{t.report.locationBody}</p>
            </div>
          </div>

          <input
            value={locationHint}
            onChange={(e) => setLocationHint(e.target.value)}
            placeholder={t.report.locationPlaceholder}
            className="mt-4 w-full rounded-xl border-2 border-line bg-bg px-4 text-lg outline-none transition-colors focus:border-accent"
          />

          <div className="mt-3">
            <BigButton
              variant="secondary"
              icon={
                geoBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : coords ? (
                  <Check className="h-5 w-5 text-good" />
                ) : (
                  <MapPin className="h-5 w-5" />
                )
              }
              onClick={useMyLocation}
              disabled={geoBusy}
            >
              {coords ? t.report.locationCaptured : t.report.useMyLocation}
            </BigButton>
          </div>

          <div className="mt-5 flex gap-3">
            <BigButton
              variant="secondary"
              icon={<ArrowLeft className="h-5 w-5" />}
              onClick={() => setStep("describe")}
              className="flex-1"
            >
              {t.common.back}
            </BigButton>
            <BigButton
              icon={
                analysing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )
              }
              disabled={analysing}
              onClick={runAnalysis}
              className="flex-[2]"
            >
              {analysing ? t.report.analysing : t.common.next}
            </BigButton>
          </div>
        </Card>
      )}

      {/* 4 — Review what the system understood */}
      {step === "review" && analysis && (
        <div className="mt-5 space-y-4">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-7 w-7 shrink-0 text-accent" />
              <div>
                <h2 className="font-serif text-2xl font-semibold">
                  {t.report.reviewTitle}
                </h2>
                <p className="mt-1 text-ink-soft">{t.report.reviewBody}</p>
              </div>
            </div>

            <p className="mt-4 rounded-xl bg-accent-soft p-4 text-lg text-accent-ink">
              {analysis.summary}
            </p>

            <dl className="mt-4 space-y-3">
              <Row
                icon={<Building2 className="h-5 w-5" />}
                label={t.report.understoodDepartment}
                value={analysis.department ?? "—"}
              />
              <Row
                icon={<MapPin className="h-5 w-5" />}
                label={t.report.understoodLocation}
                value={analysis.ward ?? (locationHint || "—")}
                warn={!analysis.locationResolved}
              />
              <Row
                icon={<Clock className="h-5 w-5" />}
                label={t.report.understoodDeadline}
                value={`${analysis.slaHours}h`}
              />
            </dl>

            <div className="mt-4 flex items-center gap-2">
              <span className="text-ink-soft">{t.report.understoodUrgency}</span>
              <span
                className={`rounded-full px-3 py-1 font-semibold ${URGENCY_STYLE[analysis.priority]}`}
              >
                {t.urgency[analysis.priority]}
              </span>
            </div>
          </Card>

          {/* The one follow-up question the system may ask, in the citizen's
              own language. */}
          {analysis.question && (
            <Card className="border-warn/40 p-5">
              <h3 className="font-serif text-xl font-semibold">
                {t.report.followUpTitle}
              </h3>
              <p className="mt-1.5 text-lg">{analysis.question}</p>
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="mt-3 w-full rounded-xl border-2 border-line bg-bg px-4 text-lg outline-none transition-colors focus:border-accent"
              />
              {answer.trim() && (
                <div className="mt-3">
                  <BigButton
                    variant="secondary"
                    icon={
                      analysing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Sparkles className="h-5 w-5" />
                      )
                    }
                    disabled={analysing}
                    onClick={runAnalysis}
                  >
                    {t.common.next}
                  </BigButton>
                </div>
              )}
            </Card>
          )}

          <div className="flex gap-3">
            <BigButton
              variant="secondary"
              icon={<ArrowLeft className="h-5 w-5" />}
              onClick={() => setStep("describe")}
              className="flex-1"
            >
              {t.report.somethingWrong}
            </BigButton>
            <BigButton
              icon={
                submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )
              }
              disabled={submitting}
              onClick={submit}
              className="flex-[2]"
            >
              {t.report.confirmAndSubmit}
            </BigButton>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={warn ? "text-warn" : "text-ink-faint"}>{icon}</span>
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`ml-auto text-right font-medium ${warn ? "text-warn" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function Done({
  t,
  receipt,
  locale,
}: {
  t: Dictionary;
  receipt: Receipt;
  locale: Locale;
}) {
  return (
    <div className="space-y-4">
      <Card className="p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-good-soft">
          <Check className="h-9 w-9 text-good" />
        </div>
        <h1 className="mt-4 font-serif text-3xl font-bold">{t.report.doneTitle}</h1>
        <p className="mt-2 text-ink-soft">{t.report.doneBody}</p>

        <p className="mt-5 font-serif text-4xl font-bold tnum text-accent">
          {receipt.code}
        </p>

        {receipt.pointsAwarded > 0 && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-good-soft px-4 py-2 font-semibold text-good">
            <Award className="h-5 w-5" />
            {t.report.pointsEarned} +{receipt.pointsAwarded} {t.common.points}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <dl className="space-y-3">
          <Row
            icon={<Building2 className="h-5 w-5" />}
            label={t.report.doneAssigned}
            value={receipt.department ?? "—"}
          />
          <Row
            icon={<MapPin className="h-5 w-5" />}
            label={t.report.understoodLocation}
            value={receipt.ward ?? "—"}
          />
          <Row
            icon={<Clock className="h-5 w-5" />}
            label={t.report.doneDeadline}
            value={new Date(receipt.dueAt).toLocaleString(
              locale === "hi" ? "hi-IN" : "en-IN",
            )}
          />
        </dl>
      </Card>

      <Link href={`/track/${receipt.code}`} className="block">
        <BigButton icon={<ArrowRight className="h-5 w-5" />}>
          {t.report.trackThis}
        </BigButton>
      </Link>
      <Link href="/report" className="block">
        <BigButton variant="secondary" icon={<Camera className="h-5 w-5" />}>
          {t.report.reportAnother}
        </BigButton>
      </Link>
    </div>
  );
}
