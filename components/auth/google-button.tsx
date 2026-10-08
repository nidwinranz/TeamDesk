import { googleSignInAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';

export function GoogleButton({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <form action={googleSignInAction}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ''} />
      <Button type="submit" variant="outline" className="w-full">
        Continue with Google
      </Button>
    </form>
  );
}
