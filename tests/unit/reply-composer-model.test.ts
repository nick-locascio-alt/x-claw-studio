import { describe, expect, it } from "vitest";
import { parseGeminiJsonResponse } from "@/src/server/gemini-cli-json";
import { replyCompositionDraftSchema, replyCompositionPlanSchema } from "@/src/lib/reply-composer";

describe("parseGeminiJsonResponse", () => {
  it("parses the Gemini CLI JSON envelope response field", () => {
    const value = parseGeminiJsonResponse(
      JSON.stringify({
        response: JSON.stringify({
          stance: "agree",
          angle: "Point out the second-order effect",
          tone: "dry and concise",
          intentSummary: "Add one sharper implication",
          targetEffect: "Make the consequence feel obvious",
          searchQueries: ["reaction image consequence", "grim nod support"],
          moodKeywords: ["grim", "knowing"],
          candidateSelectionCriteria: ["matches consequence", "feels understated"],
          avoid: ["too celebratory"]
        })
      }),
      (input) => replyCompositionPlanSchema.parse(input)
    );

    expect(value.searchQueries).toEqual(["reaction image consequence", "grim nod support"]);
    expect(value.stance).toBe("agree");
  });

  it("parses fenced JSON nested inside the response field", () => {
    const value = parseGeminiJsonResponse(
      JSON.stringify({
        response:
          "```json\n" +
          JSON.stringify({
            replyText: "This is where the shortcut turns into the whole strategy.",
            selectedCandidateId: "candidate-1",
            mediaSelectionReason: "The image lands the same implication without overexplaining it.",
            whyThisReplyWorks: "It adds consequence and keeps the tone tight.",
            postingNotes: null
          }) +
          "\n```"
      }),
      (input) => replyCompositionDraftSchema.parse(input)
    );

    expect(value.selectedCandidateId).toBe("candidate-1");
  });

  it("ignores non-JSON preamble text before the envelope", () => {
    const value = parseGeminiJsonResponse(
      '[dotenv@17.3.1] injecting env (3) from .env\n' +
        JSON.stringify({
          response: JSON.stringify({
            replyText: "The moat was always the point.",
            selectedCandidateId: null,
            mediaSelectionReason: "No candidate fit closely enough.",
            whyThisReplyWorks: "It reframes the move as strategy instead of betrayal.",
            postingNotes: null
          })
        }),
      (input) => replyCompositionDraftSchema.parse(input)
    );

    expect(value.replyText).toBe("The moat was always the point.");
  });
});
