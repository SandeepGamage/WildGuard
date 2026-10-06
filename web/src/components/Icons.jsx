/** Small line icons (24px grid, drawn in the current text colour). Decorative: hidden from screen readers. */
const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

function Icon({ size = 18, children }) {
  return (
    <svg {...BASE} width={size} height={size}>
      {children}
    </svg>
  );
}

export const GridIcon = (props) => (
  <Icon {...props}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Icon>
);

export const FolderIcon = (props) => (
  <Icon {...props}>
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
  </Icon>
);

export const ClipboardIcon = (props) => (
  <Icon {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
  </Icon>
);

export const PinIcon = (props) => (
  <Icon {...props}>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icon>
);

export const TrendIcon = (props) => (
  <Icon {...props}>
    <path d="M4 19h16M6 15l4-4 3 3 5-6" />
  </Icon>
);

export const CalendarIcon = (props) => (
  <Icon {...props}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Icon>
);

export const SidebarIcon = (props) => (
  <Icon {...props}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M10 5v14" />
  </Icon>
);

export const LogoutIcon = (props) => (
  <Icon {...props}>
    <path d="M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
  </Icon>
);

export const ArrowUpIcon = (props) => (
  <Icon {...props}>
    <path d="M4 17l6-6 4 4 6-7M15 8h5v5" />
  </Icon>
);

export const ArrowDownIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7l6 6 4-4 6 7M15 16h5v-5" />
  </Icon>
);

export const CheckIcon = (props) => (
  <Icon {...props}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const SlidersIcon = (props) => (
  <Icon {...props}>
    <path d="M7 4v6M7 14v6M12 4v2M12 10v10M17 4v8M17 16v4" />
    <circle cx="7" cy="12" r="2" />
    <circle cx="12" cy="8" r="2" />
    <circle cx="17" cy="14" r="2" />
  </Icon>
);

export const ResetIcon = (props) => (
  <Icon {...props}>
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5" />
  </Icon>
);
