// Physical Post-it palette: solid paper color + ink text color per note color.
export const STICKY_NOTE_COLORS: Record<string, {
  bg: string;
  text: string;
  border: string;
  /** Solid paper background color */
  hex: string;
  /** Ink / text color */
  textHex: string;
}> = {
  yellow:  { bg: "bg-yellow-100 dark:bg-yellow-900/40",  text: "text-yellow-900 dark:text-yellow-100",  border: "border-yellow-200 dark:border-yellow-800",  hex: "#FFE066", textHex: "#4A3500" },
  pink:    { bg: "bg-pink-100 dark:bg-pink-900/40",      text: "text-pink-900 dark:text-pink-100",      border: "border-pink-200 dark:border-pink-800",      hex: "#FFB3C1", textHex: "#5C0A22" },
  blue:    { bg: "bg-blue-100 dark:bg-blue-900/40",      text: "text-blue-900 dark:text-blue-100",      border: "border-blue-200 dark:border-blue-800",      hex: "#9CD8FF", textHex: "#093658" },
  green:   { bg: "bg-green-100 dark:bg-green-900/40",    text: "text-green-900 dark:text-green-100",    border: "border-green-200 dark:border-green-800",    hex: "#A8EDB0", textHex: "#0C3D12" },
  purple:  { bg: "bg-purple-100 dark:bg-purple-900/40",  text: "text-purple-900 dark:text-purple-100",  border: "border-purple-200 dark:border-purple-800",  hex: "#C9BCFF", textHex: "#1F0F5C" },
  orange:  { bg: "bg-orange-100 dark:bg-orange-900/40",  text: "text-orange-900 dark:text-orange-100",  border: "border-orange-200 dark:border-orange-800",  hex: "#FFC487", textHex: "#5A2A00" },
  teal:    { bg: "bg-teal-100 dark:bg-teal-900/40",      text: "text-teal-900 dark:text-teal-100",      border: "border-teal-200 dark:border-teal-800",      hex: "#9CEFE2", textHex: "#053F38" },
  red:     { bg: "bg-red-100 dark:bg-red-900/40",        text: "text-red-900 dark:text-red-100",        border: "border-red-200 dark:border-red-800",        hex: "#FFA8A8", textHex: "#5A0000" },
  gray:    { bg: "bg-gray-100 dark:bg-gray-800",         text: "text-gray-900 dark:text-gray-100",      border: "border-gray-200 dark:border-gray-700",      hex: "#E2E2E2", textHex: "#1F1F1F" },
  black:   { bg: "bg-gray-900",                          text: "text-gray-100",                         border: "border-gray-700",                           hex: "#33312E", textHex: "#F0EFEC" },
  white:   { bg: "bg-white dark:bg-gray-950",            text: "text-gray-900 dark:text-gray-100",      border: "border-gray-200 dark:border-gray-800",      hex: "#FCFBF7", textHex: "#1F1F1F" },
};

export const COLOR_PICKER_OPTIONS = Object.keys(STICKY_NOTE_COLORS) as Array<keyof typeof STICKY_NOTE_COLORS>;

/** Shared CSS for the Post-it paper surface (solid color + soft lifted shadow). */
export function paperStyle(hex: string): React.CSSProperties {
  return {
    backgroundColor: hex,
    boxShadow: "0 1px 2px rgba(0,0,0,0.12), 0 10px 22px -10px rgba(0,0,0,0.4)",
  };
}
