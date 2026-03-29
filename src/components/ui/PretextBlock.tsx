import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import { usePretext } from '../../providers/PretextProvider';

interface PretextBlockProps {
  /** Registry entry ID to measure */
  entryId: string;
  children: ReactNode;
  /** Additional inline styles (pretext additions are merged in) */
  style?: CSSProperties;
}

/**
 * Wrapper component that uses pretext to apply purely additive layout styles.
 *
 * - Adds `minHeight` based on pretext's measurement of the worst-case text
 *   for the given registry entry at the current container width.
 * - Never touches: grid, flex, display, padding, margin, or font properties.
 * - If pretext is not ready or container width is unknown, renders children
 *   with only the original style -- zero pretext additions.
 */
export default function PretextBlock({
  entryId,
  children,
  style,
}: PretextBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const { isReady, getLayout } = usePretext();

  let pretextStyle: CSSProperties | undefined;

  if (isReady && containerWidth !== null) {
    const result = getLayout(entryId, containerWidth);
    if (result) {
      pretextStyle = { minHeight: result.height };
    }
  }

  return (
    <div ref={containerRef} style={{ ...style, ...pretextStyle }}>
      {children}
    </div>
  );
}
