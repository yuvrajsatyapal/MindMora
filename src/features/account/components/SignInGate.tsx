"use client";
import { Card, Button } from "../../../components/ui/primitives";
export function SignInGate() {
  return (
    <Card className="mm-sign-in">
      <div className="mm-stack">
        <h2>Sign in to MindMora</h2>
        <p>
          Use Google to access your notes across devices. Notes are stored on
          the server and are readable by the service.
        </p>
        <form method="post" action="/api/auth/start/">
          <Button type="submit">Continue with Google</Button>
        </form>
        <p className="mm-muted">
          Unsaved drafts exist only in the current tab.
        </p>
      </div>
    </Card>
  );
}
