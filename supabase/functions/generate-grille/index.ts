import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { data: isInternal } = await supabase.rpc("is_internal_user", { _user_id: userId });
    if (!isInternal) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { formationTitre, programme, programmePdfUrl, stagiairePrenom, stagiaireNom } = await req.json();

    if (!formationTitre) {
      return new Response(JSON.stringify({ error: "Formation title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to fetch PDF content if available
    let pdfTextContent = "";
    if (programmePdfUrl) {
      try {
        const pdfResp = await fetch(programmePdfUrl);
        if (pdfResp.ok) {
          // We can't parse PDF directly, but we mention the URL exists
          // The programme text field should contain the main content
          pdfTextContent = "(Un programme PDF détaillé est disponible pour cette formation)";
        }
      } catch (e) {
        console.error("Failed to fetch PDF:", e);
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const programmeContext = programme
      ? `\n\nContenu détaillé du programme de formation :\n${programme}`
      : "";

    const systemPrompt = `Tu es un expert en ingénierie pédagogique et évaluation Qualiopi. 
Tu génères des grilles d'observation individuelles pour les stagiaires en formation professionnelle.
Tu dois te baser STRICTEMENT sur le titre et le programme de la formation pour générer des compétences, commentaires et axes d'amélioration pertinents et spécifiques.
Ne génère JAMAIS de contenu générique. Chaque élément doit être directement lié au contenu réel de la formation.`;

    const userPrompt = `Génère une grille d'observation pour le stagiaire ${stagiairePrenom} ${stagiaireNom} pour la formation intitulée "${formationTitre}".
${programmeContext}
${pdfTextContent}

Tu dois générer :
1. Exactement 7 compétences observables directement liées au programme de cette formation spécifique
2. Un commentaire d'observation personnalisé positif pour ${stagiairePrenom} (2-3 phrases, en rapport avec le contenu de la formation)
3. Un axe d'amélioration constructif et spécifique au contenu de la formation (1-2 phrases)

IMPORTANT : Les compétences doivent refléter EXACTEMENT les thématiques du programme. Par exemple, si la formation porte sur "l'IA dans l'immobilier", les compétences doivent couvrir à la fois l'IA et l'immobilier, pas l'un ou l'autre séparément.`;

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
              name: "generate_grille",
              description: "Generate an observation grid for a trainee",
              parameters: {
                type: "object",
                properties: {
                  competences: {
                    type: "array",
                    items: { type: "string" },
                    description: "7 observable competencies specific to the training programme",
                  },
                  commentaire: {
                    type: "string",
                    description: "Personalized positive observation comment for the trainee (2-3 sentences)",
                  },
                  axe_amelioration: {
                    type: "string",
                    description: "Constructive improvement axis specific to the training content (1-2 sentences)",
                  },
                },
                required: ["competences", "commentaire", "axe_amelioration"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_grille" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.[0];

    let parsed;
    if (toolCall?.function?.arguments) {
      parsed = JSON.parse(toolCall.function.arguments);
    } else if (message?.content) {
      // Fallback: extract JSON from content
      const jsonMatch = message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    if (!parsed?.competences || !parsed?.commentaire || !parsed?.axe_amelioration) {
      console.error("Unexpected AI response structure:", JSON.stringify(data.choices?.[0]));
      throw new Error("Invalid response from AI");
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating grille:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
