"use client";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  Folder,
  GitFork,
  HardDrive,
  LayoutDashboard,
  Link2,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  Kbd,
  Logo,
  Menu,
  Select,
  Separator,
  Skeleton,
  Switch,
  Tabs,
  Tag,
  TextArea,
  TextField,
  ThemeSelect,
  Toast,
  Tooltip,
} from "../../../components/ui";
import {
  BacklinkItem,
  CanvasCard,
  NoteRow,
  PropertyRow,
  SaveStatus,
  SyncStatus,
  TaskRow,
  WikiLink,
  type SaveState,
  type SyncState,
} from "../../../components/mindmora";
const sections = [
  "Overview",
  "Foundations",
  "Controls",
  "Feedback",
  "Overlays",
  "Knowledge patterns",
  "Guidelines",
];
function Section({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="ds-section" aria-labelledby={`${id}-title`}>
      <div className="ds-section-head">
        <span className="ds-number">{number}</span>
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p className="mm-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
function Specimen({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mm-stack">
        <div className="ds-specimen-head">
          <h3>{title}</h3>
        </div>
        <div className="ds-specimen">{children}</div>
        <p className="ds-caption">{note}</p>
      </div>
    </Card>
  );
}
export function Showcase() {
  const [enabled, setEnabled] = useState(true);
  const [task, setTask] = useState(false);
  const [selectedNote, setSelectedNote] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="ds-layout">
        <aside className="ds-sidebar">
          <a href="#overview" className="ds-brand">
            <Logo />
          </a>
          <div className="ds-sidebar-label">
            DESIGN SYSTEM <Badge>v1.0</Badge>
          </div>
          <nav aria-label="Design system sections">
            {sections.map((section, index) => (
              <a
                key={section}
                href={`#${section.toLowerCase().replaceAll(" ", "-")}`}
              >
                <span className="ds-nav-number">0{index + 1}</span>
                {section}
              </a>
            ))}
          </nav>
          <div className="ds-sidebar-bottom">
            <div className="mm-row">
              <Icon icon={HardDrive} />
              <span>Local by design.</span>
            </div>
            <p>
              Your knowledge.
              <br />
              Your control.
            </p>
          </div>
        </aside>
        <main id="main" className="ds-main" tabIndex={-1}>
          <header className="ds-topbar">
            <span className="ds-eyebrow">MINDMORA / INTERFACE FOUNDATIONS</span>
            <ThemeSelect />
          </header>
          <section
            id="overview"
            className="ds-intro"
            aria-labelledby="overview-title"
          >
            <div className="mm-row">
              <Badge tone="accent">Living reference</Badge>
              <span className="mm-muted">Version 1.0 · October 2026</span>
            </div>
            <h1 id="overview-title">
              A clear space
              <br />
              for connected thinking.
            </h1>
            <p className="ds-lede">
              One shared language for MindMora. Quiet surfaces, deliberate
              interactions, and knowledge that stays yours.
            </p>
            <div className="ds-intro-foot">
              <div className="mm-row">
                <Logo iconOnly />
                <span>
                  Junction M<br />
                  <span className="mm-muted">
                    Connected knowledge. Independent files.
                  </span>
                </span>
              </div>
              <a href="#controls">
                Explore the components <Icon icon={ArrowUpRight} />
              </a>
            </div>
          </section>
          <Section
            id="foundations"
            number="02"
            title="Foundations"
            description="Meaning before color. Every surface and interaction uses a named role."
          >
            <div className="ds-swatches">
              {[
                ["accent", "Accent", "Primary action"],
                ["canvas", "Canvas", "Workspace ground"],
                ["surface", "Surface", "Content container"],
                ["text", "Ink", "Primary text"],
                ["border", "Border", "Quiet separation"],
              ].map(([token, title, note]) => (
                <div key={token} className="ds-swatch">
                  <div className="ds-swatch-color" data-swatch={token} />
                  <strong>{title}</strong>
                  <code>--{token}</code>
                  <span className="mm-muted">{note}</span>
                </div>
              ))}
            </div>
            <div className="ds-grid">
              <Specimen
                title="Type with a purpose"
                note="System sans · No font download · 68ch reading width"
              >
                <div className="ds-type-display">Ideas become knowledge.</div>
                <div className="ds-type-heading">A place to think clearly</div>
                <p>
                  Keep the interface quiet so the work can speak. Reading text
                  stays comfortable; labels stay precise.
                </p>
                <code>[[Connected ideas]] · notes/local-first.md</code>
              </Specimen>
              <Specimen
                title="Rhythm & shape"
                note="4px base · 4 / 8 / 12px radii · Elevation only when needed"
              >
                <div className="ds-spacing">
                  {[1, 2, 3, 4, 6, 8, 12, 16].map((value) => (
                    <div key={value}>
                      <span data-space={value} />
                      <code>{value * 4}</code>
                    </div>
                  ))}
                </div>
                <div className="ds-shapes">
                  <div data-radius="sm">4</div>
                  <div data-radius="md">8</div>
                  <div data-radius="lg">12</div>
                  <div data-radius="raised">Lift</div>
                </div>
              </Specimen>
            </div>
          </Section>
          <Section
            id="controls"
            number="03"
            title="Controls"
            description="Familiar behavior. Consistent focus. One primary action per context."
          >
            <div className="ds-grid">
              <Specimen
                title="Actions"
                note="Button / IconButton · Primary, secondary, ghost, danger"
              >
                <div className="mm-row">
                  <Button
                    onClick={() =>
                      setMessage("Primary action preview. No note was created.")
                    }
                  >
                    <Icon icon={Plus} />
                    New note
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setMessage("Secondary action preview.")}
                  >
                    Open file
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setMessage("Ghost action preview.")}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="mm-row">
                  <Button
                    variant="danger"
                    onClick={() =>
                      setMessage(
                        "Destructive style preview. Nothing was deleted.",
                      )
                    }
                  >
                    Delete note
                  </Button>
                  <Button disabled>Unavailable</Button>
                  <Button loading>Saving note</Button>
                </div>
                <div className="mm-row">
                  <Tooltip content="Search your knowledge">
                    <IconButton
                      label="Search your knowledge"
                      icon={Search}
                      variant="secondary"
                      onClick={() => setMessage("Search button preview.")}
                    />
                  </Tooltip>
                  <Kbd>⌘ K</Kbd>
                  <span className="mm-muted">
                    Hover or tab to reveal the tooltip
                  </span>
                </div>
              </Specimen>
              <Specimen
                title="Inputs & validation"
                note="Persistent labels · Hints and errors connected by aria-describedby"
              >
                <TextField
                  label="Note title"
                  defaultValue="Local-first thinking"
                  hint="A clear title makes a note easier to find."
                />
                <TextField
                  label="Folder name"
                  defaultValue="Research/Ideas"
                  error="Use a name without a slash."
                />
                <TextField
                  label="Unavailable field"
                  disabled
                  placeholder="Connect a source first"
                />
              </Specimen>
              <Specimen
                title="Choice & preference"
                note="Native controls for native behavior. Switches apply immediately."
              >
                <Select label="Default view" defaultValue="notes">
                  <option value="notes">Notes</option>
                  <option value="canvas">Canvas</option>
                  <option value="graph">Graph</option>
                </Select>
                <Checkbox defaultChecked>
                  Include backlinks in previews
                </Checkbox>
                <Checkbox disabled>Unavailable option</Checkbox>
                <Switch
                  label="Show note properties"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </Specimen>
              <Specimen
                title="Long-form entry"
                note="TextArea · Resizable · Inherits local theme"
              >
                <TextArea
                  label="Note description"
                  defaultValue="A collection of ideas about software that keeps working when the network doesn’t."
                  hint="Demo only. Changes are not saved."
                />
              </Specimen>
            </div>
          </Section>
          <Section
            id="feedback"
            number="04"
            title="Feedback & states"
            description="Say what happened. Keep the next action clear."
          >
            <div className="ds-grid">
              <Specimen
                title="Semantic feedback"
                note="Text and icon carry meaning; color reinforces it."
              >
                <Alert title="Stored on this device" tone="success">
                  Local-save success specimen.
                </Alert>
                <Alert title="You’re offline" tone="warning">
                  Editing can continue. Drive sync will wait.
                </Alert>
                <Alert title="Your changes are not saved" tone="danger">
                  Keep this draft open and retry the local write.
                </Alert>
              </Specimen>
              <Specimen
                title="Labels & loading"
                note="Badges describe state. Tags organize content. Neither implies an action."
              >
                <div className="mm-row">
                  <Badge>Markdown</Badge>
                  <Badge tone="success">Saved</Badge>
                  <Badge tone="warning">Unsaved</Badge>
                  <Badge tone="danger">Failed</Badge>
                  <Badge tone="info">Syncing</Badge>
                </div>
                <div className="mm-row">
                  <Tag>research</Tag>
                  <Tag>local-first</Tag>
                  <Kbd>Esc</Kbd>
                </div>
                <Separator />
                <Skeleton label="Loading note preview" />
              </Specimen>
            </div>
            <EmptyState
              title="No connected notes yet"
              action={
                <Button
                  variant="secondary"
                  onClick={() =>
                    setMessage(
                      "Wiki links connect related notes. This is a component preview.",
                    )
                  }
                >
                  Learn about wiki links
                </Button>
              }
            >
              A wiki link creates a path between ideas. Connections will appear
              here.
            </EmptyState>
          </Section>
          <Section
            id="overlays"
            number="05"
            title="Navigation & overlays"
            description="Keyboard behavior comes with the component, not each feature."
          >
            <div className="ds-grid">
              <Specimen
                title="Tabs"
                note="Arrow keys move between tabs. Tab enters the selected panel."
              >
                <Tabs
                  label="Note information"
                  items={[
                    {
                      value: "properties",
                      label: "Properties",
                      content: (
                        <dl>
                          <PropertyRow name="Format">Markdown</PropertyRow>
                          <PropertyRow name="Location">
                            On this device
                          </PropertyRow>
                        </dl>
                      ),
                    },
                    {
                      value: "backlinks",
                      label: "Backlinks",
                      content: (
                        <p className="mm-muted">
                          Linked notes appear here when a feature supplies them.
                        </p>
                      ),
                    },
                    {
                      value: "history",
                      label: "History",
                      content: (
                        <p className="mm-muted">
                          Version history is a planned feature.
                        </p>
                      ),
                    },
                  ]}
                />
              </Specimen>
              <Specimen
                title="Dialog, menu & toast"
                note="Escape dismisses. Focus returns to the trigger. Toasts do not steal focus."
              >
                <div className="mm-row">
                  <Dialog
                    trigger={<Button variant="secondary">Open dialog</Button>}
                    title="Keep your knowledge portable"
                    description="A dialog specimen with a clear title and a focused action area."
                  >
                    <p className="mm-muted">
                      Your notes will remain Markdown files. This preview does
                      not export or modify any files.
                    </p>
                    <TextField
                      label="Example filename"
                      defaultValue="my-knowledge.md"
                    />
                  </Dialog>
                  <Menu
                    trigger={
                      <Button variant="ghost">
                        <Icon icon={MoreHorizontal} />
                        Note actions
                      </Button>
                    }
                    items={[
                      {
                        label: "Copy note link",
                        onSelect: () =>
                          setMessage(
                            "Copy-link action preview. Clipboard unchanged.",
                          ),
                      },
                      {
                        label: "Move to folder",
                        onSelect: () =>
                          setMessage("Move action preview. No file moved."),
                      },
                      {
                        label: "Export Markdown",
                        onSelect: () =>
                          setMessage(
                            "Export action preview. No file exported.",
                          ),
                      },
                    ]}
                  />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setMessage("This is a notification specimen.")
                    }
                  >
                    Show toast
                  </Button>
                </div>
                <details>
                  <summary>When to use a dialog</summary>
                  <p className="mm-muted">
                    Use a modal only for a focused decision that needs the
                    user’s attention. Keep simple choices inline.
                  </p>
                </details>
              </Specimen>
            </div>
          </Section>
          <Section
            id="knowledge-patterns"
            number="06"
            title="Knowledge patterns"
            description="MindMora-specific pieces, composed from the same foundations. Sample data only."
          >
            <div className="ds-grid">
              <Specimen
                title="Notes & selection"
                note="Controlled NoteRow · Selection belongs to its caller"
              >
                <div>
                  <NoteRow
                    title="Local-first thinking"
                    excerpt="Software that works for you, even offline."
                    meta="Markdown · Research"
                    selected={selectedNote === 0}
                    onSelect={() => setSelectedNote(0)}
                  />
                  <NoteRow
                    title="A garden of connected ideas"
                    excerpt="Small notes, meaningful links, room to grow."
                    meta="Markdown · Personal"
                    selected={selectedNote === 1}
                    onSelect={() => setSelectedNote(1)}
                  />
                </div>
              </Specimen>
              <Specimen
                title="Links & backlinks"
                note="Resolved links are solid; missing links use a dashed underline."
              >
                <p>
                  Good tools support{" "}
                  <WikiLink href="#knowledge-patterns">
                    local-first thinking
                  </WikiLink>{" "}
                  and leave room for{" "}
                  <WikiLink href="#knowledge-patterns" missing>
                    ideas not written yet
                  </WikiLink>
                  .
                </p>
                <BacklinkItem
                  href="#knowledge-patterns"
                  title="Principles for personal software"
                >
                  “The best workspace gives you control over your files and your
                  connections.”
                </BacklinkItem>
              </Specimen>
              <Specimen
                title="Tasks & properties"
                note="Controlled TaskRow · No persistence is implied by a demo checkbox"
              >
                <TaskRow checked={task} onCheckedChange={setTask}>
                  Read the local-first software paper
                </TaskRow>
                <TaskRow checked disabled onCheckedChange={() => undefined}>
                  Collect references for the next note
                </TaskRow>
                <dl>
                  <PropertyRow name="Status">
                    <Badge tone="accent">In progress</Badge>
                  </PropertyRow>
                  <PropertyRow name="Tags">
                    <Tag>research</Tag>
                  </PropertyRow>
                </dl>
              </Specimen>
              <Specimen
                title="A note on the canvas"
                note="CanvasCard · A presentation pattern, not a canvas engine"
              >
                <CanvasCard
                  title="Ownership is a feature"
                  footer={
                    <div className="mm-row">
                      <Tag>principles</Tag>
                      <Icon icon={Link2} size="sm" />
                      <span className="mm-muted">3 connections · sample</span>
                    </div>
                  }
                >
                  Your files should outlive the tools you use to create them.
                </CanvasCard>
              </Specimen>
              <Specimen
                title="Local write state"
                note="Only show saved after the repository confirms a local commit."
              >
                {(["unsaved", "saving", "saved", "error"] as SaveState[]).map(
                  (state) => (
                    <SaveStatus key={state} state={state} />
                  ),
                )}
              </Specimen>
              <Specimen
                title="Drive sync state"
                note="Independent of local-save status and optional account identity."
              >
                {(
                  [
                    "disconnected",
                    "offline",
                    "syncing",
                    "synced",
                    "error",
                  ] as SyncState[]
                ).map((state) => (
                  <SyncStatus key={state} state={state} />
                ))}
              </Specimen>
            </div>
          </Section>
          <Section
            id="guidelines"
            number="07"
            title="Rules that travel with the UI"
            description="Use the shared language. Extend it deliberately."
          >
            <div className="ds-guidelines">
              <div>
                <h3>Icons</h3>
                <div className="mm-row ds-icon-samples">
                  {[
                    FileText,
                    Folder,
                    BookOpen,
                    GitFork,
                    LayoutDashboard,
                    Settings2,
                  ].map((glyph, index) => (
                    <Icon key={index} icon={glyph} />
                  ))}
                </div>
                <p className="mm-muted">
                  Lucide · 20px · 1.75 stroke. 16px for metadata; 24px for
                  emphasis. Always label icon-only controls.
                </p>
              </div>
              <div>
                <h3>Motion</h3>
                <p className="mm-muted">
                  120ms feedback. 180ms overlays. No motion needed for reading
                  or saving. Reduced motion removes transitions and animations.
                </p>
              </div>
              <div>
                <h3>Accessibility</h3>
                <p className="mm-muted">
                  Visible focus. 44px targets. Persistent labels. 4.5:1 text
                  contrast. Keyboard and screen reader behavior are part of
                  every component.
                </p>
              </div>
              <div>
                <h3>Contribution contract</h3>
                <p className="mm-muted">
                  Reuse components and semantic tokens. Add a specimen and tests
                  for new variants. Never add arbitrary colors or one-off inline
                  styles.
                </p>
              </div>
            </div>
            <Alert title="A reference, not a feature redesign" tone="info">
              All examples are in-memory specimens. No notes, accounts, storage,
              or Drive integration are implemented here. Theme selection resets
              to System on reload.
            </Alert>
          </Section>
          <footer className="ds-footer">
            <Logo iconOnly />
            <span>Your knowledge. Your files. Your Drive. Your control.</span>
            <Icon icon={Check} />
            <span>MindMora UI · v1</span>
          </footer>
        </main>
      </div>
      <Toast message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}
