const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const envFile = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envFile.split("\n").forEach((line) => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) {
    envVars[key.trim()] = rest.join("=").trim();
  }
});

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseAnonKey = envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

console.log("Supabase URL:", supabaseUrl);
console.log("Anon Key (first 30 chars):", supabaseAnonKey?.slice(0, 30) + "...");

async function test() {
  try {
    console.log("\n[1] Testing basic connectivity...");
    const start = Date.now();

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data, error, count } = await supabase
      .from("jobs")
      .select("id, title, status", { count: "exact" })
      .limit(5)
      .order("created_at", { ascending: false });

    const elapsed = Date.now() - start;

    if (error) {
      console.error("ERROR:", error.message);
      console.error("Code:", error.code);
      console.error("Hint:", error.hint);
    } else {
      console.log(`SUCCESS! Query completed in ${elapsed}ms`);
      console.log(`Total jobs count: ${count}`);
      console.log(`Sample data:`);
      if (data && data.length > 0) {
        data.forEach((job) => {
          console.log(`  - [${job.status}] ${job.id}: ${job.title}`);
        });
      } else {
        console.log("  (No data returned)");
      }
    }

    console.log("\n[2] Testing profiles table...");
    const { data: profiles, error: profileError, count: profileCount } = await supabase
      .from("profiles")
      .select("id, full_name, roles", { count: "exact" })
      .limit(3);

    if (profileError) {
      console.error("ERROR:", profileError.message);
    } else {
      console.log(`SUCCESS! Profiles count: ${profileCount}`);
      if (profiles && profiles.length > 0) {
        profiles.forEach((p) => {
          console.log(`  - ${p.full_name} (${p.roles?.join(", ")})`);
        });
      }
    }

    console.log("\n[3] Testing auth endpoint...");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: "test@example.com",
        password: "test123",
      });
      if (authError) {
        console.log("Auth endpoint reachable (expected credential error):", authError.message);
      } else {
        console.log("Auth endpoint reachable (unexpected success)");
      }
    } catch (authErr) {
      console.error("Auth endpoint ERROR:", authErr.message);
    }

    console.log("\n✅ All tests completed!");
  } catch (err) {
    console.error("FATAL ERROR:", err.message);
    console.error("Stack:", err.stack?.slice(0, 500));
  }
}

test();
