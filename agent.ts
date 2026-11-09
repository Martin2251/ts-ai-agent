import { config } from "dotenv";
import { generateText, tool, stepCountIs } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

// 1. Load environment variables
config();

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error("❌ ERROR: GOOGLE_GENERATIVE_AI_API_KEY is missing from .env!");
  process.exit(1);
}

// 2. Initialize provider
const google = createGoogleGenerativeAI({ apiKey });

async function runAgent(userPrompt: string) {
  console.log(`🤖 User Prompt: "${userPrompt}"\n`);

  try {
    const result = await generateText({
      model: google("gemini-3.8-flash"),
      system: "You are a helpful assistant with access to real-time global weather data.",
      prompt: userPrompt,
      stopWhen: stepCountIs(5),

      tools: {
        getWeather: tool({
          description: "Get current weather for any city globally",
          inputSchema: z.object({
            city: z.string().describe("The name of the city, e.g. London, Tokyo, Paris"),
          }),
          execute: async ({ city }) => {
            console.log(`⚙️  [Executing Tool: Fetching real-time weather for ${city}...]`);

            try {
              // Geocode city to coordinates
              const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
              const geoRes = await fetch(geoUrl);
              const geoData = await geoRes.json();

              if (!geoData.results || geoData.results.length === 0) {
                return { error: `Could not find coordinates for ${city}.` };
              }

              const { latitude, longitude, name, country } = geoData.results[0];

              // Fetch live weather
              const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
              const weatherRes = await fetch(weatherUrl);
              const weatherData = await weatherRes.json();

              const current = weatherData.current_weather;

              return {
                location: `${name}, ${country}`,
                temperature: `${current.temperature}°C`,
                windspeed: `${current.windspeed} km/h`,
                weatherCode: current.weathercode,
              };
            } catch (err) {
              return { error: `Failed to fetch weather for ${city}.` };
            }
          },
        }),
      },
    });

    console.log("\n💡 Agent Final Answer:");
    console.log(result.text || "(No text generated)");

  } catch (error) {
    console.error("\n❌ Execution Error:", error);
  }
}

// 3. Top-level execution call
await runAgent("What is the weather like in London right now, and should I carry an umbrella?");