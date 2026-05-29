interface FilterChip {
  key: string;
  label: string;
}

interface FilterChipBarProps {
  chips: FilterChip[];
  active: string;
  onSelect: (key: string) => void;
}

export function FilterChipBar({ chips, active, onSelect }: FilterChipBarProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {chips.map((chip) => {
        const isActive = chip.key === active;
        return (
          <button
            key={chip.key}
            onClick={() => onSelect(chip.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
