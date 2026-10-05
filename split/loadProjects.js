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
      .map((dir) => dir.split(/[/\\]/)[1])
  )]
  .filter((projectName) => projectName.match(filterProject));

  async function findExistingWorkspace(projectIdentifier, projectName) {
    const lookups = [];
    if (TARGET_HARNESS_ORG_ID) {
      lookups.push(
        `workspaces?organizationIdentifier=${encodeURIComponent(TARGET_HARNESS_ORG_ID)}&projectIdentifier=${encodeURIComponent(projectIdentifier)}`
      );
    }
    if (projectName && projectName !== projectIdentifier) {
      lookups.push(`workspaces?name=${encodeURIComponent(projectName)}`);
    }
    lookups.push(`workspaces?name=${encodeURIComponent(projectIdentifier)}`);

    for (const lookup of lookups) {
      console.log(`[load:projects] Looking up existing workspace: ${lookup}`);
      const exists = await makeApiRequestWithRetry({
        method: 'get',
        url: `${SPLIT_API_URL}${lookup}`,
      });
      console.log(`[load:projects] Workspace lookup returned ${exists.totalCount || 0} match(es)`);
      if (exists.totalCount > 0 && exists.objects?.[0]) {
        return exists.objects[0];
      }
    }
    return null;
  }

  async function findExistingHarnessProject(projectIdentifier) {
    try {
      const response = await axios.get(
        `https://app.harness.io/ng/api/projects/${encodeURIComponent(projectIdentifier)}?accountIdentifier=${encodeURIComponent(TARGET_HARNESS_ACCOUNT_ID)}&orgIdentifier=${encodeURIComponent(TARGET_HARNESS_ORG_ID)}`,
        {
          headers: {
            'x-api-key': SPLIT_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data?.data?.project || null;
    } catch (error) {
      const status = error.response?.status;
      const code = error.response?.data?.code;
      if (status === 404 || code === 'RESOURCE_NOT_FOUND_EXCEPTION' || code === 'ENTITY_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

for (const dir of directoriesWithFlagDef) {
  const project = JSON.parse(fs.readFileSync(`./transformedData/${dir}/transformedProject.json`));
  try {
    const projectIdentifier = project.identifier || project.name;
    const projectName = project.harnessName || project.name;
    const existingWorkspace = await findExistingWorkspace(projectIdentifier, projectName);
    if (existingWorkspace) {
      console.log(`Project ${project.name} already exists in FME workspace ${existingWorkspace.id}. Skipping create.`);
      fs.writeFileSync(`./transformedData/${dir}/transformedProjectResponse.json`, JSON.stringify(existingWorkspace, null, 2));
      continue;
    }
 if(TARGET_HARNESS_ORG_ID && TARGET_HARNESS_ACCOUNT_ID) {
  const existingHarnessProject = await findExistingHarnessProject(projectIdentifier);
  if (existingHarnessProject) {
    throw new Error(
      `Harness project ${project.name} already exists in org ${TARGET_HARNESS_ORG_ID}, but no FME workspace was returned. Enable FME on that project instead of creating it again.`
    );
  }
  console.log(`[load:projects] Creating Harness project ${project.name} in org ${TARGET_HARNESS_ORG_ID}`);
  const response = await axios.post('https://app.harness.io/ng/api/projects?accountIdentifier=' + TARGET_HARNESS_ACCOUNT_ID + '&orgIdentifier=' + TARGET_HARNESS_ORG_ID, {
    project: {
      orgIdentifier: TARGET_HARNESS_ORG_ID,
      identifier: projectIdentifier,
      name: projectName,
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
  const createdWorkspace = await findExistingWorkspace(projectIdentifier, projectName);
  if (!createdWorkspace) {
    throw new Error(`Project ${project.name} was created, but its FME workspace could not be found.`);
  }
  console.log(`Got Harness project ${project.name} in FME workspace ${createdWorkspace.id}`);
  fs.writeFileSync(`./transformedData/${dir}/transformedProjectResponse.json`, JSON.stringify(createdWorkspace, null, 2));
 } else {
    const response = await makeApiRequestWithRetry({
      method: 'post',
      url: `${SPLIT_API_URL}workspaces`,
      data: {
        name: projectName,
        requiresTitleAndComments: project.requiresTitleAndComments,
      },
    });
    console.log(`Project ${project.name} created in Split`);

    fs.writeFileSync(`./transformedData/${dir}/transformedProjectResponse.json`, JSON.stringify(response, null, 2));
  }
  } catch (error) {
    if (!error.response) {
      throw error;
    }
    const apiError = error.response?.data;
    const message = apiError?.message || error.message;
    const code = apiError?.code ? ` (${apiError.code})` : '';
    throw new Error(`Error creating project ${project.name}${code}: ${message}`);
  }
}
}


module.exports = loadProjects;
