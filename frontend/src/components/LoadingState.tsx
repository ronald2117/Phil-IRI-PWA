import { LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Loading assessment" }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <LoaderCircle size={20} className="spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}