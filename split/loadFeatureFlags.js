const axios = require("axios");
const fs = require("fs");
const { SPLIT_API_URL, SPLIT_API_KEY } = require("../config");
const { makeApiRequestWithRetry } = require("../utils/splitApiClient");
const path = require("path");
const { caseExactFileExists } = require("../utils/fileUtils");


async function loadFeatureFlags(filterProject) {
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

  const directoriesWithFlagDef = [
    ...new Set(
      getDirectoriesWithFlagDef("./transformedData").map((dir) =>
        dir.split('/').slice(0, 5).join('/')
      )
    ),
  ].map((dir) => [dir.split('/')[0], dir.split('/')[1], dir.split('/')[2], dir.split('/')[3], dir.split('/')[4]])
    .filter((element) => element[3] == "flags") // only flags
    .sort(sortParentFlagsFirst)
    .filter((element) => element[1].match(filterProject)); 

function sortParentFlagsFirst(dir1, dir2) {
  const projectName1 = dir1[1];
  const environmentName1 = dir1[2];
  const flagName1 = dir1[4];
  const flagDef1 = JSON.parse(
    fs.readFileSync(
      `./transformedData/${projectName1}/${environmentName1}/flags/${flagName1}/flagDef.json`
    )
  );
  const projectName2 = dir2[1];
  const environmentName2 = dir2[2];
  const flagName2 = dir2[4];
  const flagDef2 = JSON.parse(
    fs.readFileSync(
      `./transformedData/${projectName2}/${environmentName2}/flags/${flagName2}/flagDef.json`
    )
  );
  let flag1DepRules = flagDef1.rules
    .filter(
      (rule) =>
        typeof rule.condition !== "undefined" &&
        typeof rule.condition.matchers !== "undefined" &&
        rule.condition.matchers.some(
          (matcher) => typeof matcher.depends !== "undefined"
        )
    )
    .map((rule) =>
      rule.condition.matchers.filter(
        (matcher) => typeof matcher.depends !== "undefined"
      )
    ).flat();
  let flag2DepRules = flagDef2.rules
    .filter(
      (rule) =>

        typeof rule.condition !== "undefined" &&
        typeof rule.condition.matchers !== "undefined" &&
        rule.condition.matchers.some(
          (matcher) => typeof matcher.depends !== "undefined"
        )
    )
    .map((rule) =>
      rule.condition.matchers.filter(
        (matcher) => typeof matcher.depends !== "undefined"
      )
    ).flat();

  let flag2DependsOnFlag1 = flagDef2.rules
    .filter(
      (rule) =>
        typeof rule.condition !== "undefined" &&
        typeof rule.condition.matchers !== "undefined" &&
        typeof rule.condition.matchers.depends !== "undefined"
    )
    .some((rule) =>
      rule.condition.matchers.depends.filter(
        (dep) => dep.splitName === flagName1
      )
    );

  let flag1DependsOnFlag2 = flagDef2.rules
    .filter(
      (rule) =>
        typeof rule.condition !== "undefined" &&
        typeof rule.condition.matchers !== "undefined" &&
        typeof rule.condition.matchers.depends !== "undefined"
    )
    .some((rule) =>
      rule.condition.matchers.depends.filter(
        (dep) => dep.splitName === flagName2
      )
    );

  if (flag2DependsOnFlag1) {
    return -1;
  } else if (flag1DependsOnFlag2) {
    return 1;
  } else if (flag1DepRules.length > 0 && flag2DepRules.length === 0) {
    return 1;
  } else if (flag1DepRules.length === 0 && flag2DepRules.length > 0) {
    return -1;
  } else if (flag1DepRules.length === 0 && flag2DepRules.length === 0) {
    return 0;
  }
}


  for (const dir of directoriesWithFlagDef) {

    const projectName = dir[1];
    const environmentName = dir[2];
    const flagName = dir[4];



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

    const flag = JSON.parse(
      fs.readFileSync(
        `./transformedData/${projectName}/${environmentName}/flags/${flagName}/flag.json`
      )
    );
    const flagDef = JSON.parse(
    fs.readFileSync(
      `./transformedData/${projectName}/${environmentName}/flags/${flagName}/flagDef.json`
    )
  );
  let tags = [];
  if(caseExactFileExists(`./transformedData/${projectName}/${environmentName}/flags/${flagName}/tags.json`)){
  tags = JSON.parse(
    fs.readFileSync(
      `./transformedData/${projectName}/${environmentName}/flags/${flagName}/tags.json`
    )
  )    }
  
  if (
    !caseExactFileExists(
      `./transformedData/${projectName}/${flagName}Response.json`
    )
  ) {
    try {
    const flag = await makeApiRequestWithRetry({
      method: "get",
      url: `${SPLIT_API_URL}splits/ws/${wsId}/${flagName}`
    });
    fs.writeFileSync(
      `./transformedData/${projectName}/${flagName}Response.json`,
      JSON.stringify(flag, null, 2)
    );
  }
  catch (error) {
    console.log(`Flag ${flag.name} not found - creating as new flag in project ${projectName}`);
  }
}
  
    if (
      !caseExactFileExists(
        `./transformedData/${projectName}/${flagName}Response.json`
      )
    ) {
      try {
        const response = await makeApiRequestWithRetry({
          method: "post",
          url: `${SPLIT_API_URL}splits/ws/${wsId}/trafficTypes/user`,
          data: flag,
        });
        console.log(`Flag ${flag.name} created in Split`);
        fs.writeFileSync(
          `./transformedData/${projectName}/${flagName}Response.json`,
          JSON.stringify(response, null, 2)
        );
      } catch (error) {
        console.error(`Error creating flag ${flag.name}:`, error.response?.data || error);
      }
      if(tags.length > 0){
      try {
        const response = await makeApiRequestWithRetry({
          method: "post",
          url: `${SPLIT_API_URL}tags/ws/${wsId}/object/${flag.name}/objecttype/Split`,
          data: tags,
        });
        console.log(`tags added to ${flag.name}`);

      } catch (error) {
        console.error(`Error adding tags to  ${flag.name}:`, error.response?.data || error);
      }}
    }
    let flagInEnv
    try {
      const checkFlag = await makeApiRequestWithRetry({
        method: "get",
        url: `${SPLIT_API_URL}splits/ws/${wsId}/${flagName}/environments/${environment.id}`,
      });
      flagInEnv = true;
    }

    catch (error) {
      console.log(`Flag ${flag.name} not found in environment ${environment.name} - creating as new flag`);
      flagInEnv = false;
    }
  try{

      const response = await makeApiRequestWithRetry({
        method: flagInEnv ? "put" : "post",
        url: `${SPLIT_API_URL}splits/ws/${wsId}/${flagName}/environments/${environment.id}`,
        data: flagDef,
      });
      console.log(
        `Flag ${flag.name} ${flagInEnv ? 'updated' : 'created'} in environment ${environment.name}`
      );
    } catch (error) {
      console.error(
        `Error enabling flag ${flag.name} in environment ${environment.name}:`,
        error.response?.data || error
      );
    }
 
    }

  }


module.exports = loadFeatureFlags;
