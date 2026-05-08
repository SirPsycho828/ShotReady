import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useNetInfo } from "@react-native-community/netinfo";
import { useEffect } from "react";

export function OfflineBar() {
  const netInfo = useNetInfo();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (netInfo.isConnected === false) {
      opacity.value = withRepeat(
        withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      opacity.value = 1;
    }
  }, [netInfo.isConnected, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (netInfo.isConnected !== false) return null;

  return <Animated.View className="h-[3px] bg-warning w-full" style={animatedStyle} />;
}
