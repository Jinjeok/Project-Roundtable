import { DailyTokenLimitError } from "./dailyTokenBudget.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const TOOLS = [
  {
    type: "function",
    name: "roll_dice",
    description:
      "Roll dice when a judgment or damage calculation is needed. Do not generate results yourself.",
    parameters: {
      type: "object",
      properties: {
        dice_expression: {
          type: "string",
          description: 'Dice expression (e.g., "1d20", "1d8", "2d6+1")',
        },
        reason: {
          type: "string",
          description: 'Reason for the roll (e.g., "STR Save", "Sword Damage")',
        },
      },
      required: ["dice_expression", "reason"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "update_hp",
    description:
      "Update character HP (negative value = damage, positive = healing)",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "integer",
          description: "Amount to change (e.g., -3 for 3 damage)",
        },
        reason: {
          type: "string",
          description: "Reason for HP change",
        },
      },
      required: ["amount", "reason"],
      additionalProperties: false,
    },
    strict: true,
  },
];

export class OpenAIClient {
  constructor(apiKey, model = "gpt-5.4-mini", options = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.fallbackModel = options.fallbackModel;
    this.tokenBudget = options.tokenBudget;
    this.maxOutputTokens = options.maxOutputTokens || 2048;
    this.onDebug = options.onDebug || (() => {});

    if (!Number.isInteger(this.maxOutputTokens) || this.maxOutputTokens <= 0) {
      throw new Error("OpenAI max output tokens must be a positive integer.");
    }
  }

  async request(input, tools) {
    try {
      return await this.requestModel(input, tools, this.model, this.tokenBudget);
    } catch (error) {
      if (!(error instanceof DailyTokenLimitError) || !this.fallbackModel) {
        throw error;
      }

      console.warn(
        `[INFO] ${this.model} daily token limit reached. Switching to ${this.fallbackModel}.`
      );
      this.onDebug("model_fallback", {
        from: this.model,
        to: this.fallbackModel,
        reason: "daily_token_limit",
      });
      return this.requestModel(input, tools, this.fallbackModel);
    }
  }

  async requestModel(input, tools, model, tokenBudget) {
    const body = {
      model,
      input,
      max_output_tokens: this.maxOutputTokens,
    };

    if (tools) {
      body.tools = tools;
    }

    // UTF-8 bytes are a conservative upper bound for text token usage.
    const reservedTokens =
      Buffer.byteLength(JSON.stringify(body), "utf8") + this.maxOutputTokens;

    this.onDebug("request_prepared", {
      model,
      toolsEnabled: Boolean(tools),
      reservedTokens: tokenBudget ? reservedTokens : null,
    });

    const reservation = tokenBudget
      ? await tokenBudget.reserve(reservedTokens)
      : null;
    let settled = false;

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      const totalTokens = data.usage?.total_tokens;

      if (tokenBudget) {
        const tokensToRecord = Number.isInteger(totalTokens)
          ? totalTokens
          : reservedTokens;
        await tokenBudget.settle(reservation, tokensToRecord);
        settled = true;
      }

      this.onDebug("response_usage", {
        model,
        totalTokens: Number.isInteger(totalTokens) ? totalTokens : null,
      });

      if (!response.ok) {
        const message = data.error?.message || `HTTP ${response.status}`;
        throw new Error(`OpenAI API request failed: ${message}`);
      }

      if (tokenBudget && !Number.isInteger(totalTokens)) {
        throw new Error("OpenAI API response did not include token usage.");
      }

      return data;
    } catch (error) {
      if (tokenBudget && !settled) {
        await tokenBudget.settle(reservation, reservedTokens);
      }
      throw error;
    }
  }

  async generateWithFunctionCalling(prompt) {
    try {
      const response = await this.request(prompt, TOOLS);
      const functionCall = response.output?.find(
        (item) => item.type === "function_call"
      );

      if (functionCall) {
        console.log(`[DEBUG] OpenAI Raw Function Call: ${functionCall.name}`);
        return {
          type: "function_call",
          functionName: functionCall.name,
          args: JSON.parse(functionCall.arguments),
        };
      }

      return {
        type: "text",
        text: this.getText(response),
      };
    } catch (error) {
      console.error("OpenAI API Error:", error.message);
      throw error;
    }
  }

  async generateText(prompt) {
    try {
      const response = await this.request(prompt);
      return this.getText(response);
    } catch (error) {
      console.error("OpenAI API Error:", error.message);
      throw error;
    }
  }

  getText(response) {
    if (response.output_text) {
      return response.output_text;
    }

    return (response.output || [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content || [])
      .filter((content) => content.type === "output_text")
      .map((content) => content.text)
      .join("");
  }
}
