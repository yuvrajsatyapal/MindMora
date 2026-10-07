import {render,screen,fireEvent,waitFor,act} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {expect,it,vi} from "vitest";
import {KnowledgeSearch} from "./KnowledgeSearch";
import type {KnowledgeApi} from "../api";
it("searches the server corpus and uses UUID callback with escaped snippets",async()=>{
 const id="33333333-3333-4333-8333-333333333333",select=vi.fn();
 const api={search:vi.fn(async()=>({items:[{id,title:"Beyond loaded notes",snippet:"<script>inert</script>"}],nextCursor:null})),tags:async()=>({items:[],nextCursor:null})} as unknown as KnowledgeApi;
 const {container}=render(<QueryClientProvider client={new QueryClient()}><KnowledgeSearch scope={{ownerId:"owner",generation:1,assertActive(){},async verify(){}}} api={api} onSelect={select}/></QueryClientProvider>);
 await act(async()=>{fireEvent.change(screen.getByRole("textbox",{name:"Search all notes"}),{target:{value:"Beyond"}});});
 await waitFor(()=>expect(screen.getByRole("button",{name:"Beyond loaded notes"})).toBeInTheDocument());fireEvent.click(screen.getByRole("button",{name:"Beyond loaded notes"}));expect(select).toHaveBeenCalledWith(id);expect(container.querySelector("script")).toBeNull();
});
