const axios = require("axios");
const fs = require("fs");
const { SPLIT_API_URL } = require("../config");
const { makeApiRequestWithRetry } = require("../utils/splitApiClient");
const path = require("path");
const { caseExactFileExists } = require("../utils/fileUtils");

async function loadSegments(filterProject) {
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
        dir.split(/[/\\]/).slice(0, 5).join('/')
      )
    ),
  ].map((dir) => [dir.split('/')[0], dir.split('/')[1], dir.split('/')[2], dir.split('/')[3], dir.split('/')[4]])
    .filter((element) => element[3] == "segments") // only segments
    .filter((element) => element[1].match(filterProject)); 
    let allSegments = [];
    let allSegmentsInEnvironment = [];
  for (const dir of directoriesWithFlagDef) {
    const projectName = dir[1];
    const environmentName = dir[2];
    const segmentName = dir[4];

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

    const segment = JSON.parse(
      fs.readFileSync(
        `./transformedData/${projectName}/${environmentName}/segments/${segmentName}/segment.json`
      )
    );
    const segmentDefFiles = fs
      .readdirSync(
        `./transformedData/${projectName}/${environmentName}/segments/${segmentName}`
      )
      .filter(
        (file) => file.startsWith("segmentDef_") && file.endsWith(".json")
      )
      .map((file) =>
        JSON.parse(
          fs.readFileSync(
            `./transformedData/${projectName}/${environmentName}/segments/${segmentName}/${file}`
          )
        )
      );


      let doesSegmentExist;
    if (
      !caseExactFileExists(
        `./transformedData/${projectName}/${segmentName}Response.json`
      )
    ) {
      try {

        let offset = 0;
        let hasMore = true;
  
        while (hasMore) {
          const response = await makeApiRequestWithRetry({
            method: 'get',
            url: `${SPLIT_API_URL}segments/ws/${wsId}?offset=${offset}&limit=50`,
          });
  
          const segments = response.objects;
          allSegments = allSegments.concat(segments);
          
          hasMore = segments.length === 50;
          offset += 50;
        }
        // Now allSegments contains all segments from all pages
        doesSegmentExist = allSegments.some(segment => segment.name === segmentName);
        const thisSegment = allSegments.filter(segment => segment.name === segmentName)[0];
        console.log(`Segment ${segment.name} exists in Split`);
        if(doesSegmentExist) {
          fs.writeFileSync(
          `./transformedData/${projectName}/${segmentName}Response.json`,
          JSON.stringify(thisSegment, null, 2)
        );
      }
      } catch (error) {
        console.error(`Error checking segment existence:`, error.response?.data || error);
        return;
      }
    }

    if(      !caseExactFileExists(
      `./transformedData/${projectName}/${segmentName}Response.json`
    )) {
      try {
        const response = await makeApiRequestWithRetry({
          method: "post",
          url: `${SPLIT_API_URL}segments/ws/${wsId}/trafficTypes/user`,
          data: segment,
        });
        console.log(`Segment ${segment.name} created in Split`);
        fs.writeFileSync(
          `./transformedData/${projectName}/${segmentName}Response.json`,
          JSON.stringify(response, null, 2)
        );
      } catch (error) {
        console.error(`Error creating segment ${segment.name}:`, error.response?.data || error);
      }
    }

    try {
      let offset = 0;
      let hasMore = true;

      
      while (hasMore) {
        const segmentsInEnvironment = await makeApiRequestWithRetry({
          method: "get",
          url: `${SPLIT_API_URL}segments/ws/${wsId}/environments/${environment.id}?limit=50&offset=${offset}`,
        });
        allSegmentsInEnvironment = allSegmentsInEnvironment.concat(segmentsInEnvironment.objects);
        hasMore = segmentsInEnvironment.objects.length === 50;
        offset += 50;
      }

      const segmentExistsInEnvironment = allSegmentsInEnvironment.some((s) => s.name === segment.name);
      
      if (segmentExistsInEnvironment) {
        console.log(`Segment ${segment.name} already exists in environment ${environment.name}`);
        
        // Empty the keys to reload from latest data
        try {
          const response = await makeApiRequestWithRetry({
            method: "put",
            url: `${SPLIT_API_URL}segments/${environment.id}/${segment.name}/uploadKeys?replace=true`,
            data: {"keys":[]},
          });
          console.log(
            `Segment ${segment.name} has keys emptied in environment ${environment.name}`
          );
        } catch (error) {
          console.error(
            `Error emptying keys for segment ${segment.name} in environment ${environment.name}:`,
            error.response?.data || error
          );
        }
      } else {
        // Create the segment in the environment if it doesn't exist
        try {
          const response = await makeApiRequestWithRetry({
            method: "post",
            url: `${SPLIT_API_URL}segments/${environment.id}/${segment.name}`,
          });
          console.log(
            `Segment ${segment.name} enabled in environment ${environment.name}`
          );
        } catch (error) {
          console.error(
            `Error enabling rule-based segment ${segment.name} in environment ${environment.name}:`,
            error.response?.data || error
          );
        }
      }

      // Upload segment definitions
      for (const segmentDef of segmentDefFiles) {
        try {
          const response = await makeApiRequestWithRetry({
            method: "put",
            url: `${SPLIT_API_URL}segments/${environment.id}/${segment.name}/uploadKeys?replace=false`,
            data: segmentDef,
          });
          console.log(
            `Segment ${segment.name} has keys uploaded in environment ${environment.name}`
          );
        } catch (error) {
          console.error(
            `Error uploading keys for segment ${segment.name} in environment ${environment.name}:`,
            error.response?.data || error
          );
        }
      }
    } catch (error) {
      console.error(
        `Error checking segment existence in environment ${environment.name}:`,
        error.response?.data || error
      );
    }
  }
}

module.exports = loadSegments;
