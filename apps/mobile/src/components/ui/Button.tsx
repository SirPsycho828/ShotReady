import { Pressable, Text, ActivityIndicator, type PressableProps } from "react-native";
import { darkColors } from "@/theme/colors";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

interface ButtonProps extends Omit<PressableProps, "children"> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent",
  secondary: "border border-accent bg-transparent",
  destructive: "bg-error",
  ghost: "bg-transparent",
};

const textClasses: Record<ButtonVariant, string> = {
  primary: "text-white text-body-medium",
  secondary: "text-accent text-body-medium",
  destructive: "text-white text-body-medium",
  ghost: "text-accent text-body-medium",
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  fullWidth = true,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const spinnerColor =
    variant === "secondary" || variant === "ghost"
      ? darkColors.accent
      : "#FFFFFF";

  return (
    <Pressable
      className={`h-[48px] rounded-button items-center justify-center px-md ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${isDisabled ? "opacity-40" : "active:opacity-85"}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size={20} color={spinnerColor} />
      ) : (
        <Text className={textClasses[variant]}>{title}</Text>
      )}
    </Pressable>
  );
}
