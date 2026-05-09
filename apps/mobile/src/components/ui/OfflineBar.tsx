import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect, useRef, useState } from "react";
import { useConnectivity } from "@/hooks/useConnectivity";
import firestore from "@react-native-firebase/firestore";

export function OfflineBar() {
  const { isOnline } = useConnectivity();
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOffline = useRef(false);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      opacity.value = withRepeat(
        withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else if (wasOffline.current) {
      wasOffline.current = false;
      setIsSyncing(true);
      opacity.value = 1;

      const timeout = setTimeout(() => setIsSyncing(false), 5000);
      firestore()
        .waitForPendingWrites()
        .then(() => {
          clearTimeout(timeout);
          setIsSyncing(false);
        })
        .catch(() => {
          clearTimeout(timeout);
          setIsSyncing(false);
        });
    } else {
      opacity.value = 1;
    }
  }, [isOnline, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (isOnline && !isSyncing) return null;

  return (
    <Animated.View
      className={`h-[3px] w-full ${isSyncing ? "bg-accent" : "bg-warning"}`}
      style={animatedStyle}
    />
  );
}
