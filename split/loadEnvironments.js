const fs = require('fs');
const { SPLIT_API_URL } = require('../config');
const {makeApiRequestWithRetry} = require('../utils/splitApiClient');
const path = require('path');


async function loadEnvironments(filterProject) {
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
      .map((dir) => dir.split(/[/\\]/)[1]+"/"+dir.split(/[/\\]/)[2])
  )].map((dir) => [dir.split('/')[0], dir.split('/')[1]])
  .filter((projectName) => projectName[0].match(filterProject)); 



for (const dir of directoriesWithFlagDef) {
  const projectName = dir[0];
  const environmentName = dir[1];

  const projectResponsePath = `./transformedData/${projectName}/transformedProjectResponse.json`;
  if (!fs.existsSync(projectResponsePath)) {
    throw new Error(
      `Missing ${projectResponsePath}. Project ${projectName} was not created, so environments cannot be loaded.`
    );
  }

  const wsId = JSON.parse(fs.readFileSync(projectResponsePath)).id;

  const environment = JSON.parse(fs.readFileSync(`./transformedData/${projectName}/${environmentName}/transformedEnvironment.json`));
  let existingNames = 'none';
  try {
    const exists = await makeApiRequestWithRetry({
      method: 'get',
      url: `${SPLIT_API_URL}environments/ws/${wsId}`,
    });
    const existingEnvironments = Array.isArray(exists) ? exists : [];
    existingNames = existingEnvironments.map((env) => env.name).join(', ') || 'none';
    const match = existingEnvironments.find((env) => env.name === environment.name);
    if (match) {
      console.log(`Environment ${environment.name} already exists in FME`);
      fs.writeFileSync(`./transformedData/${projectName}/${environmentName}/transformedEnvironmentResponse.json`, JSON.stringify(match, null, 2));
      continue;
    }

    console.log(`[load:environments] "${environment.name}" was not found. Existing FME environments: ${existingNames}`);
    const response = await makeApiRequestWithRetry({
      method: 'post',
      url: `${SPLIT_API_URL}environments/ws/${wsId}`,
      data: environment,
    });
    console.log(`Environment ${environment.name} created in FME`);
    fs.writeFileSync(`./transformedData/${projectName}/${environmentName}/transformedEnvironmentResponse.json`, JSON.stringify(response, null, 2));
  } catch (error) {
    const status = error.response?.status;
    const apiMessage = error.response?.data?.message;
    if (status === 403) {
      throw new Error(
        `Cannot create FME environment "${environment.name}" in workspace ${wsId}. The API key can view environments but cannot create them. Existing environments: ${existingNames}. Create "${environment.name}" in FME, or use a key with environment-admin permission.`
      );
    }
    throw new Error(`Error creating environment ${environment.name}: ${apiMessage || error.message}`);
  }

}
}


module.exports = loadEnvironments;
