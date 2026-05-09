import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { Button } from "@/components/ui";
import { useInvoice } from "@/hooks/useInvoice";
import { darkColors } from "@/theme/colors";
import { Plus, X } from "lucide-react-native";
import functions from "@react-native-firebase/functions";

interface InvoiceEditorProps {
  invoiceId: string;
  isOnline: boolean;
}

function formatDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseDollars(text: string): number {
  const num = parseFloat(text.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function InvoiceEditor({ invoiceId, isOnline }: InvoiceEditorProps) {
  const { invoice, loading, updateLineItems } = useInvoice(invoiceId);
  const [sending, setSending] = useState(false);

  if (loading || !invoice) {
    return (
      <View className="py-md items-center">
        <Text className="text-body text-text-secondary">Loading invoice...</Text>
      </View>
    );
  }

  function handleDescriptionChange(index: number, description: string) {
    const updated = [...invoice!.lineItems];
    updated[index] = { ...updated[index], description };
    updateLineItems(updated);
  }

  function handleAmountChange(index: number, text: string) {
    const updated = [...invoice!.lineItems];
    updated[index] = { ...updated[index], amount: parseDollars(text) };
    updateLineItems(updated);
  }

  function handleAdd() {
    updateLineItems([...invoice!.lineItems, { description: "", amount: 0 }]);
  }

  function handleRemove(index: number) {
    if (invoice!.lineItems.length <= 1) return;
    updateLineItems(invoice!.lineItems.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if (invoice!.total <= 0) {
      Alert.alert("Invalid Invoice", "Invoice total must be greater than zero.");
      return;
    }
    Alert.alert(
      "Send Invoice",
      `Send invoice for $${formatDollars(invoice!.total)} to the agent?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            setSending(true);
            try {
              await functions().httpsCallable("paymentsSendInvoice")({
                invoiceId,
              });
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : "Failed to send invoice.";
              Alert.alert("Error", message);
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View className="bg-surface border border-border rounded-card p-md">
      <Text className="text-caption text-text-muted mb-sm">Invoice Draft</Text>

      {invoice.lineItems.map((item, index) => (
        <View key={index} className="flex-row items-center mb-sm">
          <TextInput
            className="flex-1 text-body text-text-primary bg-background border border-border rounded-sm px-sm py-xs mr-sm"
            value={item.description}
            onChangeText={(t) => handleDescriptionChange(index, t)}
            placeholder="Description"
            placeholderTextColor={darkColors.textMuted}
            maxLength={100}
          />
          <TextInput
            className="w-[90px] text-body text-text-primary bg-background border border-border rounded-sm px-sm py-xs mr-xs text-right"
            defaultValue={formatDollars(item.amount)}
            onEndEditing={(e) => handleAmountChange(index, e.nativeEvent.text)}
            placeholder="0.00"
            placeholderTextColor={darkColors.textMuted}
            keyboardType="decimal-pad"
          />
          {invoice.lineItems.length > 1 && (
            <Pressable onPress={() => handleRemove(index)} hitSlop={8}>
              <X size={18} color={darkColors.textMuted} />
            </Pressable>
          )}
        </View>
      ))}

      <Pressable onPress={handleAdd} className="flex-row items-center mb-md">
        <Plus size={16} color={darkColors.accent} />
        <Text className="text-body text-accent ml-xs">Add Line Item</Text>
      </Pressable>

      <View className="flex-row justify-between items-center mb-md border-t border-border pt-sm">
        <Text className="text-body text-text-secondary font-semibold">Total</Text>
        <Text className="text-h2 text-text-primary">${formatDollars(invoice.total)}</Text>
      </View>

      <Button
        title="Send Invoice"
        onPress={handleSend}
        disabled={!isOnline || sending}
        loading={sending}
      />
    </View>
  );
}
