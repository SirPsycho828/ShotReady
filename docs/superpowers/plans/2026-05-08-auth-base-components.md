# Auth & Base Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Firebase Auth integration (login, register, password reset, auth-gated routing) and 6 base UI components (Button, Input, Card, StatusPill, SkeletonLoader, OfflineBar) for the mobile app.

**Architecture:** Auth uses React context wrapping Firebase Auth SDK with `onAuthStateChanged` listener. Registration creates both a Firebase Auth user and a Firestore photographer document. Expo Router's `useSegments` handles auth-gated routing. Base components follow the design system in `docs/planning/04_UI_Design_System.md` using NativeWind classes.

**Tech Stack:** React Native, Expo Router, NativeWind 4, @react-native-firebase/auth, @react-native-firebase/firestore, react-native-reanimated, @react-native-community/netinfo

---

## File Structure

```
apps/mobile/
├── src/
│   ├── components/
│   │   └── ui/
│   │       ├── Button.tsx          # Create — 4 variants (primary/secondary/destructive/ghost), loading state
│   │       ├── Input.tsx           # Create — label, error state, focus border
│   │       ├── Card.tsx            # Create — surface container with border + shadow
│   │       ├── StatusPill.tsx      # Create — booking status badges with per-status colors
│   │       ├── SkeletonLoader.tsx  # Create — Reanimated pulse animation on surfaceRaised
│   │       ├── OfflineBar.tsx      # Create — 3px warning bar when offline, uses NetInfo
│   │       └── index.ts           # Create — barrel export
│   ├── contexts/
│   │   └── AuthContext.tsx         # Create — Firebase Auth state, login/register/logout/resetPassword
│   ├── app/
│   │   ├── _layout.tsx            # Modify — wrap with AuthProvider, add auth-gated routing
│   │   ├── (auth)/
│   │   │   ├── login.tsx          # Modify — real form with email/password inputs, forgot password
│   │   │   └── register.tsx       # Modify — real form with business name + email + password
```

## Parallelization Notes

Tasks 1–6 (all UI components) are independent — dispatch in parallel.
Task 7 (auth context) is independent of components — can also run in parallel with 1–6.
Tasks 8–10 depend on both components and auth context — run sequentially after 1–7.

---

### Task 1: Button Component

**Files:**
- Create: `apps/mobile/src/components/ui/Button.tsx`

- [ ] **Step 1: Create Button component**

```tsx
// apps/mobile/src/components/ui/Button.tsx
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
```

- [ ] **Step 2: Verify file created correctly**

Run: `ls apps/mobile/src/components/ui/Button.tsx`
Expected: file exists

---

### Task 2: Input Component

**Files:**
- Create: `apps/mobile/src/components/ui/Input.tsx`

- [ ] **Step 1: Create Input component**

```tsx
// apps/mobile/src/components/ui/Input.tsx
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
```

- [ ] **Step 2: Verify file created correctly**

Run: `ls apps/mobile/src/components/ui/Input.tsx`
Expected: file exists

---

### Task 3: Card Component

**Files:**
- Create: `apps/mobile/src/components/ui/Card.tsx`

- [ ] **Step 1: Create Card component**

```tsx
// apps/mobile/src/components/ui/Card.tsx
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
```

- [ ] **Step 2: Verify file created correctly**

Run: `ls apps/mobile/src/components/ui/Card.tsx`
Expected: file exists

---

### Task 4: StatusPill Component

**Files:**
- Create: `apps/mobile/src/components/ui/StatusPill.tsx`

- [ ] **Step 1: Create StatusPill component**

The status pill colors come from `docs/planning/04_UI_Design_System.md`. Statuses like `shooting` and `paid` use solid backgrounds with white text; others use 15% opacity backgrounds with colored text.

