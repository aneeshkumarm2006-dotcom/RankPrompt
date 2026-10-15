import { GoogleLogin } from '@react-oauth/google';
import { useTheme } from '../../app/theme/useTheme';
import { GOOGLE_CLIENT_ID } from '../../lib/config';
import { OrDivider } from './AuthLayout';

interface GoogleButtonProps {
  text: 'continue_with' | 'signup_with' | 'signin_with';
  onCredential: (credential: string) => void;
  onError: () => void;
}

function GoogleButtonInner({ text, onCredential, onError }: GoogleButtonProps) {
  const { theme } = useTheme();
  return (
    <>
      <OrDivider />
      <div className="w-full flex justify-center">
        <GoogleLogin
          onSuccess={(r) => (r.credential ? onCredential(r.credential) : onError())}
          onError={onError}
          theme={theme === 'dark' ? 'filled_black' : 'outline'}
          size="large"
          width="100%"
          text={text}
        />
      </div>
    </>
  );
}

/**
 * Google sign-in (F-03), with the "or" divider above it. Renders nothing when
 * `VITE_GOOGLE_CLIENT_ID` is unset: the `GoogleOAuthProvider` is only mounted when it is set.
 */
export function GoogleButton(props: GoogleButtonProps) {
  if (!GOOGLE_CLIENT_ID) return null;
  return <GoogleButtonInner {...props} />;
}
