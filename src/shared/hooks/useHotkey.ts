"use client";

import { useEffect, useRef } from 'react';

type HotkeyOptions = {
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enableInInputs?: boolean;
  enabled?: boolean;
};

/**
 * A custom hook to listen for keyboard shortcuts.
 * Automatically ignores keystrokes when the user is typing in an input field.
 * 
 * @param keyCombos - A string or array of strings representing the key combo (e.g. "mod+k", "enter", ["mod+i", "ctrl+i"])
 * @param callback - Function to execute when the hotkey is triggered
 * @param options - Additional configuration options
 */
export function useHotkey(
  keyCombos: string | string[],
  callback: (e: KeyboardEvent) => void,
  options: HotkeyOptions = {}
) {
  const { preventDefault = true, stopPropagation = true, enableInInputs = false, enabled = true } = options;
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if user is typing in an input, textarea, or contenteditable
      if (!enableInInputs) {
        const target = event.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      const combos = Array.isArray(keyCombos) ? keyCombos : [keyCombos];

      for (const combo of combos) {
        let normalizedCombo = combo.toLowerCase();
        if (normalizedCombo === " ") normalizedCombo = "space";
        
        const keys = normalizedCombo.split('+').map((k) => k.trim());
        
        const reqMod = keys.includes('mod') || keys.includes('cmd') || keys.includes('ctrl');
        const reqShift = keys.includes('shift');
        const reqAlt = keys.includes('alt');
        
        const nonModifierKey = keys.find((k) => !['mod', 'cmd', 'ctrl', 'shift', 'alt'].includes(k));
        
        // mod checks for either metaKey (Mac Cmd) or ctrlKey (Windows Ctrl)
        const isModPressed = event.metaKey || event.ctrlKey;
        const isShiftPressed = event.shiftKey;
        const isAltPressed = event.altKey;

        if (
          reqMod === isModPressed &&
          reqShift === isShiftPressed &&
          reqAlt === isAltPressed
        ) {
           let keyToCheck = event.key.toLowerCase();
           if (keyToCheck === ' ') keyToCheck = 'space';
           
           if (nonModifierKey && keyToCheck === nonModifierKey) {
              if (preventDefault) event.preventDefault();
              if (stopPropagation) event.stopPropagation();
              callbackRef.current(event);
              return; // Stop checking other combos once a match is found
           }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyCombos, preventDefault, stopPropagation, enableInInputs]);
}
