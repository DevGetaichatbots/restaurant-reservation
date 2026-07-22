import { Button, Card } from "@rms/ui";
import { LogOut, Volume2 } from "lucide-react";
import type { ReactNode } from "react";

import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";
import { useAuthStore } from "../lib/auth-store";
import { useConnectionInfo } from "../lib/realtime-context";
import {
  useDeviceSettingsStore,
  type DefaultView,
  type TextSize,
} from "../lib/device-settings-store";
import { playAlertSound } from "../lib/sound";

const DEFAULT_VIEW_OPTIONS: { value: DefaultView; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "requests", label: "Request queue" },
];

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-base font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isLive, lastSyncedAt } = useConnectionInfo();
  const {
    soundEnabled,
    volume,
    textSize,
    defaultView,
    setSoundEnabled,
    setVolume,
    setTextSize,
    setDefaultView,
  } = useDeviceSettingsStore();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card className="p-5">
        <h2 className="mb-1 font-display text-lg text-ink">This device</h2>
        <p className="mb-2 text-sm text-ink-3">
          Settings here are local to this tablet — a device by the kitchen can be configured differently to one at
          the host stand.
        </p>

        <div className="divide-y divide-rule">
          <Row label="Notification sound" hint="Plays when a new reservation comes in">
            <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </Row>

          {soundEnabled && (
            <Row label="Volume">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="h-2 w-32 accent-primary"
                  aria-label="Notification volume"
                />
                <button
                  type="button"
                  onClick={playAlertSound}
                  aria-label="Test sound"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-rule text-ink-3 hover:bg-paper-3 hover:text-ink"
                >
                  <Volume2 size={18} />
                </button>
              </div>
            </Row>
          )}

          <Row label="Text size">
            <Select
              value={textSize}
              onValueChange={(v) => setTextSize(v as TextSize)}
              options={TEXT_SIZE_OPTIONS}
              className="w-36"
            />
          </Row>

          <Row label="Default view on launch">
            <Select
              value={defaultView}
              onValueChange={(v) => setDefaultView(v as DefaultView)}
              options={DEFAULT_VIEW_OPTIONS}
              className="w-44"
            />
          </Row>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg text-ink">Connection</h2>
        <div className="flex items-center justify-between py-2">
          <span className="text-base text-ink-2">Status</span>
          <span className={`text-base font-medium ${isLive ? "text-success" : "text-warning"}`}>
            {isLive ? "Live" : "Reconnecting…"}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-base text-ink-2">Last sync</span>
          <span className="text-base text-ink">
            {lastSyncedAt ? lastSyncedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "—"}
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-medium text-ink">{user?.name}</p>
            <p className="text-sm capitalize text-ink-3">{user?.role}</p>
          </div>
          <Button variant="danger" size="lg" onClick={logout}>
            <LogOut size={18} /> Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
