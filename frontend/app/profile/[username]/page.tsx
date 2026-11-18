import { ProfileView } from '@/components/profile/ProfileView';

interface UserProfilePageProps {
  params: Promise<{ username: string }>;
}

function safeDecodeUsername(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { username } = await params;
  const decodedUsername = safeDecodeUsername(username || '');
  return <ProfileView targetUsername={decodedUsername} />;
}
