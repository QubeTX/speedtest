import type { CSSProperties, ReactNode } from 'react';
import { useIsWide } from '../../hooks/useResponsive';
import { colors, borders } from '../../theme/tokens';

interface ApparatusProps {
  left: ReactNode;
  right: ReactNode;
}

/** Control-deck padding. Wide: a fluid clamp. Narrow: safe-area-aware insets so
 *  the deck clears notches/rounded corners on standalone iOS/Android. */
const DECK_PADDING_WIDE = 'clamp(2rem, 3vw, 3rem)';
const DECK_PADDING_NARROW =
  'max(0.75rem, env(safe-area-inset-top)) max(1.5rem, env(safe-area-inset-right)) 0.75rem max(1.5rem, env(safe-area-inset-left))';

export default function Apparatus({ left, right }: ApparatusProps) {
  const isWide = useIsWide();

  const style: CSSProperties = {
    width: '100%',
    maxWidth: isWide ? '1200px' : '600px',
    backgroundColor: colors.bgDevice,
    border: borders.stroke,
    borderRadius: borders.radiusBox,
    display: 'grid',
    gridTemplateColumns: isWide ? '1fr 1fr' : '1fr',
    // Clip children to the shell's rounded corners — the data panel's square
    // cards were overflowing them (visible as broken right/bottom corners).
    // Safe now that tooltips render in a document.body portal.
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
  };

  return (
    <div style={style}>
      {isWide && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: '3px',
            backgroundColor: colors.ink,
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}
        />
      )}
      <div
        style={{
          padding: isWide ? DECK_PADDING_WIDE : DECK_PADDING_NARROW,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          minHeight: 'auto',
        }}
      >
        {left}
      </div>
      <div
        style={{
          backgroundColor: colors.bgScreen,
          display: 'flex',
          flexDirection: 'column',
          borderTop: isWide ? 'none' : borders.stroke,
        }}
      >
        {right}
      </div>
    </div>
  );
}
