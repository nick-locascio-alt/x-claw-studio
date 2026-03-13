import { describe, expect, it } from "vitest";
import { addGroundingCitations } from "@/src/server/topic-grounded-news";

describe("addGroundingCitations", () => {
  it("injects inline links from grounding supports without shifting later insertions", () => {
    const text = "Alpha happened. Beta followed.";
    const cited = addGroundingCitations({
      text,
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: "https://example.com/a" } },
              { web: { uri: "https://example.com/b" } }
            ],
            groundingSupports: [
              {
                segment: { endIndex: 14 },
                groundingChunkIndices: [0]
              },
              {
                segment: { endIndex: 29 },
                groundingChunkIndices: [1]
              }
            ]
          }
        }
      ]
    });

    expect(cited).toContain("[1](https://example.com/a)");
    expect(cited).toContain("[2](https://example.com/b)");
  });
});
