import { createContext, useContext } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';

export const DocsNavigationContext = createContext<{
  active: boolean;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  triggerRef: RefObject<HTMLButtonElement | null>;
} | null>(null);

export function useDocsNavigation() {
  const context = useContext(DocsNavigationContext);
  if (!context) throw new Error('Documentation navigation requires MainLayout');
  return context;
}
