export interface AppShortcut {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  label: string;
}

export const appShortcuts = {
  newDocument: {
    key: "n",
    ctrl: true,
    shift: false,
    alt: false,
    label: "Ctrl+N",
  },
  open: {
    key: "o",
    ctrl: true,
    shift: false,
    alt: false,
    label: "Ctrl+O",
  },
  save: {
    key: "s",
    ctrl: true,
    shift: false,
    alt: false,
    label: "Ctrl+S",
  },
  saveAs: {
    key: "s",
    ctrl: true,
    shift: true,
    alt: false,
    label: "Ctrl+Shift+S",
  },
  find: {
    key: "f",
    ctrl: true,
    shift: false,
    alt: false,
    label: "Ctrl+F",
  },
  replace: {
    key: "h",
    ctrl: true,
    shift: false,
    alt: false,
    label: "Ctrl+H",
  },
  toggleEditorMode: {
    key: "e",
    ctrl: true,
    shift: true,
    alt: false,
    label: "Ctrl+Shift+E",
  },
} as const;

export function matchesShortcut(event: KeyboardEvent, shortcut: AppShortcut) {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt
  );
}
