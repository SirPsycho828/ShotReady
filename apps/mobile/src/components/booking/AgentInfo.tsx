import { View, Text, Pressable, Linking } from "react-native";
import { Card } from "@/components/ui";
import { User, Mail, Phone, Building2 } from "lucide-react-native";
import { darkColors } from "@/theme/colors";

interface AgentInfoProps {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
}

export function AgentInfo({ name, email, phone, company }: AgentInfoProps) {
  return (
    <Card>
      <View className="flex-row items-center">
        <User size={18} color={darkColors.accent} />
        <Text className="text-body-medium text-text-primary ml-sm">{name}</Text>
      </View>

      <Pressable
        className="flex-row items-center mt-md"
        onPress={() => Linking.openURL(`mailto:${email}`)}
      >
        <Mail size={16} color={darkColors.textMuted} />
        <Text className="text-caption text-accent ml-sm">{email}</Text>
      </Pressable>

      {phone && (
        <Pressable
          className="flex-row items-center mt-sm"
          onPress={() => Linking.openURL(`tel:${phone}`)}
        >
          <Phone size={16} color={darkColors.textMuted} />
          <Text className="text-caption text-accent ml-sm">{phone}</Text>
        </Pressable>
      )}

      {company && (
        <View className="flex-row items-center mt-sm">
          <Building2 size={16} color={darkColors.textMuted} />
          <Text className="text-caption text-text-secondary ml-sm">{company}</Text>
        </View>
      )}
    </Card>
  );
}
