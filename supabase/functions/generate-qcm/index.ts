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
    // Validate JWT authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    const { data: isInternal } = await supabase.rpc("is_internal_user", { _user_id: userId });
    if (!isInternal) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { formationTitre, programme, nombreQuestions = 13 } = await req.json();

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

    const systemPrompt = `Tu es un expert en ingénierie pédagogique et évaluation de formation professionnelle.
Tu génères des QCM d'évaluation des acquis pour des formations professionnelles.
Les questions doivent :
- Être directement liées au contenu de la formation
- Avoir entre 2 et 4 options de réponse (certaines questions peuvent être Vrai/Faux avec seulement 2 options)
- Avoir une seule bonne réponse identifiée par sa lettre (A, B, C ou D)
- Être formulées de manière claire et professionnelle
- Couvrir différents aspects de la formation
- Être de difficulté modérée (un stagiaire ayant suivi la formation doit pouvoir répondre à >90%)`;

    const userPrompt = `Génère exactement ${nombreQuestions} questions de QCM pour évaluer les acquis d'une formation intitulée "${formationTitre}".
${programme ? `\nProgramme de la formation :\n${programme}` : ''}

Pour chaque question, fournis :
- La question
- Les options de réponse (entre 2 et 4, identifiées par les lettres A, B, C, D)
- La lettre de la bonne réponse

Les questions doivent couvrir l'ensemble du programme et être variées (questions ouvertes, vrai/faux, choix multiples).`;

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
              name: "generate_qcm",
              description: "Generate a QCM (multiple choice questionnaire) for a training course evaluation",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: "The question text" },
                        options: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              letter: { type: "string", description: "Option letter (A, B, C or D)" },
                              text: { type: "string", description: "Option text" },
                            },
                            required: ["letter", "text"],
                            additionalProperties: false,
                          },
                          description: "2 to 4 answer options",
                        },
                        correct_answer: { type: "string", description: "The letter of the correct answer (A, B, C or D)" },
                      },
                      required: ["question", "options", "correct_answer"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_qcm" } },
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
    const questions = parsed.questions || [];

    return new Response(
      JSON.stringify({ questions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating QCM:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
