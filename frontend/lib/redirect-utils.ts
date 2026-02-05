// frontend/lib/redirect-utils.ts

/**
 * Determines the destination path after a successful login or signup.
 * 
 * Previously, this handled "Magic Redirects" to specific agents based on usage history.
 * In the new architecture, the Dashboard serves as the central hub for all users to 
 * ensure they see the agent marketplace, their wallet status, and news.
 *
 * @param token - The user's access token (unused in current logic but kept for future extensions)
 * @returns The absolute path string to redirect the user to.
 */
export async function getSmartRedirectPath(token: string): Promise<string> {
  // Always redirect to the main Dashboard
  return "/dashboard";
}