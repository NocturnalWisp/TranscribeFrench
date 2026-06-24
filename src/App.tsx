import { lazy, Suspense } from "react";
import { Flex, Spinner } from "@chakra-ui/react";
import { useAuth } from "./hooks/useAuth";
import type { AccessMode } from "./types/auth";

const AuthGate = lazy(() =>
  import("./components/AuthGate").then((module) => ({ default: module.AuthGate }))
);
const PracticeSession = lazy(() => import("./components/PracticeSession"));

function LoadingScreen() {
  return (
    <Flex minH="100dvh" align="center" justify="center" bg="gray.50">
      <Spinner size="lg" color="teal.500" />
    </Flex>
  );
}

function App() {
  const { user, authReady, accessMode, setAccessMode, clearAccess, isTrial, hasAccess } =
    useAuth();

  const handleSelectAccessMode = (mode: AccessMode) => {
    setAccessMode(mode);
  };

  if (!authReady) {
    return <LoadingScreen />;
  }

  if (!hasAccess || !accessMode) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AuthGate onSelectAccessMode={handleSelectAccessMode} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <PracticeSession
        user={user}
        accessMode={accessMode}
        isTrial={isTrial}
        onLeave={clearAccess}
      />
    </Suspense>
  );
}

export default App;
