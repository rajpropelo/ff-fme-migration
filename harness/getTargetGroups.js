const axios = require("axios");
const fs = require("fs");
const {
  HARNESS_API_KEY,
  HARNESS_API_URLS,
  HARNESS_ACCOUNT_ID,
} = require("../config");

async function fetchTargetGroups(filterProject) {
  const projects = JSON.parse(fs.readFileSync("./data/projects.json")).data
    .content;

  const projectIds = projects.map((project) => {
    return {
      project: project.project.identifier,
      org: project.project.orgIdentifier,
    };
  }).filter((element) => element.project.match(filterProject));

  for (const project of projectIds) {
    try {
      const environments = JSON.parse(
        fs.readFileSync(
          `./data/${project.org}/${project.project}/environments.json`
        )
      ).data.content;
      for (const environment of environments) {
        const envId = environment.environment.identifier

        let page = 0;
        let hasMore = true;
        let allTargetGroups = [];

        while (hasMore) {
          const response = await axios.get(
            `${HARNESS_API_URLS.TARGET_GROUPS}?pageNumber=${page}&pageSize=100&accountIdentifier=${HARNESS_ACCOUNT_ID}&orgIdentifier=${project.org}&projectIdentifier=${project.project}&environmentIdentifier=${envId}`,
            {
              headers: {
          "x-api-key": `${HARNESS_API_KEY}`,
          "Content-Type": "application/json",
              },
            }
          );
          allTargetGroups = allTargetGroups.concat(response.data.segments);

          hasMore = response.data.pageCount > page + 1;
          page++;
        }

        const dir = `./data/${project.org}/${project.project}/${envId}`;
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // Save the feature flags to a JSON file
        fs.writeFileSync(
          `./data/${project.org}/${project.project}/${envId}/targetGroups.json`,
          JSON.stringify(allTargetGroups, null, 2)
        );
        console.log(
          `Target Groups  ${project.org}/${project.project}/${envId} saved to targetGroups.json`
        );
       
      }
    } catch (error) {
      console.error("Error fetching Target Groups:", error);
    }
  }
}
module.exports = fetchTargetGroups;
