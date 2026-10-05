import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PreviewBoundary } from "./PreviewBoundary";
function Broken():never{throw new Error("Preview chunk unavailable");}
it("isolates preview failures from the editable draft",()=>{
 const consoleError=vi.spyOn(console,"error").mockImplementation(()=>{});
 render(<div><textarea aria-label="Draft" defaultValue="Private unsaved text"/><PreviewBoundary><Broken/></PreviewBoundary></div>);
 expect(screen.getByText(/Preview unavailable/)).toBeInTheDocument();
 expect(screen.getByLabelText("Draft")).toHaveValue("Private unsaved text");
 consoleError.mockRestore();
});
