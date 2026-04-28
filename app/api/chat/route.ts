import OpenAI from "openai";
export async function POST(req:Request){
 try{
 const {message}=await req.json();
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
 const r=await client.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:message}]});
 return Response.json({reply:r.choices[0].message.content});
 }catch(e){return Response.json({reply:"Erro ao conectar com OpenAI"},{status:500});}
}