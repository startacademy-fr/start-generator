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
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { pdfUrl } = await req.json();
    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: "pdfUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the PDF file
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
    }
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant spécialisé dans l'extraction de contenu de programmes de formation.
À partir du document PDF fourni, tu dois extraire DEUX éléments distincts :

1. **Les objectifs pédagogiques** : les objectifs de la formation, souvent formulés comme "À l'issue de la formation, le stagiaire sera capable de…". Restitue-les sous forme de liste à puces.

2. **Le programme détaillé** : le contenu complet du programme (modules, chapitres, thèmes abordés). Restitue-le fidèlement en conservant la structure (titres, sous-titres, listes numérotées ou à puces). Ne résume pas, ne reformule pas.

Ignore les en-têtes/pieds de page, logos, mentions légales, informations administratives (durée, tarifs, prérequis sauf s'ils font partie des objectifs).`
          },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename: "programme.pdf",
                  file_data: `data:application/pdf;base64,${pdfBase64}`
                }
              },
              {
                type: "text",
                text: "Extrais les objectifs pédagogiques et le programme détaillé de ce document de formation PDF."
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_formation_content",
              description: "Extraire les objectifs pédagogiques et le programme détaillé d'un document de formation",
              parameters: {
                type: "object",
                properties: {
                  objectifs: {
                    type: "string",
                    description: "Les objectifs pédagogiques de la formation, sous forme de liste à puces (un objectif par ligne, précédé d'un tiret)"
                  },
                  programme: {
                    type: "string",
                    description: "Le programme détaillé complet de la formation, structuré avec titres et sous-sections"
                  }
                },
                required: ["objectifs", "programme"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_formation_content" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, veuillez réessayer dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA insuffisants." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI extraction failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    // Parse tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let objectifs = "";
    let programme = "";
    
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        objectifs = args.objectifs || "";
        programme = args.programme || "";
      } catch {
        // Fallback: use content as programme
        programme = aiData.choices?.[0]?.message?.content || "";
      }
    } else {
      // Fallback if no tool call
      programme = aiData.choices?.[0]?.message?.content || "";
    }

    return new Response(
      JSON.stringify({ objectifs, programme }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("extract-pdf-text error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
