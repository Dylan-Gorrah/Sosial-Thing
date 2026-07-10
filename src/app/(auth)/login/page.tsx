import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only carry through a relative in-app path (guards against open-redirects).
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return <LoginForm next={safeNext} />;
}
