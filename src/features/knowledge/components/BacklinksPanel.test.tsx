import {render,screen,fireEvent} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {expect,it,vi} from "vitest";
import {BacklinksPanel} from "./BacklinksPanel";
import type {KnowledgeApi} from "../api";
it("shows unique-source count and escaped committed context with guarded source callback",async()=>{
 const onSelect=vi.fn(),api={backlinks:async()=>({targetRevision:1,resolution:"resolved",total:1,items:[{sourceId:"source",title:"Source",sourceRevision:2,occurrenceCount:3,context:"<script>inert</script>"}],nextCursor:null})} as unknown as KnowledgeApi;
 const {container}=render(<QueryClientProvider client={new QueryClient()}><BacklinksPanel scope={{ownerId:"owner",generation:1,assertActive(){},async verify(){}}} api={api} id="target" onSelect={onSelect}/></QueryClientProvider>);
 await screen.findByText("1 incoming notes");fireEvent.click(screen.getByRole("button",{name:"Source"}));expect(onSelect).toHaveBeenCalledWith("source");expect(screen.getByText("3 occurrences · revision 2")).toBeInTheDocument();expect(container.querySelector("script")).toBeNull();
});
