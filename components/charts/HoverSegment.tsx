'use client';

import { C } from '@/lib/theme';

interface HoverSegmentProps {
  color: string;
  isFirst: boolean;
  isLast: boolean;
  isSingle: boolean;
  borderRadiusWhenRounded: number;
  tooltip: React.ReactNode;
  tooltipMarginBottom?: number;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function HoverSegment({
  color,
  isFirst,
  isLast,
  isSingle,
  borderRadiusWhenRounded,
  tooltip,
  tooltipMarginBottom = 8,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  children,
  style,
}: HoverSegmentProps) {
  const borderRadiusStyle =
    isSingle
      ? borderRadiusWhenRounded
      : isFirst
        ? `${borderRadiusWhenRounded}px 0 0 ${borderRadiusWhenRounded}px`
        : isLast
          ? `0 ${borderRadiusWhenRounded}px ${borderRadiusWhenRounded}px 0`
          : 0;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'relative',
        background: color,
        cursor: 'pointer',
        borderRadius: borderRadiusStyle,
        ...style,
      }}
    >
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: tooltipMarginBottom,
            background: C.ink,
            color: C.white,
            fontSize: 11.5,
            fontWeight: 600,
            padding: '5px 9px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow-2)',
            zIndex: 5,
          }}
        >
          {tooltip}
        </div>
      )}
      {children}
    </div>
  );
}
