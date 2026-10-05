import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin="http://127.0.0.1:4173";
const source=(page:Page)=>page.getByRole("textbox",{name:"Markdown content"});
async function signIn(page:Page,context:BrowserContext){
 await context.request.post(`${process.env.AUTH_TEST_PROVIDER_URL}/fixture/user?second=false`);
 await page.goto("/workspace/");await page.getByRole("button",{name:"Continue with Google"}).click();await page.waitForURL(`${origin}/`);await page.goto("/workspace/");
 await expect(page.getByRole("heading",{name:"Your notes"})).toBeVisible();
}
async function seed(context:BrowserContext,content="Original"){
 const response=await context.request.post("/api/notes/",{headers:{Origin:origin,"Idempotency-Key":crypto.randomUUID()},data:{title:`Editor ${crypto.randomUUID()}`,content}});
 expect(response.status()).toBe(201);return await response.json() as {id:string;revision:number};
}
test.beforeEach(async({request})=>{expect((await request.post(`${process.env.AUTH_TEST_PROVIDER_URL}/fixture/reset`)).ok()).toBe(true);});
test("autosave binds a new note without remounting source and serializes edits during the first create",async({page,context})=>{
 await signIn(page,context);
 let writes=0; let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route("**/api/notes/",async route=>{if(route.request().method()!=="POST")return route.continue();writes++;const result=await route.fetch();await gate;await route.fulfill({response:result});});
 await page.getByLabel("Title",{exact:true}).fill("Autosaved creation");await source(page).fill("First snapshot");
 await expect.poll(()=>writes).toBe(1);await source(page).fill("Newer while saving");release();
 await expect(source(page)).toHaveText("Newer while saving");await expect.poll(()=>new URL(page.url()).searchParams.get("note")).toBeTruthy();
 await expect(page.getByText("Saved to server",{exact:true})).toBeVisible({timeout:15000});
 const id=new URL(page.url()).searchParams.get("note");expect((await(await context.request.get(`/api/notes/${id}/`)).json()).content).toBe("Newer while saving");expect(writes).toBe(1);
 await page.reload();await expect(source(page)).toHaveText("Newer while saving");
});
test("typing during PATCH preserves draft and clean acknowledgement follows serialized revision",async({page,context})=>{
 await signIn(page,context);const note=await seed(context);await page.goto(`/workspace/?note=${note.id}`);await expect(source(page)).toHaveText("Original");
 let patches=0;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route(`**/api/notes/${note.id}/`,async route=>{if(route.request().method()!=="PATCH")return route.continue();patches++;const result=await route.fetch();if(patches===1)await gate;await route.fulfill({response:result});});
 await source(page).fill("Snapshot B");await expect.poll(()=>patches).toBe(1);await source(page).fill("Snapshot C");release();
 await expect(source(page)).toHaveText("Snapshot C");await expect(page.getByText("Saved to server",{exact:true})).toHaveCount(0);
 await expect(page.getByText("Saved to server",{exact:true})).toBeVisible({timeout:15000});
 const current=await(await context.request.get(`/api/notes/${note.id}/`)).json();expect(current.content).toBe("Snapshot C");expect(current.revision).toBe(3);expect(patches).toBe(2);
});
test("conflicts pause autosave and keep-draft never writes until explicit save",async({page,context})=>{
 await signIn(page,context);const note=await seed(context);await page.goto(`/workspace/?note=${note.id}`);await expect(source(page)).toHaveText("Original");
 await context.request.patch(`/api/notes/${note.id}/`,{headers:{Origin:origin},data:{content:"Remote commit",expectedRevision:1}});
 await source(page).fill("Retained local draft");await expect(page.getByRole("button",{name:"Keep draft with latest revision"})).toBeVisible();
 await page.getByRole("button",{name:"Keep draft with latest revision"}).click();await page.waitForTimeout(5500);
 expect((await(await context.request.get(`/api/notes/${note.id}/`)).json()).content).toBe("Remote commit");
 await page.getByRole("button",{name:"Save note",exact:true}).click();await expect(page.getByText("Saved to server",{exact:true})).toBeVisible();
 expect((await(await context.request.get(`/api/notes/${note.id}/`)).json()).content).toBe("Retained local draft");
});
test("rich preview renders math and Mermaid under production CSP without loading hostile resources",async({page,context})=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 const errors:string[]=[];page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
 const foreign:string[]=[];page.on("request",request=>{if(request.url().startsWith("https://attacker.invalid"))foreign.push(request.url());});
 await signIn(page,context); errors.length=0;
 const first=await context.request.get("/workspace/",{headers:{"x-nonce":"attacker"}});const second=await context.request.get("/workspace/");
 expect(first.headers()["content-security-policy"]).not.toContain("nonce-attacker");expect(first.headers()["content-security-policy"]).not.toBe(second.headers()["content-security-policy"]);expect(first.headers()["content-security-policy"]).not.toContain("unsafe-eval");expect(first.headers()["cache-control"]).toContain("no-store");
 const content='# Preview heading\n\n**Bold** and $x^2$.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n- [ ] Task\n\n![Private image](https://attacker.invalid/image.png)\n\n<script>window.phase2Xss=true</script>\n\n[bad](javascript:alert(1))\n\n```mermaid\ngraph TD\n A[Start] --> B[Finish]\n```';
 const note=await seed(context,content);await page.goto(`/workspace/?note=${note.id}`);await expect(source(page)).toContainText("Preview heading");await page.getByRole("button",{name:"Split",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Preview heading"})).toBeVisible();await expect(page.locator(".katex")).toBeVisible();await expect(page.getByRole("link",{name:"Open image source"})).toBeVisible();expect(foreign).toEqual([]);
 await page.getByRole("button",{name:"Render diagram"}).click();await expect(page.getByTitle("Rendered Mermaid diagram")).toBeVisible({timeout:20000});
 const diagram=page.getByTitle("Rendered Mermaid diagram");
 expect(await diagram.getAttribute("sandbox")).toBe("");
 const frameDocument=await diagram.getAttribute("srcdoc");
 expect(frameDocument).toContain("script-src 'none'");expect(frameDocument).not.toMatch(/<script|onload=|onclick=/i);
 const frame=page.frameLocator('iframe[title="Rendered Mermaid diagram"]');await expect(frame.locator("svg")).toBeVisible();await expect(frame.locator("text").filter({hasText:"Start"})).toBeVisible();
 expect(await page.evaluate(()=>Reflect.get(window,"phase2Xss"))).toBeUndefined();// Playwright's frame selector bootstrap is denied in the deliberately scriptless
 // opaque frame, including its frame-created bootstrap. No executable markup is emitted.
 // Only this exact sandbox denial is expected; style/script CSP violations still fail.
 expect(errors.filter(error=>!/^Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set\.$/.test(error))).toEqual([]);
 for(const width of [375,768,1440]){await page.setViewportSize({width,height:900});for(const theme of ["light","dark"]){await page.getByLabel("Theme",{exact:true}).selectOption(theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).exclude('iframe[title="Rendered Mermaid diagram"]').analyze()).violations).toEqual([]);await diagram.scrollIntoViewIfNeeded();await expect(frame.locator("text").filter({hasText:"Start"})).toBeVisible();await page.screenshot({path:`/tmp/phase2-editor-${theme}-${width}.png`,fullPage:true});}}
});
test("format transactions preserve selection, undo, focus and primary save shortcut",async({page,context})=>{
 await signIn(page,context);const note=await seed(context,"words");await page.goto(`/workspace/?note=${note.id}`);await expect(source(page)).toHaveText("words");
 await source(page).focus();await page.keyboard.press("ControlOrMeta+A");await page.getByRole("button",{name:"Bold",exact:true}).click();await expect(source(page)).toHaveText("**words**");await expect(source(page)).toBeFocused();
 await page.keyboard.press("ControlOrMeta+z");await expect(source(page)).toHaveText("words");await source(page).fill("Shortcut commit");await page.keyboard.press("ControlOrMeta+s");await expect(page.getByText("Saved to server",{exact:true})).toBeVisible();
 await source(page).focus();await page.keyboard.press("Tab");await expect(source(page)).not.toBeFocused();
});
test("source composition retains edits and saves only after the composition ends",async({page,context})=>{
 await signIn(page,context);const note=await seed(context);await page.goto(`/workspace/?note=${note.id}`);await expect(source(page)).toHaveText("Original");
 let writes=0;await page.route(`**/api/notes/${note.id}/`,async route=>{if(route.request().method()==="PATCH")writes++;await route.continue();});
 await source(page).dispatchEvent("compositionstart",{data:"文"});await source(page).fill("文章");await page.waitForTimeout(1800);
 expect(writes).toBe(0);await expect(source(page)).toHaveText("文章");
 await source(page).dispatchEvent("compositionend",{data:"文章"});await expect(page.getByText("Saved to server",{exact:true})).toBeVisible({timeout:10000});
 expect(writes).toBe(1);expect((await(await context.request.get(`/api/notes/${note.id}/`)).json()).content).toBe("文章");
});