```tsx
// apps/mobile/src/components/ui/StatusPill.tsx
import { View, Text } from "react-native";
import type { BookingStatus } from "@shotready/shared";

const STATUS_CONFIG: Record<BookingStatus, { bg: string; text: string; label: string }> = {
  pending:   { bg: "bg-warning/15",       text: "text-warning",        label: "Pending" },
  confirmed: { bg: "bg-accent/15",        text: "text-accent",         label: "Confirmed" },
  shooting:  { bg: "bg-accent",           text: "text-white",          label: "Shooting" },
  editing:   { bg: "bg-info/15",          text: "text-info",           label: "Editing" },
  proofing:  { bg: "bg-warning/15",       text: "text-warning",        label: "Proofing" },
  delivered: { bg: "bg-success/15",       text: "text-success",        label: "Delivered" },
  invoiced:  { bg: "bg-accent/15",        text: "text-accent",         label: "Invoiced" },
  overdue:   { bg: "bg-error/15",         text: "text-error",          label: "Overdue" },
  paid:      { bg: "bg-success",          text: "text-white",          label: "Paid" },
  closed:    { bg: "bg-surface-raised",   text: "text-text-secondary", label: "Closed" },
  declined:  { bg: "bg-error/15",         text: "text-error",          label: "Declined" },
  cancelled: { bg: "bg-surface-raised",   text: "text-text-secondary", label: "Cancelled" },
};

interface StatusPillProps {
  status: BookingStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View className={`h-[24px] px-[10px] rounded-pill items-center justify-center ${config.bg}`}>
      <Text className={`text-small ${config.text}`}>{config.label}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Verify file created correctly**

Run: `ls apps/mobile/src/components/ui/StatusPill.tsx`
Expected: file exists

---

### Task 5: SkeletonLoader Component

**Files:**
- Create: `apps/mobile/src/components/ui/SkeletonLoader.tsx`

- [ ] **Step 1: Create SkeletonLoader component**

Uses Reanimated (already installed) for a pulsing opacity animation on `surfaceRaised` background. Per spec: 1.5s duration, infinite loop.

```tsx
// apps/mobile/src/components/ui/SkeletonLoader.tsx
import { type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";

interface SkeletonLoaderProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonLoaderProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="bg-surface-raised"
      style={[{ width, height, borderRadius }, animatedStyle, style]}
    />
  );
}
```

- [ ] **Step 2: Verify file created correctly**

Run: `ls apps/mobile/src/components/ui/SkeletonLoader.tsx`
Expected: file exists

---

### Task 6: OfflineBar Component

**Files:**
- Create: `apps/mobile/src/components/ui/OfflineBar.tsx`

- [ ] **Step 1: Install @react-native-community/netinfo**

Run: `cd apps/mobile && pnpm add @react-native-community/netinfo`

- [ ] **Step 2: Create OfflineBar component**

Per spec: 3px-tall bar below status bar. Warning color with pulse when offline. Hidden when online.

```tsx
// apps/mobile/src/components/ui/OfflineBar.tsx
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

  if (netInfo.isConnected !== false) return null;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View className="h-[3px] bg-warning w-full" style={animatedStyle} />;
}
```

- [ ] **Step 3: Verify file created and dependency installed**

Run: `ls apps/mobile/src/components/ui/OfflineBar.tsx && grep netinfo apps/mobile/package.json`
Expected: file exists, netinfo in dependencies

---

### Task 7: Component Barrel Exports + Commit

**Files:**
- Create: `apps/mobile/src/components/ui/index.ts`

**Depends on:** Tasks 1–6

- [ ] **Step 1: Create barrel export**

```ts
// apps/mobile/src/components/ui/index.ts
export { Button } from "./Button";
export { Input } from "./Input";
export { Card } from "./Card";
export { StatusPill } from "./StatusPill";
export { SkeletonLoader } from "./SkeletonLoader";
export { OfflineBar } from "./OfflineBar";
```

- [ ] **Step 2: Typecheck the mobile app**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors (NativeWind className props may show warnings — that's OK for now)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/
git add apps/mobile/package.json apps/mobile/pnpm-lock.yaml
git commit -m "feat: add base UI components (Button, Input, Card, StatusPill, SkeletonLoader, OfflineBar)"
```

---

### Task 8: Auth Context Provider

