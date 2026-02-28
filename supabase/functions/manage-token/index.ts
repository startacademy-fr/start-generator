import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    // Validate action doesn't require auth (used by stagiaires)
    if (action === "validate") {
      const { token: rawToken } = params;
      if (!rawToken || typeof rawToken !== "string" || rawToken.length > 500) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenHash = await hashToken(rawToken);

      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: tokenRecord, error } = await serviceClient
        .from("access_tokens")
        .select("id, inscription_id, expires_at, revoked")
        .eq("token_hash", tokenHash)
        .single();

      if (error || !tokenRecord) {
        return new Response(JSON.stringify({ valid: false, error: "Token not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (tokenRecord.revoked || new Date(tokenRecord.expires_at) < new Date()) {
        return new Response(JSON.stringify({ valid: false, error: "Token expired or revoked" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update last_used_at
      await serviceClient
        .from("access_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", tokenRecord.id);

      // Fetch inscription details
      const { data: inscription } = await serviceClient
        .from("inscriptions")
        .select(`
          id,
          stagiaire:stagiaires(prenom, nom, email),
          formation:formations(titre, lieu, date_debut, date_fin, nombre_heures)
        `)
        .eq("id", tokenRecord.inscription_id)
        .single();

      if (!inscription) {
        return new Response(JSON.stringify({ valid: false, error: "Inscription not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ valid: true, inscription }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All other actions require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const jwtToken = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(jwtToken);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check internal user role
    const { data: hasRole } = await supabase.rpc("is_internal_user", { _user_id: userId });
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate") {
      const { inscription_id, expires_at } = params;
      if (!inscription_id || !expires_at) {
        return new Response(JSON.stringify({ error: "Missing parameters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate a secure random token
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const tokenValue = btoa(String.fromCharCode(...randomBytes));

      // Hash it before storing
      const tokenHash = await hashToken(tokenValue);

      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error } = await serviceClient
        .from("access_tokens")
        .insert({
          inscription_id,
          token_hash: tokenHash,
          expires_at,
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ token: tokenValue }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
