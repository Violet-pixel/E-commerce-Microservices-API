export const LogoMark = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
    <rect width="100" height="100" fill="#000" />
    <path d="M34 44A16 16 0 0 1 66 44" fill="none" stroke="#fff" strokeWidth="5" />
    <g fill="#fff">
      <rect x="25" y="46" width="11" height="9" />
      <rect x="38" y="46" width="11" height="9" />
      <rect x="51" y="46" width="11" height="9" />
      <rect x="64" y="46" width="11" height="9" />
      <rect x="29" y="58" width="13" height="9" />
      <rect x="44" y="58" width="12" height="9" />
      <rect x="58" y="58" width="13" height="9" />
      <rect x="34" y="70" width="32" height="7" />
    </g>
  </svg>
);
