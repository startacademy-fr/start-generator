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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { data: isInternal } = await supabase.rpc("is_internal_user", { _user_id: userId });
    if (!isInternal) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { formationTitre, programme, stagiaire } = await req.json();

    if (!formationTitre) {
      return new Response(JSON.stringify({ error: "Formation title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const programmeContext = programme ? `\n\nProgramme de la formation :\n${programme}` : "";

    const stagiaireContext = `
Profil du stagiaire :
- Prénom : ${stagiaire.prenom || 'Non renseigné'}
- Nom : ${stagiaire.nom || 'Non renseigné'}
- Entreprise : ${stagiaire.entreprise || 'Non renseignée'}
- Fonction : ${stagiaire.fonction || 'Non renseignée'}
- Ancienneté : ${stagiaire.anciennete || 'Non renseignée'}
- Diplôme le plus élevé : ${stagiaire.diplomes || 'Non renseigné'}
- Tâches quotidiennes : ${stagiaire.taches_quotidiennes || 'Non renseignées'}`;

    const systemPrompt = `Tu es un expert en ingénierie pédagogique et analyse des besoins de formation professionnelle (Qualiopi).
Tu rédiges des analyses de besoin PERSONNALISÉES et RÉALISTES pour chaque stagiaire.
Le ton doit être professionnel, humain et naturel — comme si le stagiaire avait réellement rempli un formulaire.
Adapte le vocabulaire au niveau et à la fonction du stagiaire. Évite le langage corporate creux.`;

    const userPrompt = `Génère une analyse du besoin de formation complète et personnalisée pour ce stagiaire et cette formation.

Formation : "${formationTitre}"
${programmeContext}
${stagiaireContext}

Tu dois produire :
1. "contexte_professionnel" : 2-3 phrases décrivant le contexte professionnel du stagiaire et pourquoi cette formation est pertinente pour lui/elle
2. "objectifs_stagiaire" : 3-4 objectifs personnels du stagiaire formulés à la première personne ("Je souhaite..."), spécifiques à sa fonction et au contenu de la formation
3. "attentes" : 3-4 attentes concrètes vis-à-vis de la formation, formulées naturellement
4. "competences_visees" : 3-4 compétences que le stagiaire souhaite développer, en lien direct avec le programme
5. "freins_identifies" : 1-2 freins ou difficultés potentielles que le stagiaire pourrait rencontrer (réaliste, pas négatif)
6. "motivation" : 1-2 phrases sur la motivation du stagiaire pour cette formation

IMPORTANT : Sois spécifique au profil du stagiaire et au contenu exact de la formation. Ne génère JAMAIS de contenu générique.`;

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
              name: "generate_analyse_besoin",
              description: "Generate a personalized training needs analysis",
              parameters: {
                type: "object",
                properties: {
                  contexte_professionnel: { type: "string", description: "Professional context of the trainee (2-3 sentences)" },
                  objectifs_stagiaire: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-4 personal objectives from the trainee's perspective",
                  },
                  attentes: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-4 concrete expectations for the training",
                  },
                  competences_visees: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-4 skills the trainee wants to develop",
                  },
                  freins_identifies: {
                    type: "array",
                    items: { type: "string" },
                    description: "1-2 potential challenges or difficulties",
                  },
                  motivation: { type: "string", description: "1-2 sentences about the trainee's motivation" },
                },
                required: ["contexte_professionnel", "objectifs_stagiaire", "attentes", "competences_visees", "freins_identifies", "motivation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_analyse_besoin" } },
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
    console.error("Error generating analyse besoin:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
