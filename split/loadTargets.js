const axios = require("axios");
const fs = require("fs");
const { SPLIT_API_URL } = require("../config");
const { makeApiRequestWithRetry } = require("../utils/splitApiClient");
const path = require("path");

async function loadTargets(filterProject) {
  function getDirectoriesWithFlagDef(dir) {
    const directories = [];

    function searchDirectory(currentPath) {
      const filesAndDirs = fs.readdirSync(currentPath);

      for (const fileOrDir of filesAndDirs) {
        const fullPath = path.join(currentPath, fileOrDir);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          searchDirectory(fullPath);
        } else if (fileOrDir === "transformedTargets.json") {
          directories.push(currentPath);
          break;
        }
      }
    }

    searchDirectory(dir);
    return directories;
  }

  const directoriesWithFlagDef = [
    ...new Set(
      getDirectoriesWithFlagDef("./transformedData").map((dir) =>
        dir.split('/').slice(0, 3).join('/')
      )
    ),
  ].map((dir) => [dir.split('/')[0], dir.split('/')[1], dir.split('/')[2]])
    .filter((element) => element[1].match(filterProject)); 

  for (const dir of directoriesWithFlagDef) {
    const projectName = dir[1];
    const environmentName = dir[2];


    const wsId = JSON.parse(
      fs.readFileSync(
        `./transformedData/${projectName}/transformedProjectResponse.json`
      )
    ).id;

    const environment = JSON.parse(
      fs.readFileSync(
        `./transformedData/${projectName}/${environmentName}/transformedEnvironmentResponse.json`
      )
    );

    const transformedTargetData = JSON.parse(
      fs.readFileSync(
        `./transformedData/${projectName}/${environmentName}/transformedTargets.json`
      )
    );
    let userTT;
    try {
    const response = await makeApiRequestWithRetry({
        method: "get",
        url: `${SPLIT_API_URL}trafficTypes/ws/${wsId}`,
      });

      userTT = response.filter((tt) => tt.name === "user")[0];
  } catch (error) {
    console.error(`Error getting traffic type:`, error);    
  }



      try {
        const response = await makeApiRequestWithRetry({
          method: "post",
          url: `${SPLIT_API_URL}trafficTypes/${userTT.id}/environments/${environment.id}/identities`,
          data: transformedTargetData,
        });
        console.log(`Target Data created in Split for environment: ${environmentName}`);
      } catch (error) {
        console.error(`Error creating target data:`, error);
      }
    }

  }

module.exports = loadTargets;
