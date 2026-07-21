import type { ReservationRulesDto } from "@rms/contracts";
import { Button, Card, Spinner } from "@rms/ui";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Input, Label } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";
import { useRules, useUpdateRules } from "../hooks/use-rules";

const UNIT_OPTIONS = [
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
];

const BOOKING_MODE_OPTIONS = [
  { value: "auto_then_manual", label: "Auto, then manual (recommended)" },
  { value: "automatic", label: "Automatic — instant confirmation only" },
  { value: "manual", label: "Manual — every booking reviewed" },
];

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-3">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onCheckedChange }: { label: string; hint: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-3">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function RulesPage() {
  const rulesQuery = useRules();
  const updateRules = useUpdateRules();
  const [draft, setDraft] = useState<ReservationRulesDto | null>(null);

  useEffect(() => {
    if (rulesQuery.data && !draft) setDraft(rulesQuery.data);
  }, [rulesQuery.data, draft]);

  if (rulesQuery.isLoading || !draft) return <Spinner className="mx-auto mt-8 text-ink-3" />;

  function set<K extends keyof ReservationRulesDto>(key: K, value: ReservationRulesDto[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(rulesQuery.data);

  return (
    <div>
      <PageHeader
        title="Booking rules"
        description="How the automatic booking engine decides — proposal §07, applied live."
        actions={
          <Button disabled={!dirty} loading={updateRules.isPending} onClick={() => draft && updateRules.mutate(draft)}>
            Save changes
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Booking window" description="How far ahead a guest can book, and how far in advance they're required to.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum advance">
              <Input type="number" min={1} value={draft.minAdvanceBooking} onChange={(e) => set("minAdvanceBooking", Number(e.target.value))} />
            </Field>
            <Field label="Unit">
              <Select value={draft.minAdvanceUnit} onValueChange={(v) => set("minAdvanceUnit", v as "hours" | "days")} options={UNIT_OPTIONS} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Maximum advance">
              <Input type="number" min={1} value={draft.maxAdvanceBooking} onChange={(e) => set("maxAdvanceBooking", Number(e.target.value))} />
            </Field>
            <Field label="Unit">
              <Select value={draft.maxAdvanceUnit} onValueChange={(v) => set("maxAdvanceUnit", v as "hours" | "days")} options={UNIT_OPTIONS} />
            </Field>
          </div>
          <ToggleRow
            label="Allow same-day booking"
            hint="If off, guests must book at least one calendar day ahead regardless of the minimum above."
            checked={draft.allowSameDayBooking}
            onCheckedChange={(v) => set("allowSameDayBooking", v)}
          />
        </Section>

        <Section title="Cancellation" description="How close to the reservation time a guest can still cancel it themselves.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cutoff">
              <Input type="number" min={0} value={draft.cancellationTimeLimit} onChange={(e) => set("cancellationTimeLimit", Number(e.target.value))} />
            </Field>
            <Field label="Unit">
              <Select value={draft.cancellationTimeUnit} onValueChange={(v) => set("cancellationTimeUnit", v as "hours" | "days")} options={UNIT_OPTIONS} />
            </Field>
          </div>
        </Section>

        <Section title="Party size & contact" description="Limits applied to every booking, guest or staff-entered alike.">
          <Field label="Maximum guests per booking">
            <Input type="number" min={1} value={draft.maxGuestsPerBooking} onChange={(e) => set("maxGuestsPerBooking", Number(e.target.value))} />
          </Field>
          <ToggleRow
            label="Require contact information"
            hint="A phone number or email is mandatory to complete a booking."
            checked={draft.requireContactInformation}
            onCheckedChange={(v) => set("requireContactInformation", v)}
          />
        </Section>

        <Section title="Booking mode & overflow" description="The flexible-capacity engine — proposal §07.">
          <Field label="Mode">
            <Select value={draft.bookingMode} onValueChange={(v) => set("bookingMode", v as ReservationRulesDto["bookingMode"])} options={BOOKING_MODE_OPTIONS} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Overflow parties / slot">
              <Input type="number" min={0} value={draft.overflowPartiesPerSlot} onChange={(e) => set("overflowPartiesPerSlot", Number(e.target.value))} />
            </Field>
            <Field label="Overflow covers / slot">
              <Input type="number" min={0} value={draft.overflowCoversPerSlot} onChange={(e) => set("overflowCoversPerSlot", Number(e.target.value))} />
            </Field>
          </div>
          <ToggleRow
            label="Allow waitlist"
            hint="Once overflow limits are also reached, further requests join a waitlist instead of being turned away."
            checked={draft.allowWaitlist}
            onCheckedChange={(v) => set("allowWaitlist", v)}
          />
        </Section>

        <Section title="Request expiry" description="How long a pending request waits before it's automatically expired.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry (minutes)">
              <Input type="number" min={1} value={draft.requestExpiryMinutes} onChange={(e) => set("requestExpiryMinutes", Number(e.target.value))} />
            </Field>
            <Field label="Cutoff before slot (minutes)">
              <Input type="number" min={1} value={draft.requestExpiryCutoffMinutes} onChange={(e) => set("requestExpiryCutoffMinutes", Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum floor (minutes)">
              <Input type="number" min={1} value={draft.requestExpiryFloorMinutes} onChange={(e) => set("requestExpiryFloorMinutes", Number(e.target.value))} />
            </Field>
            <Field label="Urgent threshold (minutes)">
              <Input type="number" min={1} value={draft.urgentThresholdMinutes} onChange={(e) => set("urgentThresholdMinutes", Number(e.target.value))} />
            </Field>
          </div>
        </Section>
      </div>
    </div>
  );
}
