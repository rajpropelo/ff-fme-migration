const axios = require('axios');
const fs = require('fs');
const { SPLIT_API_URL, TARGET_HARNESS_ORG_ID, TARGET_HARNESS_ACCOUNT_ID, SPLIT_API_KEY } = require('../config');
const {makeApiRequestWithRetry} = require('../utils/splitApiClient');
const path = require('path');

async function loadProjects(filterProject) {
  function getDirectoriesWithFlagDef(dir) {
    const directories = [];

    function searchDirectory(currentPath) {
      const filesAndDirs = fs.readdirSync(currentPath);

      for (const fileOrDir of filesAndDirs) {
        const fullPath = path.join(currentPath, fileOrDir);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          searchDirectory(fullPath);
        } else if (fileOrDir === "flagDef.json" || fileOrDir === "segmentDef_0.json") {
          directories.push(currentPath);
          break;
        }
      }
    }

    searchDirectory(dir);
    return directories;
  }

  const directoriesWithFlagDef = [...new Set(
    getDirectoriesWithFlagDef('./transformedData')
      .map((dir) => dir.split('/')[1])
  )]
  .filter((projectName) => projectName.match(filterProject)); 

for (const dir of directoriesWithFlagDef) {
  const project = JSON.parse(fs.readFileSync(`./transformedData/${dir}/transformedProject.json`));
  try {
    // first get to see if project exists
    const exists = await makeApiRequestWithRetry({
      method: 'get',
      url: `${SPLIT_API_URL}workspaces?name=${project.name}`,
    })
    if (exists.totalCount > 0) {
      console.log(`Project ${project.name} already exists in Split`);
      fs.writeFileSync(`./transformedData/${dir}/transformedProjectResponse.json`, JSON.stringify(exists.objects[0], null, 2));
      continue;
    }
 if(TARGET_HARNESS_ORG_ID && TARGET_HARNESS_ACCOUNT_ID) {
  const response = await axios.post('https://app.harness.io/ng/api/projects?accountIdentifier=' + TARGET_HARNESS_ACCOUNT_ID + '&orgIdentifier=' + TARGET_HARNESS_ORG_ID, {
    project: {
      orgIdentifier: TARGET_HARNESS_ORG_ID,
      identifier: project.name,
      name: project.name,
      color: "string",
      modules: [
        "FME"
      ],
      description: project.name,
      tags: {}
    }
  }, {
    headers: {
      'x-api-key': SPLIT_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  console.log(`Project ${project.name} created in Harness FME`);
  const exists = await makeApiRequestWithRetry({
    method: 'get',
    url: `${SPLIT_API_URL}workspaces?name=${project.name}`,
  })
  console.log('Got Harness Project Data in FME');
  fs.writeFileSync(`./transformedData/${dir}/transformedProjectResponse.json`, JSON.stringify(exists.objects[0], null, 2));
 } else {
    const response = await makeApiRequestWithRetry({
      method: 'post',
      url: `${SPLIT_API_URL}workspaces`,
      data: project,
    });
    console.log(`Project ${project.name} created in Split`);

    fs.writeFileSync(`./transformedData/${dir}/transformedProjectResponse.json`, JSON.stringify(response, null, 2));
  }
  } catch (error) {
    console.error(`Error creating project ${project.name}:`, error);
  }
}
}


module.exports = loadProjects;
