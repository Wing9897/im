import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { SIMPLE_MODE_STORAGE_KEY } from "../domain/ui/simpleMode";

type SimpleModeContextValue = {
  simpleMode: boolean;
  setSimpleMode: Dispatch<SetStateAction<boolean>>;
};

const SimpleModeContext = createContext<SimpleModeContextValue | null>(null);

/** Single shared simple-mode flag for shell + settings (avoids per-hook localStorage drift). */
export function SimpleModeProvider({ children }: { children?: ReactNode }) {
  const [simpleMode, setSimpleMode] = usePersistedState<boolean>(
    SIMPLE_MODE_STORAGE_KEY,
    false,
  );

  const value = useMemo(
    () => ({ simpleMode, setSimpleMode }),
    [simpleMode, setSimpleMode],
  );

  return (
    <SimpleModeContext.Provider value={value}>{children}</SimpleModeContext.Provider>
  );
}

/** Shared simple-mode toggle — must be under SimpleModeProvider. */
export function useSimpleMode(): SimpleModeContextValue {
  const value = useContext(SimpleModeContext);
  if (!value) {
    throw new Error(
      "useSimpleMode must be used within a <SimpleModeProvider>. " +
        "Wrap your component tree with <SimpleModeProvider> to resolve this error.",
    );
  }
  return value;
}
