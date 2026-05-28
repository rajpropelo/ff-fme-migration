const axios = require('axios');
const fs = require('fs');
const { HARNESS_API_KEY, HARNESS_API_URLS, HARNESS_ACCOUNT_ID } = require('../config');

async function fetchFeatureFlags(filterProject) {
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
          `${HARNESS_API_URLS.FEATURE_FLAGS}?accountIdentifier=${HARNESS_ACCOUNT_ID}&orgIdentifier=${project.org}&projectIdentifier=${project.project}&environmentIdentifier=${envId}&pageNumber=${page}&pageSize=200`,
          {
            headers: {
        "x-api-key": `${HARNESS_API_KEY}`,
        "Content-Type": "application/json",
            },
          }
        );
        allTargetGroups = allTargetGroups.concat(response.data.features);

        hasMore = response.data.pageCount > page + 1;
        page++;
      }

      const dir = `./data/${project.org}/${project.project}/${envId}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Save the feature flags to a JSON file
      fs.writeFileSync(
        `./data/${project.org}/${project.project}/${envId}/flags.json`,
        JSON.stringify(allTargetGroups, null, 2)
      );
      console.log(
        `Flags  ${project.org}/${project.project}/${envId} saved to flags.json`
      );
     
    }
  } catch (error) {
    console.error("Error fetching Flags:", error);
  }
}
}

module.exports = fetchFeatureFlags;
