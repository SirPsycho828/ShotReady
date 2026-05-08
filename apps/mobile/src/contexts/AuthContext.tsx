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

    try {
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
    } catch (firestoreError) {
      await newUser.delete();
      throw firestoreError;
    }
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
