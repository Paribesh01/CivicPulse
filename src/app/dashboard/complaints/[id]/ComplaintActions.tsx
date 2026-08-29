"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addComplaintComment,
  reassignComplaint,
  updateComplaintStatus,
} from "@/app/actions/complaints";
import { Card, Eyebrow } from "@/components/ui";
import type { ComplaintStatus } from "@/generated/prisma";

type Officer = { id: string; name: string; openCount: number };

export function ComplaintActions({
  complaintId,
  status,
  assigneeId,
  canReassign,
  officers,
}: {
  complaintId: string;
  status: ComplaintStatus;
  assigneeId: string | null;
  canReassign: boolean;
  officers: Officer[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [selectedOfficer, setSelectedOfficer] = useState(assigneeId ?? "");

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNote("");
      setComment("");
      router.refresh();
    });
  }

  const isOpen = ["SUBMITTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS"].includes(status);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <Eyebrow>Move this ticket</Eyebrow>

        {error && (
          <p className="mt-3 rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
            {error}
          </p>
        )}

        {status === "ASSIGNED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => updateComplaintStatus({ complaintId, status: "IN_PROGRESS" }))
            }
            className="mt-3 w-full rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            Start work
          </button>
        )}

        {isOpen && (
          <div className="mt-3 space-y-2">
            <label className="block">
              <span className="text-xs text-ink-soft">
                Resolution note (required to resolve)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Replaced the faulty ballast and tested the pole."
                className="mt-1 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
            </label>
            <button
              type="button"
              disabled={pending || !note.trim()}
              onClick={() =>
                run(() =>
                  updateComplaintStatus({ complaintId, status: "RESOLVED", note }),
                )
              }
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Mark resolved
            </button>
          </div>
        )}

        {status === "RESOLVED" && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => updateComplaintStatus({ complaintId, status: "CLOSED" }))
              }
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  updateComplaintStatus({ complaintId, status: "IN_PROGRESS" }),
                )
              }
              className="flex-1 rounded-lg border border-line bg-surface px-4 py-2 text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              Reopen
            </button>
          </div>
        )}

        {status === "CLOSED" && (
          <p className="mt-3 text-sm text-ink-soft">
            This ticket is closed. Reopening it restarts the trail rather than
            creating a new complaint.
          </p>
        )}
      </Card>

      {canReassign && (
        <Card className="p-5">
          <Eyebrow>Reassign</Eyebrow>
          <p className="mt-2 text-xs text-ink-soft">
            The deadline travels with the ticket — handing it over does not buy
            more time.
          </p>
          <select
            value={selectedOfficer}
            onChange={(e) => setSelectedOfficer(e.target.value)}
            className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="">Choose an officer…</option>
            {officers.map((officer) => (
              <option key={officer.id} value={officer.id}>
                {officer.name} — {officer.openCount} open
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !selectedOfficer || selectedOfficer === assigneeId}
            onClick={() =>
              run(() =>
                reassignComplaint({ complaintId, assigneeId: selectedOfficer }),
              )
            }
            className="mt-2 w-full rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            Reassign
          </button>
        </Card>
      )}

      <Card className="p-5">
        <Eyebrow>Add a note</Eyebrow>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Site visited, part on order from the depot."
          className="mt-3 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <button
          type="button"
          disabled={pending || !comment.trim()}
          onClick={() => run(() => addComplaintComment({ complaintId, body: comment }))}
          className="mt-2 w-full rounded-lg border border-line bg-surface px-4 py-2 text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add to timeline"}
        </button>
      </Card>
    </div>
  );
}
