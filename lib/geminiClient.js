import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiClient {
  constructor(apiKey) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({
      model: "gemini-2.5-flash",
    });
  }

  async generateWithFunctionCalling(prompt) {
    const tools = {
      functionDeclarations: [
        {
          name: "roll_dice",
          description:
            "Roll dice when a judgment or damage calculation is needed. DO NOT generate results yourself.",
          parameters: {
            type: "OBJECT",
            properties: {
              dice_expression: {
                type: "STRING",
                description:
                  'Dice expression (e.g., "1d20", "1d8", "2d6+1")',
              },
              reason: {
                type: "STRING",
                description:
                  'Reason for the roll (e.g., "STR Save", "Sword Damage")',
              },
            },
            required: ["dice_expression", "reason"],
          },
        },
        {
          name: "update_hp",
          description:
            "Update character HP (negative value = damage, positive = healing)",
          parameters: {
            type: "OBJECT",
            properties: {
              amount: {
                type: "INTEGER",
                description: "Amount to change (e.g., -3 for 3 damage)",
              },
              reason: {
                type: "STRING",
                description: "Reason for HP change",
              },
            },
            required: ["amount", "reason"],
          },
        },
      ],
    };

    try {
      const response = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: tools,
      });

      if (!response.response.candidates || response.response.candidates.length === 0) {
        console.error("Gemini API returned no candidates. Response:", JSON.stringify(response));
        throw new Error("Gemini API returned no candidates. Possible safety block or API issue.");
      }

      const candidate = response.response.candidates[0];

      // Check for function calls
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          console.log(`[DEBUG] Gemini Raw Function Call: ${part.functionCall.name}`);
          return {
            type: "function_call",
            functionName: part.functionCall.name,
            args: part.functionCall.args,
          };
        }
      }

      // Otherwise return text
      const textContent = candidate.content.parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join("");

      return {
        type: "text",
        text: textContent,
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  async generateText(prompt) {
    try {
      const response = await this.model.generateContent(prompt);
      return response.response.text();
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
}
