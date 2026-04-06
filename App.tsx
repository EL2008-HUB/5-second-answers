import React, { useEffect } from "react";
import AppNavigation from "./src/navigation/AppNavigation";
import AppErrorBoundary from "./src/components/AppErrorBoundary";
import { initializePushNotifications } from "./src/services/pushNotifications";

export default function App() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    void initializePushNotifications().then((nextCleanup) => {
      cleanup = nextCleanup || undefined;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <AppErrorBoundary>
      <AppNavigation />
    </AppErrorBoundary>
  );
}
