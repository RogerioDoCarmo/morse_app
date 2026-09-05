import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { usePorts } from '@/application/providers/PortsProvider';
import { isBlocked, type PermissionKind } from '@/core/domain/permission';
import { PermissionScreen } from '@/screens/PermissionScreen';

type Pending = Readonly<{ kind: PermissionKind; blocked: boolean }>;

type GateValue = Readonly<{
  /**
   * Resolves true once the permission is held. Shows the rationale first when
   * it is not, so the OS prompt is never the first thing a user sees.
   *
   * Resolving false is an ordinary outcome, not an error: both permissions are
   * optional, and the caller is expected to carry on without them.
   */
  ensure: (kind: PermissionKind) => Promise<boolean>;
}>;

const GateContext = createContext<GateValue | null>(null);

/**
 * Puts the app's own rationale in front of every system permission prompt.
 *
 * The gate covers the app rather than replacing it: a user who is asked for
 * the torch halfway through typing a message should still have that message
 * when they answer.
 */
export function PermissionGate({
  children,
}: Readonly<{ children: ReactNode }>): React.JSX.Element {
  const { permission } = usePorts();
  const [pending, setPending] = useState<Pending | null>(null);
  /** Resolves the promise `ensure` handed out for the gate now showing. */
  const answer = useRef<((granted: boolean) => void) | null>(null);

  const settle = useCallback((granted: boolean): void => {
    setPending(null);
    answer.current?.(granted);
    answer.current = null;
  }, []);

  const ensure = useCallback(
    async (kind: PermissionKind): Promise<boolean> => {
      const state = await permission.getState(kind);
      // Already held: no rationale, no prompt, nothing on screen at all.
      if (state?.granted === true) return true;

      return new Promise<boolean>((resolve) => {
        answer.current = resolve;
        setPending({ kind, blocked: isBlocked(state) });
      });
    },
    [permission],
  );

  const allow = useCallback(async (): Promise<void> => {
    if (pending === null) return;
    const state = await permission.request(pending.kind);
    if (state?.granted === true) {
      settle(true);
      return;
    }
    // A denial that used up the last ask turns this screen into the blocked
    // one rather than closing it: the way forward is now the settings app,
    // and saying so here is better than leaving the user to guess.
    if (isBlocked(state)) {
      setPending({ kind: pending.kind, blocked: true });
      return;
    }
    settle(false);
  }, [pending, permission, settle]);

  const openSettings = useCallback((): void => {
    void permission.openSettings();
    // Settled false because the answer cannot be known from here — the user is
    // leaving the app, and whatever they choose is read fresh next time.
    settle(false);
  }, [permission, settle]);

  const value = useMemo((): GateValue => ({ ensure }), [ensure]);

  return (
    <GateContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {pending === null ? null : (
          <View style={StyleSheet.absoluteFill}>
            <PermissionScreen
              kind={pending.kind}
              blocked={pending.blocked}
              onAllow={() => {
                void allow();
              }}
              onOpenSettings={openSettings}
              onDismiss={() => {
                settle(false);
              }}
            />
          </View>
        )}
      </View>
    </GateContext.Provider>
  );
}

/** Asks for a permission, rationale first. Throws outside the gate. */
export function usePermissionGate(): GateValue {
  const value = useContext(GateContext);
  if (value === null) {
    throw new Error('usePermissionGate must be used inside a PermissionGate.');
  }
  return value;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
