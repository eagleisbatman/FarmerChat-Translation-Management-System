import type { UserRole } from "@/types/next-auth";

export type TranslationState = "draft" | "review" | "approved";

export function canCreateTranslation(userRole: UserRole): boolean {
  return userRole === "admin" || userRole === "translator" || userRole === "reviewer";
}

export function canEditTranslation(
  userRole: UserRole,
  state: TranslationState,
  createdBy: string,
  userId: string
): boolean {
  if (userRole === "admin") return true;
  if (state === "draft" && createdBy === userId) return true;
  if (state === "review" && userRole === "reviewer") return true;
  return false;
}

export function canReviewTranslation(userRole: UserRole): boolean {
  return userRole === "admin" || userRole === "reviewer";
}

export function canApproveTranslation(
  userRole: UserRole,
  state: TranslationState
): boolean {
  if (userRole === "admin") return true;
  if (userRole === "reviewer" && state === "review") return true;
  return false;
}

export function getNextState(
  currentState: TranslationState,
  action: "submit" | "approve" | "reject"
): TranslationState {
  if (action === "submit" && currentState === "draft") {
    return "review";
  }
  if (action === "approve" && currentState === "review") {
    return "approved";
  }
  if (action === "reject" && currentState === "review") {
    return "draft";
  }
  return currentState;
}

