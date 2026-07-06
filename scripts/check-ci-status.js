const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Node" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data)));
    });
  });
}

async function main() {
  const runsUrl = "https://api.github.com/repos/admin-biteradigital-com/web-api-midespensa/actions/runs?per_page=12";
  const runs = await get(runsUrl);
  
  const deployRun = runs.workflow_runs.find(r => r.name === "Deploy to Production" && r.run_number === 8);
  if (!deployRun) { console.log("Not found"); return; }
  
  const jobs = await get(deployRun.jobs_url);
  for (const job of jobs.jobs) {
    console.log(`Job: ${job.name} -> ${job.conclusion}`);
    for (const step of job.steps) {
      const icon = step.conclusion === "success" ? "OK" : step.conclusion === "failure" ? "FAIL" : step.conclusion;
      console.log(`  Step ${step.number}: ${step.name} -> ${icon}`);
    }
  }
}

main().catch(console.error);
