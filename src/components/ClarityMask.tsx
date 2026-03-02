import { type ReactNode } from "react";

interface ClarityMaskProps {
  children: ReactNode;
  className?: string;
  /** Set to true to explicitly UNMASK (use only for 100% non-sensitive static content) */
  unmask?: boolean;
}

/**
 * Wraps children with `data-clarity-mask="true"` so that Microsoft Clarity
 * masks the contents in session recordings / heatmaps.
 *
 * Usage:
 *   <ClarityMask>
 *     <SensitiveComponent />
 *   </ClarityMask>
 */
export function ClarityMask({ children, className, unmask }: ClarityMaskProps) {
  if (unmask) {
    return (
      <div data-clarity-unmask="true" className={className}>
        {children}
      </div>
    );
  }

  return (
    <div data-clarity-mask="true" className={className}>
      {children}
    </div>
  );
}
