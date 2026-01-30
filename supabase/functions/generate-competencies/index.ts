import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formationTitre, programme, nombreCompetences = 6 } = await req.json();
    
    if (!formationTitre) {
      return new Response(
        JSON.stringify({ error: "Formation title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Tu es un expert en ingénierie pédagogique et formation professionnelle. 
Tu génères des compétences clés pour les questionnaires de positionnement Qualiopi.
Chaque compétence doit être :
- Formulée comme une action maîtrisable (ex: "Maîtriser les techniques de prospection téléphonique")
- Spécifique au domaine de la formation
- Évaluable sur une échelle de 1 à 4
- Professionnelle et pertinente pour le monde du travail`;

    const userPrompt = `Génère exactement ${nombreCompetences} compétences clés pour une formation intitulée "${formationTitre}".
${programme ? `\nProgramme de formation :\n${programme}` : ''}

Retourne les compétences sous forme d'un tableau JSON avec ce format exact :
[
  "Compétence 1",
  "Compétence 2",
  ...
]

Les compétences doivent être directement liées au titre et au contenu de la formation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_competencies",
              description: "Generate a list of professional competencies for a training course",
              parameters: {
                type: "object",
                properties: {
                  competencies: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of competencies relevant to the training",
                  },
                },
                required: ["competencies"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_competencies" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid response from AI");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const competencies = parsed.competencies || [];

    return new Response(
      JSON.stringify({ competencies }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating competencies:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
