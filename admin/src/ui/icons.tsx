import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 24, children, ...rest }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function Ball(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m12 7 4 3-1.5 5h-5L8 10z" />
      <path d="M12 7V2.5M16 10l4.5-1.5M14.5 15l2.5 4M9.5 15 7 19M8 10 3.5 8.5" />
    </Svg>
  )
}

export function Scoreboard(props: Props) {
  return (
    <Svg {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M12 5v14" />
      <path d="M6 10h2v4M15.5 10h3v2h-3v2h3" />
    </Svg>
  )
}
