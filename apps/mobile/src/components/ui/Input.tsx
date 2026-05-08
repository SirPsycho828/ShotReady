import { View, Text, TextInput, type TextInputProps } from "react-native";
import { useState } from "react";
import { darkColors } from "@/theme/colors";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, onFocus, onBlur, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const borderClass = error
    ? "border-error"
    : isFocused
      ? "border-border-focus"
      : "border-border";

  return (
    <View>
      {label && (
        <Text className="text-caption text-text-secondary mb-xs">{label}</Text>
      )}
      <TextInput
        className={`h-[48px] rounded-input bg-surface px-md text-body text-text-primary border ${borderClass}`}
        placeholderTextColor={darkColors.textMuted}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text className="text-small text-error mt-xs">{error}</Text>
      )}
    </View>
  );
}
