import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  withGlow?: boolean;
}

export function Logo({
  size = 28,
  className = "",
  withGlow = false,
  ...props
}: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-220 -220 440 440"
      width={size}
      height={size}
      fill="none"
      className={`shrink-0 ${withGlow ? "filter drop-shadow-[0_0_8px_rgba(47,228,141,0.5)]" : ""} ${className}`}
      aria-label="MeZShip Radar Logo"
      {...props}
    >
      {/* Outer Ring Segments */}
      <path
        d="M 168.96 -107.03 A 200.00 200.00 0 1 0 -87.71 179.80"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
      />
      <path
        d="M -55.13 192.25 A 200.00 200.00 0 0 0 105.98 169.61"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
      />
      <path
        d="M 185.44 -74.92 A 200.00 200.00 0 0 1 165.81 111.84"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
      />

      {/* Middle Ring Arc with Progressive Trail Fade */}
      <path
        d="M 127.16 27.03 A 130.00 130.00 0 1 0 -83.56 99.59"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
      />
      <path
        d="M -83.56 99.59 A 130.00 130.00 0 0 1 -129.56 10.70"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
        opacity="0.70"
      />
      <path
        d="M -129.56 10.70 A 130.00 130.00 0 0 1 -112.58 -65.00"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
        opacity="0.38"
      />
      <path
        d="M -112.58 -65.00 A 130.00 130.00 0 0 1 -76.41 -105.17"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
        opacity="0.14"
      />

      {/* Inner Ring Arc with Progressive Trail Fade */}
      <path
        d="M 60.14 -21.89 A 64.00 64.00 0 1 0 -27.05 58.00"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
      />
      <path
        d="M -27.05 58.00 A 64.00 64.00 0 0 1 -60.14 21.89"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
        opacity="0.65"
      />
      <path
        d="M -60.14 21.89 A 64.00 64.00 0 0 1 -60.14 -21.89"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
        opacity="0.30"
      />
      <path
        d="M -60.14 -21.89 A 64.00 64.00 0 0 1 -42.84 -47.49"
        stroke="#2FE48D"
        strokeWidth="12.5"
        strokeLinecap="round"
        opacity="0.12"
      />

      {/* Radar Scanner Sweep Arm */}
      <line
        x1="0"
        y1="0"
        x2="141.42"
        y2="141.42"
        stroke="#2FE48D"
        strokeWidth="10.5"
        strokeLinecap="round"
      />

      {/* Center Pivot Dot */}
      <circle cx="0" cy="0" r="15" fill="#2FE48D" />

      {/* Outer Target Blip */}
      <circle cx="141.42" cy="141.42" r="25" fill="#2FE48D" />
    </svg>
  );
}

export default Logo;
