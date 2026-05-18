// Maps colorEnum values to Tailwind background + text classes for sticky notes
export const STICKY_NOTE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  yellow:  { bg: "bg-yellow-100 dark:bg-yellow-900/40",  text: "text-yellow-900 dark:text-yellow-100",  border: "border-yellow-200 dark:border-yellow-800" },
  pink:    { bg: "bg-pink-100 dark:bg-pink-900/40",      text: "text-pink-900 dark:text-pink-100",      border: "border-pink-200 dark:border-pink-800" },
  blue:    { bg: "bg-blue-100 dark:bg-blue-900/40",      text: "text-blue-900 dark:text-blue-100",      border: "border-blue-200 dark:border-blue-800" },
  green:   { bg: "bg-green-100 dark:bg-green-900/40",    text: "text-green-900 dark:text-green-100",    border: "border-green-200 dark:border-green-800" },
  purple:  { bg: "bg-purple-100 dark:bg-purple-900/40",  text: "text-purple-900 dark:text-purple-100",  border: "border-purple-200 dark:border-purple-800" },
  orange:  { bg: "bg-orange-100 dark:bg-orange-900/40",  text: "text-orange-900 dark:text-orange-100",  border: "border-orange-200 dark:border-orange-800" },
  teal:    { bg: "bg-teal-100 dark:bg-teal-900/40",      text: "text-teal-900 dark:text-teal-100",      border: "border-teal-200 dark:border-teal-800" },
  red:     { bg: "bg-red-100 dark:bg-red-900/40",        text: "text-red-900 dark:text-red-100",        border: "border-red-200 dark:border-red-800" },
  gray:    { bg: "bg-gray-100 dark:bg-gray-800",         text: "text-gray-900 dark:text-gray-100",      border: "border-gray-200 dark:border-gray-700" },
  black:   { bg: "bg-gray-900",                          text: "text-gray-100",                         border: "border-gray-700" },
  white:   { bg: "bg-white dark:bg-gray-950",            text: "text-gray-900 dark:text-gray-100",      border: "border-gray-200 dark:border-gray-800" },
};

export const COLOR_PICKER_OPTIONS = Object.keys(STICKY_NOTE_COLORS) as Array<keyof typeof STICKY_NOTE_COLORS>;
