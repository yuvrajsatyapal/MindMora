import { expect, it } from "vitest";
import { wikiTargetsSchema, searchInputSchema, backlinksInputSchema } from "./validation";
it("rejects forged ownership, excess terms and ambiguous cursors", () => {
  expect(wikiTargetsSchema.safeParse({kind:"resolve",targets:["Private"],userId:"forged"}).success).toBe(false);
  expect(wikiTargetsSchema.safeParse({kind:"resolve",targets:Array(51).fill("X")}).success).toBe(false);
  expect(wikiTargetsSchema.safeParse({kind:"resolve",targets:["a\nb"]}).success).toBe(false);
  expect(searchInputSchema.safeParse({query:"a".repeat(257)}).success).toBe(false);
  expect(searchInputSchema.safeParse({query:"",cursor:{queryKey:"x",id:"invalid",rank:Infinity}}).success).toBe(false);
  expect(backlinksInputSchema.safeParse({limit:"101"}).success).toBe(false);
});
it("accepts bounded read inputs with explicit defaults", () => {
  expect(searchInputSchema.parse({query:"private terms"})).toEqual({query:"private terms",limit:20});
  expect(backlinksInputSchema.parse({limit:"50"})).toEqual({limit:50});
});
