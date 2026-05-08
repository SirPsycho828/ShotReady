import { View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <View
      className={`bg-surface border border-border rounded-card p-md shadow-sm ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