**Files:**
- Create: `apps/mobile/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Create auth context with Firebase Auth integration**

This context provides:
- `user`: current Firebase Auth user (or null)
- `isLoading`: true while checking initial auth state
- `login(email, password)`: sign in with Firebase Auth
- `register(email, password, businessName)`: create Firebase Auth user + Firestore photographer document
- `logout()`: sign out
- `resetPassword(email)`: send Firebase password reset email

On registration, a photographer document is created in Firestore at `photographers/{uid}` with the shape from `packages/shared/src/types/photographer.ts`.

```tsx
// apps/mobile/src/contexts/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import auth, { type FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    businessName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  async function login(email: string, password: string) {
    await auth().signInWithEmailAndPassword(email, password);
  }

  async function register(
    email: string,
    password: string,
    businessName: string,
  ) {
    const { user: newUser } =
      await auth().createUserWithEmailAndPassword(email, password);

    await firestore()
      .collection("photographers")
      .doc(newUser.uid)
      .set({
        businessName,
        email,
        phone: null,
        bookingSlug: generateSlug(businessName),
        branding: { logoUrl: null, accentColor: "#2563EB" },
        availability: { windows: [], blockedDates: [] },
        mlsConfig: null,
        stripe: { accountId: null, isConnected: false },
        notifications: {
          pushEnabled: true,
          pushBookingNew: true,
          pushPaymentReceived: true,
          pushProofingComplete: true,
          pushOverdue: true,
          emailDigest: false,
          emailDigestHour: 9,
        },
        onboardingComplete: false,
        fcmToken: null,
        dismissedPrompts: {},
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
  }

  async function logout() {
    await auth().signOut();
  }

  async function resetPassword(email: string) {
    await auth().sendPasswordResetEmail(email);
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

- [ ] **Step 2: Verify file created**

Run: `ls apps/mobile/src/contexts/AuthContext.tsx`
Expected: file exists

---

### Task 9: Login Screen

**Files:**
- Modify: `apps/mobile/src/app/(auth)/login.tsx`

**Depends on:** Tasks 1–2 (Button, Input), Task 8 (AuthContext)

- [ ] **Step 1: Rewrite login screen with real form**

Replace the placeholder login screen with a working form that uses the Button and Input components.

```tsx
// apps/mobile/src/app/(auth)/login.tsx
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useState } from "react";
import { Link } from "expo-router";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError("Enter your email address first");
      return;
    }
    setError("");
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to send reset email";
      setError(message);
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
          ShotReady
        </Text>
        <Text className="text-body text-text-secondary text-center mt-sm mb-xl">
          Sign in to continue
        </Text>

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />

        <View className="mt-md">
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
          />
        </View>

        {error !== "" && (
          <Text className="text-small text-error mt-sm">{error}</Text>
        )}

        {resetSent && (
          <Text className="text-small text-success mt-sm">
            Password reset email sent. Check your inbox.
          </Text>
        )}

        <View className="mt-lg">
          <Button title="Sign In" onPress={handleLogin} loading={loading} />
        </View>

        <View className="mt-sm">
          <Button
            title="Forgot Password?"
            variant="ghost"
            onPress={handleResetPassword}
          />
        </View>

        <View className="mt-xl flex-row justify-center">
          <Text className="text-body text-text-secondary">
            {"Don't have an account? "}
          </Text>
          <Link href="/(auth)/register">
            <Text className="text-body text-accent">Sign Up</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2: Verify file written**

Run: `head -5 apps/mobile/src/app/\(auth\)/login.tsx`
Expected: imports visible, file starts with `import`

---

### Task 10: Register Screen

**Files:**
- Modify: `apps/mobile/src/app/(auth)/register.tsx`

**Depends on:** Tasks 1–2 (Button, Input), Task 8 (AuthContext)

- [ ] **Step 1: Rewrite register screen with real form**

Replace the placeholder register screen. Collects business name, email, and password. On submit, calls `register()` from auth context which creates both Firebase Auth user and Firestore photographer document.

```tsx
// apps/mobile/src/app/(auth)/register.tsx
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
```

- [ ] **Step 2: Verify file written**

Run: `head -5 apps/mobile/src/app/\(auth\)/register.tsx`
Expected: imports visible, file starts with `import`

---

### Task 11: Auth-Gated Root Layout + OfflineBar

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`

**Depends on:** Task 6 (OfflineBar), Task 8 (AuthContext)

- [ ] **Step 1: Update root layout**

Wrap the app with `AuthProvider`. Add an `AuthGate` component that uses `useSegments` and `useRouter` to redirect:
- Unauthenticated users → `/(auth)/login`
- Authenticated users in auth group → `/(tabs)`

Show a loading spinner while Firebase Auth initializes. Include the `OfflineBar` at the top.

```tsx
// apps/mobile/src/app/_layout.tsx
import "../../global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OfflineBar } from "@/components/ui";
import { darkColors } from "@/theme/colors";

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={darkColors.accent} size="large" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <View className="flex-1 bg-background">
        <StatusBar style="light" />
        <OfflineBar />
        <AuthGate />
      </View>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Verify file written**

Run: `head -10 apps/mobile/src/app/_layout.tsx`
Expected: imports include AuthProvider, OfflineBar

---

### Task 12: Typecheck + Final Commit

**Depends on:** All previous tasks

- [ ] **Step 1: Run typecheck across the monorepo**

Run: `cd <repo-root> && pnpm typecheck`

If `pnpm typecheck` is not configured, run: `cd apps/mobile && npx tsc --noEmit`

Expected: clean (no errors). NativeWind `className` prop warnings on custom components are acceptable — these are not type errors at runtime.

If there are real type errors, fix them before committing.

- [ ] **Step 2: Stage and commit**

```bash
git add apps/mobile/src/contexts/ apps/mobile/src/components/ apps/mobile/src/app/_layout.tsx apps/mobile/src/app/\(auth\)/login.tsx apps/mobile/src/app/\(auth\)/register.tsx apps/mobile/package.json
git commit -m "feat: add auth context and base UI components

- AuthProvider with Firebase Auth (login, register, logout, password reset)
- Registration creates Firestore photographer document
- Auth-gated routing via Expo Router useSegments
- Base components: Button, Input, Card, StatusPill, SkeletonLoader, OfflineBar"
```

- [ ] **Step 3: Verify commit**

Run: `git log --oneline -1`
Expected: commit message visible
