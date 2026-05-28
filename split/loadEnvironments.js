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
      .map((dir) => dir.split('/')[1]+"/"+dir.split('/')[2])
  )].map((dir) => [dir.split('/')[0], dir.split('/')[1]])
  .filter((projectName) => projectName[0].match(filterProject)); 



for (const dir of directoriesWithFlagDef) {
  const projectName = dir[0];
  const environmentName = dir[1];

  const wsId = JSON.parse(fs.readFileSync(`./transformedData/${projectName}/transformedProjectResponse.json`)).id;

  const environment = JSON.parse(fs.readFileSync(`./transformedData/${projectName}/${environmentName}/transformedEnvironment.json`));
  try {
    // first get to see if environment exists
    const exists = await makeApiRequestWithRetry({
      method: 'get',
      url: `${SPLIT_API_URL}environments/ws/${wsId}`,
    })
    if (exists.filter((env) => env.name === environment.name).length > 0) {
      console.log(`Environment ${environment.name} already exists in Split`);
      fs.writeFileSync(`./transformedData/${projectName}/${environmentName}/transformedEnvironmentResponse.json`, JSON.stringify(exists.filter((env) => env.name === environment.name)[0], null, 2));
      continue;
    }

    
    const response = await makeApiRequestWithRetry({
      method: 'post',
      url: `${SPLIT_API_URL}environments/ws/${wsId}`,
      data: environment,
    });
    console.log(`Environment ${environment.name} created in Split`);
    fs.writeFileSync(`./transformedData/${projectName}/${environmentName}/transformedEnvironmentResponse.json`, JSON.stringify(response, null, 2));
  } catch (error) {
    console.error(`Error creating environment ${environment.name}:`, error);
  }

}
}


module.exports = loadEnvironments;
