import React from 'react';

type AvatarProps = {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  isOnline?: boolean;
  hasWarningBadge?: boolean;
};

export default function Avatar({ name, size = 'md', isOnline, hasWarningBadge }: AvatarProps) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(1 % name.length) * 13) % 360;
  
  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  const warningDotSize = size === 'sm' ? 'w-2.5 h-2.5' : size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5';

  return (
    <div className="relative inline-flex flex-shrink-0">
      <div
        className={`${sz} rounded-full flex items-center justify-center font-semibold text-white select-none`}
        style={{ backgroundColor: `hsl(${hue},55%,28%)`, boxShadow: `0 0 0 1px hsl(${hue},55%,42%)` }}
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </div>
      
      {hasWarningBadge && (
        <span 
          className={`absolute -top-0.5 -right-0.5 ${warningDotSize} rounded-full`} 
          style={{ background: 'var(--color-ui-warning-bg)', border: '1px solid var(--color-ui-warning-border)' }} 
          aria-hidden="true" 
        />
      )}
      
      {!hasWarningBadge && isOnline && (
        <span 
          className={`absolute bottom-0 right-0 ${dotSize} rounded-full border-[var(--color-ui-surface)] shadow-sm`}
          style={{ background: 'var(--color-ui-success)', borderWidth: size === 'sm' ? '1.5px' : '2px' }}
          aria-hidden="true" 
        />
      )}
    </div>
  );
}
