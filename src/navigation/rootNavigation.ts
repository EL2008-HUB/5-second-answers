import { CommonActions, createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

let pendingNavigation: (() => void) | null = null;

export const navigate = (name: string, params?: Record<string, unknown>) => {
  const action = () =>
    navigationRef.dispatch(
      CommonActions.navigate({
        name,
        params,
      })
    );

  if (navigationRef.isReady()) {
    action();
    return;
  }

  pendingNavigation = action;
};

export const flushPendingNavigation = () => {
  if (!navigationRef.isReady() || !pendingNavigation) {
    return;
  }

  const action = pendingNavigation;
  pendingNavigation = null;
  action();
};
