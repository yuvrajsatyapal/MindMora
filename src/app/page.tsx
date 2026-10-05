import { ArrowUpRight, FileText, Feather } from "lucide-react";
import { Logo } from "../components/ui/brand";
import { ThemeSelect } from "../components/ui/theme";

export default function Home() {
  return (
    <div className="mm-home">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="mm-home-nav">
        <a href="/" aria-label="MindMora home"><Logo /></a>
        <div className="mm-home-nav-actions">
          <a href="/dev/design-system/">Design system</a>
          <ThemeSelect />
        </div>
      </header>
      <main id="main">
        <section className="mm-home-hero" aria-labelledby="home-title">
          <div className="mm-home-intro">
            <h1 id="home-title">A place for <br />your thinking.</h1>
            <p>Keep the things you learn. Write them in your own words. Return when the next idea arrives.</p>
            <a className="mm-button mm-home-cta" href="/workspace/">
              Open your workspace <ArrowUpRight className="mm-icon" strokeWidth={1.75} aria-hidden="true" />
            </a>
          </div>
          <figure className="mm-home-note">
            <figcaption><FileText className="mm-icon" data-size="sm" strokeWidth={1.75} aria-hidden="true" /> Example note</figcaption>
            <div className="mm-home-note-body">
              <span className="mm-muted">Learning journal</span>
              <h2>Make room<br />for the question.</h2>
              <p>The best notes begin with something you don’t understand yet.</p>
              <p>Write down the question. Follow one thread. Leave yourself a place to pick it up tomorrow.</p>
              <blockquote>What changed the way I thought about this?</blockquote>
              <div className="mm-home-note-rule" aria-hidden="true" />
              <p className="mm-home-note-next"><Feather className="mm-icon" data-size="sm" strokeWidth={1.75} aria-hidden="true" /> A thought worth keeping.</p>
            </div>
            <aside className="mm-home-margin">Your words.<br />Room to think.</aside>
          </figure>
        </section>
        <section className="mm-home-workflow" aria-labelledby="workflow-title">
          <h2 id="workflow-title">From a passing thought<br />to something you can return to.</h2>
          <div>
            <p>Give it a title. Write in Markdown. Save it to your workspace and open it on another device.</p>
            <p className="mm-muted">You decide when to save. If a write fails or another version exists, your draft stays in the tab for you to review.</p>
          </div>
        </section>
      </main>
      <footer className="mm-home-footer">
        <span>MindMora · A personal knowledge workspace</span>
        <p>Notes are stored on the server and readable by the service. Unsaved drafts stay in this tab.</p>
      </footer>
    </div>
  );
}
