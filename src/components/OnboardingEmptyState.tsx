import type { ReactNode } from "react";

type OnboardingAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  title?: string;
};

type OnboardingEmptyStateProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  actions?: OnboardingAction[];
  notes?: string[];
  compact?: boolean;
  className?: string;
};

export function OnboardingEmptyState({ eyebrow = "FIRST RUN", title, children, actions = [], notes = [], compact = false, className = "" }: OnboardingEmptyStateProps) {
  return (
    <section className={`onboarding-empty-state ${compact ? "compact" : ""} ${className}`.trim()} aria-label={title}>
      <div className="onboarding-empty-copy">
        <span className="stub-tag">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      {actions.length > 0 && (
        <div className="onboarding-empty-actions">
          {actions.map((action) => action.href ? (
            <a
              key={action.label}
              className={`btn ${action.variant === "primary" ? "primary" : "ghost"}`}
              href={action.href}
              title={action.title}
              aria-disabled={action.disabled || undefined}
            >
              {action.label}
            </a>
          ) : (
            <button
              key={action.label}
              type="button"
              className={`btn ${action.variant === "primary" ? "primary" : "ghost"}`}
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <ul className="onboarding-empty-notes">
          {notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
    </section>
  );
}
