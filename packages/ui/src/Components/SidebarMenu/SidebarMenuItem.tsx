import type { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../Utils/classNames.ts';

export type SidebarMenuItemProps = {
  link: string;
  current?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
};

export const SidebarMenuItem: FC<SidebarMenuItemProps> = ({
  link,
  current,
  disabled,
  expanded = true,
  icon,
  children,
}) => {
  const className = cn(
    'mdd-sbm-item',
    current && 'mdd-sbm-item--current',
    disabled && 'mdd-sbm-item--disabled',
    !expanded && 'mdd-sbm-item--collapsed',
  );

  const inner = (
    <span
      className={className}
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {icon ? <span style={{ flexShrink: 0 }}>{icon}</span> : null}
      {expanded ? children : null}
    </span>
  );

  if (disabled) return inner;
  return <Link to={link}>{inner}</Link>;
};

export default SidebarMenuItem;
