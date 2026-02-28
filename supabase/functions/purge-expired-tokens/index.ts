import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete tokens that are expired OR revoked for more than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();

    // Delete expired tokens (expired_at < 30 days ago)
    const { data: expiredResult, error: err1 } = await supabase
      .from("access_tokens")
      .delete()
      .lt("expires_at", cutoff)
      .select("id");

    // Delete revoked tokens (created more than 30 days ago and revoked)
    const { data: revokedResult, error: err2 } = await supabase
      .from("access_tokens")
      .delete()
      .eq("revoked", true)
      .lt("created_at", cutoff)
      .select("id");

    const expiredCount = expiredResult?.length ?? 0;
    const revokedCount = revokedResult?.length ?? 0;

    console.log(
      `Purge RGPD: ${expiredCount} tokens expirés + ${revokedCount} tokens révoqués supprimés`
    );

    return new Response(
      JSON.stringify({
        success: true,
        purged: { expired: expiredCount, revoked: revokedCount },
        cutoff_date: cutoff,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erreur purge:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
