import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const chatSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(12).default([]),
});

/** Server-only proxy. Provider credentials never enter the browser bundle. */
export const sendCustomerCareMessage = createServerFn({ method: "POST" })
  .validator((value: unknown) => chatSchema.parse(value))
  .handler(async ({ data }) => {
    const provider = (process.env.CUSTOMER_AI_PROVIDER ?? "ollama").toLowerCase();
    const baseUrl = (process.env.CUSTOMER_AI_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(/\/$/, "");
    const apiKey = process.env.CUSTOMER_AI_API_KEY ?? "ollama";
    const model = process.env.CUSTOMER_AI_MODEL ?? "qwen2.5:7b";
    if (!process.env.DATABASE_URL) throw new Error("Customer care is temporarily unavailable: database is not configured.");
    if (provider !== "ollama" && !process.env.CUSTOMER_AI_API_KEY) {
      throw new Error("Customer care is not configured. Set the server-side CUSTOMER_AI_API_KEY.");
    }
    const transcript = data.history.slice(-10).map((item) => ({ role: item.role, content: item.content }));
    transcript.push({ role: "user", content: data.message });
    const system = [
      "You are the VMVIRA website customer-care assistant.",
      "Answer politely and concisely about VMVIRA website navigation, product information, access requests, and how to contact the team.",
      "Never claim an access request is approved; tell users the team must review it.",
      "Do not provide personalized investment advice, stock tips, guaranteed returns, or instructions to place trades.",
      "If a question needs account-specific or human support, ask the visitor to use the website contact form.",
      "Do not request passwords, OTPs, API keys, broker credentials, payment card details, or other secrets.",
      "If you do not know an answer, say so rather than inventing VMVIRA policies or features.",
    ].join(" ");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, ...transcript], temperature: 0.3, stream: false }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Customer care provider error (${response.status}). ${detail}`);
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const answer = payload.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("The assistant returned an empty response. Please try again.");

    const { getSql } = await import("./db");
    const sql = await getSql();
    await sql.query(
      "insert into customer_chat_messages (id,conversation_id,sender_role,message,model) values ($1,$2,'user',$3,$4),($5,$2,'assistant',$6,$4)",
      [randomUUID(), data.conversationId, data.message, model, randomUUID(), answer],
    );
    return { answer, model, provider };
  });
