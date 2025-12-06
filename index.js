import readline from "readline";
import dotenv from "dotenv";
import { GeminiClient } from "./lib/geminiClient.js";
import { DiceRoller } from "./lib/diceRoller.js";
import { PromptBuilder } from "./lib/promptBuilder.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let aiEnabled = true;
if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("your_api_key")) {
  console.warn("⚠️  GEMINI_API_KEY is not set or is invalid. AI features will be disabled.");
  console.warn("   You can still use /roll commands.");
  aiEnabled = false;
}

// Initialize components
const gemini = aiEnabled ? new GeminiClient(GEMINI_API_KEY) : null;
const dice = new DiceRoller();
const promptBuilder = new PromptBuilder();

// Session state
let sessionState = {
  messages: [],
  characterHP: 10,
  characterName: "Unnamed Adventurer",
  currentScene: "A misty forest path",
};

// Main game loop
async function gameLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n========================================");
  console.log("   Project RT: Cairn RPG AI GM Test   ");
  console.log("========================================\n");
  console.log(`📖 Scene: ${sessionState.currentScene}`);
  console.log(`❤️  HP: ${sessionState.characterHP}\n`);
  console.log('Type your action (or "quit" to exit, "/roll <expr>" to test dice):\n');

  const askQuestion = () => {
    rl.question("> ", async (userInput) => {
      if (userInput.toLowerCase() === "quit") {
        console.log("\n👋 Game ended.");
        rl.close();
        return;
      }

      // Manual dice roll command
      if (userInput.toLowerCase().startsWith("/roll ")) {
        const expression = userInput.substring(6).trim();
        try {
          const result = dice.roll(expression);
          console.log(`\n🎲 Manual Roll: ${expression}`);
          console.log(`   Rolls: [${result.rolls.join(", ")}]`);
          console.log(`   Total: ${result.total}`);
        } catch (e) {
          console.error(`❌ Invalid dice expression: ${e.message}`);
        }
        console.log("\n---\n");
        askQuestion();
        return;
      }

      // Mock AI command
      if (userInput.toLowerCase() === "/test_ai") {
        console.log("\n🤖 Simulating AI Function Call...");
        const mockResponse = {
          type: "function_call",
          functionName: "roll_dice",
          args: {
            dice_expression: "1d20",
            reason: "Simulated Test Roll",
          },
        };
        await processAiResponse(mockResponse);
        console.log("\n---\n");
        askQuestion();
        return;
      }

      // Scenario Generation Command
      if (userInput.toLowerCase() === "/scenario") {
        console.log("\n🎲 Generating Random Scenario...");
        console.log(`DEBUG: aiEnabled = ${aiEnabled}`);

        const runMockScenario = async () => {
           console.log("⚠️  Using MOCK scenario (AI disabled or failed).");
           const mockScenarioResponse = {
             type: "function_call",
             functionName: "roll_dice",
             args: {
               dice_expression: "1d20",
               reason: "Mock: Goblin Ambush (DEX Save)",
             },
           };
           // Simulate a brief delay
           await new Promise(r => setTimeout(r, 1000));
           console.log("\n📖 Warden: (Mock) 갑자기 숲에서 고블린이 튀어나와 단검을 휘두릅니다! DEX(민첩) 내성 굴림을 하세요.");
           await processAiResponse(mockScenarioResponse);
        };
        
        if (!aiEnabled) {
           await runMockScenario();
           console.log("\n---\n");
           askQuestion();
           return;
        }

        try {
          const prompt = promptBuilder.buildScenarioPrompt(sessionState);
          const response = await gemini.generateWithFunctionCalling(prompt);
          await processAiResponse(response);
        } catch (error) {
          console.error("❌ Error generating scenario:", error.message);
          console.log("🔄 Falling back to mock scenario...");
          await runMockScenario();
        }
        console.log("\n---\n");
        askQuestion();
        return;
      }

      try {
        if (!aiEnabled) {
          console.log("\n⚠️  AI is disabled. Please set GEMINI_API_KEY in .env to play.");
          console.log("   Use /roll <expression> to test dice.");
          console.log("   Use /test_ai to simulate an AI function call.");
          console.log("   Use /scenario to generate a random situation (Requires API Key).");
          console.log("\n---\n");
          askQuestion();
          return;
        }

        await handlePlayerAction(userInput);
        console.log("\n---\n");
        askQuestion(); // Continue loop
      } catch (error) {
        console.error("❌ Error:", error.message);
        askQuestion();
      }
    });
  };

  askQuestion();
}

// Handle player action
async function handlePlayerAction(playerInput) {
  console.log("\n🤔 Warden is thinking...\n");

  // Add player message to session
  sessionState.messages.push({
    role: "player",
    content: playerInput,
  });

  // Build prompt with context
  const prompt = promptBuilder.build(sessionState, playerInput);

  // Call Gemini
  const response = await gemini.generateWithFunctionCalling(prompt);

  await processAiResponse(response);
}

// Process AI response (Real or Mock)
async function processAiResponse(response) {
  console.log(`\n[DEBUG] AI Response Type: ${response.type}`);
  
  // Parse response
  if (response.type === "function_call") {
    // AI wants to roll dice
    console.log(`\n📋 Warden requests: ${response.functionName}`);

    let functionResult;

    if (response.functionName === "roll_dice") {
      const diceExpr = response.args.dice_expression;
      const reason = response.args.reason;

      const rollResult = dice.roll(diceExpr);

      console.log(`\n🎲 ${reason}`);
      console.log(`   Expression: ${diceExpr}`);
      console.log(`   Rolls: [${rollResult.rolls.join(", ")}]`);
      console.log(`   Total: ${rollResult.total}`);

      functionResult = rollResult.total;

      // Add function call and result to message history
      sessionState.messages.push({
        role: "warden",
        type: "function_call",
        function: "roll_dice",
        args: response.args,
        result: functionResult,
      });
    } else if (response.functionName === "update_hp") {
      const amount = response.args.amount;
      sessionState.characterHP += amount; // negative = damage

      console.log(
        `\n❤️  HP changed by ${amount > 0 ? "+" : ""}${amount}`
      );
      console.log(`   Current HP: ${sessionState.characterHP}`);

      functionResult = sessionState.characterHP;

      sessionState.messages.push({
        role: "warden",
        type: "function_call",
        function: "update_hp",
        args: response.args,
        result: functionResult,
      });
    }

    // Re-prompt Gemini with function result
    const followUpPrompt = promptBuilder.buildFollowUp(
      sessionState,
      response.functionName,
      functionResult
    );

    let finalResponseText;
    if (gemini) {
      finalResponseText = await gemini.generateText(followUpPrompt);
    } else {
      finalResponseText = "[MOCK] The action was successful based on the roll.";
    }

    console.log(`\n📖 Warden's description:\n${finalResponseText}`);

    // Add final response to session
    sessionState.messages.push({
      role: "warden",
      content: finalResponseText,
    });
  } else if (response.type === "text") {
    // AI responds with text only (no function call)
    console.log(`\n📖 Warden:\n${response.text}`);

    sessionState.messages.push({
      role: "warden",
      content: response.text,
    });
  }
}

// Start
gameLoop();
