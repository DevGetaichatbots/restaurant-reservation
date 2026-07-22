import * as RadixSwitch from "@radix-ui/react-switch";

import { cn } from "@rms/ui";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onCheckedChange, disabled, id }: SwitchProps) {
  return (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full bg-paper-3 outline-none transition-colors data-[state=checked]:bg-primary disabled:opacity-50",
      )}
    >
      <RadixSwitch.Thumb className="block h-6 w-6 translate-x-1 rounded-full bg-paper shadow-sm transition-transform will-change-transform data-[state=checked]:translate-x-[26px]" />
    </RadixSwitch.Root>
  );
}
