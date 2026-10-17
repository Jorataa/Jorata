import { useState } from "react";
import { AuthPanel, PasswordRecovery, ProfileEditor } from "./AuthPanel";
import { configured, db } from "./client";
import { useAccount } from "./useAccount";
import { useSocial } from "./useSocial";
import { Workspace } from "./SocialApp";
import type { Profile } from "./types";
export function SocialApp() {
  const account = useAccount();
  const [recovery, setRecovery] = useState(
    new URLSearchParams(location.search).has("recover"),
  );
  if (!configured)
    return (
      <main className="social-auth">
        <section className="social-auth-card">
          <h1>JORATA</h1>
          <p>
            Account services need configuration before this installation can
            accept members.
          </p>
          <p>
            See the deployment guide for the Supabase environment variables.
          </p>
        </section>
      </main>
    );
  if (account.loading)
    return (
      <main className="social-loading" role="status">
        Opening JORATA…
      </main>
    );
  if (!account.session) return <AuthPanel />;
  if (recovery) return <PasswordRecovery done={() => setRecovery(false)} />;
  if (account.error)
    return (
      <main className="social-auth">
        <section className="social-auth-card">
          <p role="alert">{account.error}</p>
          <button onClick={() => location.reload()}>Retry</button>
          <button onClick={() => void db().auth.signOut()}>Sign out</button>
        </section>
      </main>
    );
  if (!account.profile)
    return <ProfileEditor profile={null} onSaved={account.refresh} />;
  return (
    <AccountWorkspace
      key={account.session.user.id}
      profile={account.profile}
      refreshProfile={account.refresh}
    />
  );
}

function AccountWorkspace({
  profile,
  refreshProfile,
}: {
  profile: Profile;
  refreshProfile: () => Promise<void>;
}) {
  const social = useSocial(profile.id);
  return (
    <Workspace
      profile={profile}
      refreshProfile={refreshProfile}
      platform={social}
    />
  );
}
