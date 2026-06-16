import type { ReactNode } from "react";
import { Icon } from "./Icon";

type InfoTooltipProps = {
  label?: string;
  children: ReactNode;
  className?: string;
};

export function InfoTooltip({ label = "More information", children, className = "" }: InfoTooltipProps) {
  return (
    <span className={`info-tooltip ${className}`.trim()}>
      <button className="info-tooltip-trigger" type="button" aria-label={label}>
        <Icon name="info" size={14} />
      </button>
      <span className="info-tooltip-popover" role="tooltip">
        {children}
      </span>
    </span>
  );
}
