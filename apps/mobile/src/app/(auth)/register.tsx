import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { Link } from "expo-router";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!businessName || !email || !password) {
      setError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await register(email.trim(), password, businessName.trim());
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-lg"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-h1 text-text-primary text-center">
          Create Account
        </Text>
        <Text className="text-body text-text-secondary text-center mt-sm mb-xl">
          Set up your photography business
        </Text>

        <Input
          label="Business Name"
          value={businessName}
          onChangeText={setBusinessName}
          autoCapitalize="words"
          textContentType="organizationName"
          placeholder="e.g. Smith Photography"
        />

        <View className="mt-md">
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
        </View>

        <View className="mt-md">
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="6+ characters"
          />
        </View>

        {error !== "" && (
          <Text className="text-small text-error mt-sm">{error}</Text>
        )}

        <View className="mt-lg">
          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
          />
        </View>

        <View className="mt-xl flex-row justify-center">
          <Text className="text-body text-text-secondary">
            {"Already have an account? "}
          </Text>
          <Link href="/(auth)/login">
            <Text className="text-body text-accent">Sign In</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
