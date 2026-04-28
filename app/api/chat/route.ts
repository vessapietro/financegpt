import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: message
        }
      ]
    });

    return Response.json({
      reply: response.choices[0].message.content
    });

  } catch (error) {
    return Response.json({
      reply: "Erro OpenAI"
    });
  }
}
