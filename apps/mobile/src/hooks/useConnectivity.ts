import { useNetInfo } from "@react-native-community/netinfo";

export function useConnectivity() {
  const netInfo = useNetInfo();
  // netInfo.isConnected is boolean | null (null during initialization)
  // Treat null as online (optimistic) to avoid false offline indicators on startup
  const isOnline = netInfo.isConnected !== false;
  return { isOnline };
}
