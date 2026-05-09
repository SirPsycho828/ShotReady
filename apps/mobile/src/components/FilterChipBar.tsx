import { ScrollView, Pressable, Text } from "react-native";

interface Chip {
  key: string;
  label: string;
}

interface FilterChipBarProps {
  chips: Chip[];
  activeChip: string;
  onSelect: (key: string) => void;
}

export function FilterChipBar({ chips, activeChip, onSelect }: FilterChipBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-sm"
    >
      {chips.map((chip) => {
        const isActive = chip.key === activeChip;
        return (
          <Pressable
            key={chip.key}
            onPress={() => onSelect(chip.key)}
            className={`px-md py-xs rounded-pill ${isActive ? "bg-accent" : "bg-surface-raised"}`}
          >
            <Text
              className={`text-caption ${isActive ? "text-white" : "text-text-secondary"}`}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
