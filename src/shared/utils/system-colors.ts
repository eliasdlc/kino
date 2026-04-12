import type { ColorValue } from "@/shared/types/enums";

export interface SystemColorTokens {
  bg: string;
  bgSubtle: string;
  text: string;
  borderTop: string;
  dot: string;
}

const SYSTEM_COLORS: Record<ColorValue, SystemColorTokens> = {
  red:    { bg: "bg-red-500",    bgSubtle: "bg-red-500/10",    text: "text-red-500",    borderTop: "border-t-red-500",    dot: "bg-red-500"    },
  blue:   { bg: "bg-blue-500",   bgSubtle: "bg-blue-500/10",   text: "text-blue-500",   borderTop: "border-t-blue-500",   dot: "bg-blue-500"   },
  pink:   { bg: "bg-pink-500",   bgSubtle: "bg-pink-500/10",   text: "text-pink-500",   borderTop: "border-t-pink-500",   dot: "bg-pink-500"   },
  purple: { bg: "bg-purple-500", bgSubtle: "bg-purple-500/10", text: "text-purple-500", borderTop: "border-t-purple-500", dot: "bg-purple-500" },
  green:  { bg: "bg-green-500",  bgSubtle: "bg-green-500/10",  text: "text-green-500",  borderTop: "border-t-green-500",  dot: "bg-green-500"  },
  orange: { bg: "bg-orange-500", bgSubtle: "bg-orange-500/10", text: "text-orange-500", borderTop: "border-t-orange-500", dot: "bg-orange-500" },
  yellow: { bg: "bg-yellow-500", bgSubtle: "bg-yellow-500/10", text: "text-yellow-500", borderTop: "border-t-yellow-500", dot: "bg-yellow-500" },
  teal:   { bg: "bg-teal-500",   bgSubtle: "bg-teal-500/10",   text: "text-teal-500",   borderTop: "border-t-teal-500",   dot: "bg-teal-500"   },
  gray:   { bg: "bg-gray-500",   bgSubtle: "bg-gray-500/10",   text: "text-gray-500",   borderTop: "border-t-gray-500",   dot: "bg-gray-500"   },
  black:  { bg: "bg-gray-900",   bgSubtle: "bg-gray-900/10",   text: "text-gray-900",   borderTop: "border-t-gray-900",   dot: "bg-gray-900"   },
  white:  { bg: "bg-gray-200",   bgSubtle: "bg-gray-200/10",   text: "text-gray-200",   borderTop: "border-t-gray-300",   dot: "bg-gray-300"   },
};

const FALLBACK: SystemColorTokens = {
  bg: "bg-gray-500",
  bgSubtle: "bg-gray-500/10",
  text: "text-gray-500",
  borderTop: "border-t-gray-400",
  dot: "bg-gray-400",
};

export function getSystemColor(color: string): SystemColorTokens {
  return SYSTEM_COLORS[color as ColorValue] ?? FALLBACK;
}
