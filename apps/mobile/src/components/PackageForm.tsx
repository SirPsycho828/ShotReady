import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
} from "react-native";
import { useState } from "react";
import { Button, Input, Card } from "@/components/ui";
import { darkColors } from "@/theme/colors";
import { Check, Plus, X } from "lucide-react-native";

export interface PackageFormData {
  name: string;
  description: string;
  price: number; // cents
  deliverables: string[];
  shotListTemplate: string[];
  estimatedDuration: number; // minutes
}

interface PackageFormProps {
  initialData?: Partial<PackageFormData>;
  onSave: (data: PackageFormData) => Promise<void>;
  saveLabel?: string;
  showShotList?: boolean;
}

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480];

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parsePriceToCents(input: string): number {
  const num = parseFloat(input.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

export function PackageForm({
  initialData,
  onSave,
  saveLabel = "Save Package",
  showShotList = false,
}: PackageFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [priceText, setPriceText] = useState(
    initialData?.price ? formatPrice(initialData.price) : "",
  );
  const [deliverables, setDeliverables] = useState<string[]>(
    initialData?.deliverables?.length ? initialData.deliverables : [""],
  );
  const [shotList, setShotList] = useState<string[]>(
    initialData?.shotListTemplate ?? [],
  );
  const [duration, setDuration] = useState(initialData?.estimatedDuration ?? 60);
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateDeliverable(index: number, value: string) {
    const next = [...deliverables];
    next[index] = value;
    setDeliverables(next);
  }

  function removeDeliverable(index: number) {
    if (deliverables.length <= 1) return;
    setDeliverables(deliverables.filter((_, i) => i !== index));
  }

  function updateShotItem(index: number, value: string) {
    const next = [...shotList];
    next[index] = value;
    setShotList(next);
  }

  function removeShotItem(index: number) {
    setShotList(shotList.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const priceCents = parsePriceToCents(priceText);
    const trimmedDeliverables = deliverables.map((d) => d.trim()).filter(Boolean);

    if (!trimmedName) { setError("Package name is required"); return; }
    if (trimmedName.length > 60) { setError("Name must be 60 characters or less"); return; }
    if (!trimmedDesc) { setError("Description is required"); return; }
    if (trimmedDesc.length > 200) { setError("Description must be 200 characters or less"); return; }
    if (!priceText || priceCents <= 0) { setError("Enter a valid price"); return; }
    if (trimmedDeliverables.length === 0) { setError("At least one deliverable is required"); return; }
    if (trimmedDeliverables.length > 10) { setError("Maximum 10 deliverables"); return; }

    const trimmedShotList = shotList.map((s) => s.trim()).filter(Boolean);

    setError("");
    setSaving(true);
    try {
      await onSave({
        name: trimmedName,
        description: trimmedDesc,
        price: priceCents,
        deliverables: trimmedDeliverables,
        shotListTemplate: trimmedShotList,
        estimatedDuration: duration,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const previewPrice = parsePriceToCents(priceText);
  const previewDeliverables = deliverables.filter((d) => d.trim());

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-lg pb-2xl"
      keyboardShouldPersistTaps="handled"
    >
      {/* Live preview card */}
      <Card className="mb-lg mt-md">
        <View className="flex-row justify-between items-start">
          <Text className="text-h3 text-text-primary flex-1" numberOfLines={1}>
            {name || "Package Name"}
          </Text>
          <Text className="text-h3 text-text-primary ml-md">
            ${previewPrice > 0 ? formatPrice(previewPrice) : "0.00"}
          </Text>
        </View>
        <Text className="text-body text-text-secondary mt-xs" numberOfLines={2}>
          {description || "Package description"}
        </Text>
        {previewDeliverables.length > 0 && (
          <View className="mt-sm">
            {previewDeliverables.map((d, i) => (
              <View key={i} className="flex-row items-center mt-xs">
                <Check size={14} color={darkColors.accent} strokeWidth={2.5} />
                <Text className="text-caption text-text-secondary ml-xs">{d}</Text>
              </View>
            ))}
          </View>
        )}
        <Text className="text-caption text-text-muted mt-sm">
          Approx. {formatDuration(duration)}
        </Text>
      </Card>

      {/* Form fields */}
      <Input
        label="Package Name"
        value={name}
        onChangeText={setName}
        placeholder="Standard Listing"
        maxLength={60}
      />

      <View className="mt-md">
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Professional photos for your listing"
          maxLength={200}
          multiline
          numberOfLines={2}
        />
      </View>

      <View className="mt-md">
        <Input
          label="Price ($)"
          value={priceText}
          onChangeText={setPriceText}
          placeholder="250.00"
          keyboardType="decimal-pad"
        />
      </View>

      {/* Duration picker */}
      <View className="mt-md">
        <Text className="text-caption text-text-secondary mb-xs">Estimated Duration</Text>
        <Pressable
          className="h-[48px] rounded-input bg-surface px-md border border-border flex-row items-center justify-between"
          onPress={() => setDurationPickerVisible(true)}
        >
          <Text className="text-body text-text-primary">{formatDuration(duration)}</Text>
          <Text className="text-caption text-text-muted">Tap to change</Text>
        </Pressable>
      </View>

      {/* Deliverables */}
      <View className="mt-lg">
        <Text className="text-h3 text-text-primary mb-sm">Deliverables</Text>
        {deliverables.map((d, i) => (
          <View key={i} className="flex-row items-center mt-sm">
            <View className="flex-1">
              <Input
                value={d}
                onChangeText={(v) => updateDeliverable(i, v)}
                placeholder={i === 0 ? "25 edited photos" : "24-hour turnaround"}
                maxLength={80}
              />
            </View>
            {deliverables.length > 1 && (
              <Pressable className="ml-sm p-sm" onPress={() => removeDeliverable(i)}>
                <X size={20} color={darkColors.textMuted} />
              </Pressable>
            )}
          </View>
        ))}
        {deliverables.length < 10 && (
          <Pressable
            className="flex-row items-center mt-sm"
            onPress={() => setDeliverables([...deliverables, ""])}
          >
            <Plus size={18} color={darkColors.accent} />
            <Text className="text-body text-accent ml-xs">Add deliverable</Text>
          </Pressable>
        )}
      </View>

      {/* Shot list template (optional, shown in settings edit) */}
      {showShotList && (
        <View className="mt-lg">
          <Text className="text-h3 text-text-primary mb-xs">Shot List Template</Text>
          <Text className="text-caption text-text-muted mb-sm">
            Optional. Seeds the shot list for bookings using this package.
          </Text>
          {shotList.map((s, i) => (
            <View key={i} className="flex-row items-center mt-sm">
              <View className="flex-1">
                <Input
                  value={s}
                  onChangeText={(v) => updateShotItem(i, v)}
                  placeholder={["Front exterior", "Kitchen", "Living room", "Primary bedroom", "Primary bathroom", "Backyard"][i] ?? "Shot description"}
                />
              </View>
              <Pressable className="ml-sm p-sm" onPress={() => removeShotItem(i)}>
                <X size={20} color={darkColors.textMuted} />
              </Pressable>
            </View>
          ))}
          {shotList.length < 30 && (
            <Pressable
              className="flex-row items-center mt-sm"
              onPress={() => setShotList([...shotList, ""])}
            >
              <Plus size={18} color={darkColors.accent} />
              <Text className="text-body text-accent ml-xs">Add shot</Text>
            </Pressable>
          )}
        </View>
      )}

      {error !== "" && (
        <Text className="text-small text-error mt-md">{error}</Text>
      )}

      <View className="mt-lg">
        <Button title={saveLabel} onPress={handleSave} loading={saving} />
      </View>

      {/* Duration picker modal */}
      <Modal visible={durationPickerVisible} transparent animationType="slide">
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setDurationPickerVisible(false)}
        >
          <View className="bg-surface rounded-t-card pt-md pb-2xl">
            <Text className="text-h3 text-text-primary text-center mb-md">
              Select Duration
            </Text>
            <FlatList
              data={DURATION_OPTIONS}
              keyExtractor={(item) => String(item)}
              renderItem={({ item }) => (
                <Pressable
                  className={`py-sm px-lg ${item === duration ? "bg-accent/10" : ""}`}
                  onPress={() => { setDuration(item); setDurationPickerVisible(false); }}
                >
                  <Text className={`text-body text-center ${item === duration ? "text-accent" : "text-text-primary"}`}>
                    {formatDuration(item)}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
