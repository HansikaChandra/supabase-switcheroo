import { createServerFn } from "@tanstack/react-start";

type ChatMessage = { role: "user" | "assistant"; text: string };

const SYSTEM_PROMPT = `You are the Kampus.VC brief assistant. Kampus.VC is a marketplace where brands and agencies hire AI creators (AI filmmaking, animation, generative art, product advertising, motion graphics, fashion, 3D design).

Your job: help users write strong creative briefs. Ask good questions about objective, audience, deliverables, formats, timeline, budget, and usage rights. Give concrete, practical suggestions. Keep answers concise and friendly, using short paragraphs or bullet points. Never invent prices or platform policies you don't know.`;

export const askBriefAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ChatMessage[] }) => {
    if (!data || !Array.isArray(data.messages) || data.messages.length === 0) {
      throw new Error("messages are required");
    }
    return {
      messages: data.messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
        .slice(-20),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI provider is not configured yet." };
    }

    // Gemini requires the conversation to end with a user turn.
    const contents = data.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false as const,
        error: `The AI provider returned an error (${res.status}). Please try again in a moment.`,
        detail: detail.slice(0, 300),
      };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      json.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim() ?? "";

    if (!text) {
      return { ok: false as const, error: "The assistant returned an empty reply. Please try again." };
    }
    return { ok: true as const, reply: text };
  });
