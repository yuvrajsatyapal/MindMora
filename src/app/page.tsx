import Link from "next/link";
import { Logo } from "../components/ui/brand";
import { Card } from "../components/ui/primitives";
export default function Home() {
  return (
    <main className="home">
      <Card>
        <div className="mm-stack">
          <Logo />
          <h1>MindMora</h1>
          <p>
            The workspace is in development. Explore the shared UI foundations.
          </p>
          <Link href="/dev/design-system/">Open the design system →</Link>
        </div>
      </Card>
    </main>
  );
}
