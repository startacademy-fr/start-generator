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

    const { formationTitre, programme, nombreHeures } = await req.json();

    if (!formationTitre) {
      return new Response(JSON.stringify({ error: "Formation title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nombreJours = Math.max(1, Math.ceil((nombreHeures || 7) / 7));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const programmeContext = programme
      ? `\n\nContenu détaillé du programme de formation :\n${programme}`
      : "";

    const systemPrompt = `Tu es un expert en ingénierie pédagogique Qualiopi. Tu génères des déroulés pédagogiques détaillés pour les formations professionnelles.
Le déroulé doit être STRICTEMENT basé sur le contenu réel du programme de la formation. Ne génère pas de contenu générique.`;

    const userPrompt = `Génère un déroulé pédagogique pour ${nombreJours} jour(s) de formation intitulée "${formationTitre}" (${nombreHeures}h au total).
${programmeContext}

Pour chaque jour, génère un thème principal et 7 séquences avec cette structure exacte :
1. Accueil (30 min) - premier créneau de la journée
2. Séquence principale matin (2h30) - objectif et contenu liés au programme
3. Pause déjeuner (90 min)
4. Séquence après-midi 1 (1h10) - objectif et contenu liés au programme
5. Pause (10 min)
6. Séquence après-midi 2 (1h10) - objectif et contenu liés au programme
7. Bilan de journée (20 min) - le dernier jour c'est "Évaluation des acquis et clôture de la formation"

IMPORTANT : Les objectifs et contenus de chaque séquence doivent correspondre EXACTEMENT aux thèmes du programme. Répartis les sujets du programme de manière logique et progressive sur les ${nombreJours} jour(s).`;

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
              name: "generate_deroule",
              description: "Generate a pedagogical schedule for a training course",
              parameters: {
                type: "object",
                properties: {
                  jours: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        theme: { type: "string", description: "Main theme of the day" },
                        sequences: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              duree: { type: "string" },
                              objectifs: { type: "string" },
                              contenu: { type: "string" },
                              outils: { type: "string" },
                              exercice: { type: "string" },
                              evaluation: { type: "string" },
                            },
                            required: ["duree", "objectifs", "contenu", "outils", "exercice", "evaluation"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["theme", "sequences"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["jours"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_deroule" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) throw new Error("Invalid response from AI");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating deroule:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
