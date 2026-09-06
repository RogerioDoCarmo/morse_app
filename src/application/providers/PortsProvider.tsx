import React, { createContext, useContext, type ReactNode } from 'react';
import type { Ports } from '@/core/ports';

const PortsContext = createContext<Ports | null>(null);

/**
 * Injects the ports once, at the root. Screens and hooks read them from here
 *  and never import an adapter directly.
 */
export function PortsProvider({
  ports,
  children,
}: Readonly<{ ports: Ports; children: ReactNode }>): React.JSX.Element {
  return <PortsContext.Provider value={ports}>{children}</PortsContext.Provider>;
}

/**
 * Reads the injected ports. Throws rather than returning a half-built app if
 *  a component is mounted outside the provider.
 */
export function usePorts(): Ports {
  const ports = useContext(PortsContext);
  if (ports === null) {
    throw new Error('usePorts must be used inside a PortsProvider.');
  }
  return ports;
}
