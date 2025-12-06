import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiClient {
  constructor(apiKey) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: "gemini-pro" });
  }

  async generate(prompt) {
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Gemini API error:", error.message);
      throw error;
    }
  }

  async generateWithFunctionCalling(prompt) {
    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      // Parse function calls from response
      // Format: [FUNCTION_CALL: functionName {"arg1": value1, ...}]
      const functionCallMatch = text.match(
        /\[FUNCTION_CALL: (\w+) ({.*?})\]/
      );

      if (functionCallMatch) {
        return {
          type: "function_call",
          functionName: functionCallMatch[1],
          args: JSON.parse(functionCallMatch[2]),
        };
      }

      return {
        type: "narrative",
        content: text,
      };
    } catch (error) {
      console.error("Gemini API error:", error.message);
      throw error;
    }
  }
}
