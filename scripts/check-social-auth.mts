import {
  checkSocialAuthRedirect,
  socialAuthProviders,
  type SocialAuthProvider,
} from "../src/features/auth/social-auth-health";

const appUrl = process.env.KINO_AUTH_APP_URL ?? "https://www.usekino.dev";
const clerkFrontendApiUrl = process.env.KINO_CLERK_FAPI_URL ?? "https://clerk.usekino.dev";

type ClerkSignInResponse = {
  response?: {
    first_factor_verification?: {
      external_verification_redirect_url?: string | null;
    } | null;
  } | null;
};

async function createSocialSignIn(provider: SocialAuthProvider) {
  const response = await fetch(new URL("/v1/client/sign_ins", clerkFrontendApiUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: appUrl,
    },
    body: new URLSearchParams({
      strategy: `oauth_${provider}`,
      redirect_url: new URL("/login/sso-callback", appUrl).toString(),
      action_complete_redirect_url: new URL("/dashboard", appUrl).toString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Clerk respondió ${response.status} para ${provider}.`);
  }

  const body = (await response.json()) as ClerkSignInResponse;
  const redirect = body.response?.first_factor_verification?.external_verification_redirect_url;
  if (!redirect) {
    throw new Error(`Clerk no devolvió el redirect de ${provider}.`);
  }

  return redirect;
}

const failures: string[] = [];

for (const provider of socialAuthProviders) {
  try {
    const redirect = await createSocialSignIn(provider);
    const result = checkSocialAuthRedirect(provider, redirect, clerkFrontendApiUrl);
    if (!result.ok) {
      failures.push(result.reason);
      continue;
    }
    console.log(`${provider}: configured`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : `Falló la comprobación de ${provider}.`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
}
