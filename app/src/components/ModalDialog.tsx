import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  className: string;
  titleId: string;
  descriptionId: string;
  onDismiss(): void;
  children: ReactNode;
}

export function ModalDialog({
  className,
  titleId,
  descriptionId,
  onDismiss,
  children,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    element
      ?.querySelector<HTMLElement>("[data-dialog-initial-focus]")
      ?.focus({ preventScroll: true });
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  // A portal keeps modal content out of the editor's CSS grid.
  return createPortal(
    <dialog
      ref={dialog}
      className={className}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== "Tab") return;
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        );
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      {children}
    </dialog>,
    document.body,
  );
}
