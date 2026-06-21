import * as React from "react";
import * as SecureStore from "expo-secure-store";
import { createMobileApi } from "./api";
import type { User } from "@eventfilm/shared";

const TOKEN_KEY = "eventfilm_mobile_token";
const USER_KEY = "eventfilm_mobile_user";

type AuthContextValue = {
  api: ReturnType<typeof createMobileApi>;
  isReady: boolean;
  token: string | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

async function saveSession(token: string, user: User) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = React.useState(false);
  const [token, setToken] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const publicApi = React.useMemo(() => createMobileApi(), []);
  const api = React.useMemo(() => createMobileApi(() => token), [token]);


  React.useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const savedUser = await SecureStore.getItemAsync(USER_KEY);

        if (!isMounted) return;
        if (savedToken) {
          setToken(savedToken);
          if (savedUser) setUser(JSON.parse(savedUser) as User);

          try {
            const current = await publicApi.getCurrentUser(savedToken);
            if (!isMounted) return;
            setUser(current.user);
            await saveSession(savedToken, current.user);
          } catch {
            await clearSession();
            if (!isMounted) return;
            setToken(null);
            setUser(null);
          }
        }
      } finally {
        if (isMounted) setIsReady(true);
      }
    }

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, [publicApi]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      api,
      isReady,
      token,
      user,
      async signIn(email, password) {
        const session = await publicApi.login({ email, password });
        await saveSession(session.token, session.user);
        setToken(session.token);
        setUser(session.user);
      },
      async signUp(email, password) {
        const session = await publicApi.signup({ email, password });
        await saveSession(session.token, session.user);
        setToken(session.token);
        setUser(session.user);
      },
      async signOut() {
        await clearSession();
        setToken(null);
        setUser(null);
      },
    }),
    [api, isReady, publicApi, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = React.use(AuthContext);
  if (!value) throw new Error("Auth context is missing");
  return value;
}
