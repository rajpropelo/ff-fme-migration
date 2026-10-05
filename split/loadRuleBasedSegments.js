const fs = require("fs");
const { SPLIT_API_URL } = require("../config");
const { makeApiRequestWithRetry } = require("../utils/splitApiClient");
const path = require("path");
const { caseExactFileExists } = require("../utils/fileUtils");

async function loadRuleBasedSegments(filterProject, limit = 50, offset = 0) {
  function getDirectoriesWithFlagDef(dir) {
    const directories = [];

    function searchDirectory(currentPath) {
      const filesAndDirs = fs.readdirSync(currentPath);

      for (const fileOrDir of filesAndDirs) {
        const fullPath = path.join(currentPath, fileOrDir);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          searchDirectory(fullPath);
        } else if (fileOrDir === "flagDef.json" || fileOrDir === "segmentDef_0.json" || fileOrDir === "segmentDef.json") {
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
    .filter((element) => element[3] == "rule-based-segments") // only rule based segments
    .filter((element) => element[1].match(filterProject)); 
  let allSegmentsInProject = [];
  let allSegmentsInEnvironment = [];
  for (const dir of directoriesWithFlagDef) {
    const projectName = dir[1];
    const environmentName = dir[2];
    const segmentName = dir[4];
    
    allSegmentsInProject[projectName] = allSegmentsInProject[projectName] || [];
    allSegmentsInEnvironment[projectName+environmentName] = allSegmentsInEnvironment[projectName+environmentName] || [];

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
        `./transformedData/${projectName}/${environmentName}/rule-based-segments/${segmentName}/segment.json`
      )
    );
    const segmentDef = JSON.parse(
      fs.readFileSync(
        `./transformedData/${projectName}/${environmentName}/rule-based-segments/${segmentName}/segmentDef.json`
      )
    );

    let doesSegmentExist;
    if (
      !caseExactFileExists(
        `./transformedData/${projectName}/${segmentName}Response.json`
      )
    ) {
      if(allSegmentsInProject[projectName].length === 0) {
        try {
          let currentOffset = offset;
          let hasMoreSegments = true;
        
        // Paginate through all segments
        while (hasMoreSegments) {
          const response = await makeApiRequestWithRetry({
            method: 'get',
            url: `${SPLIT_API_URL}rule-based-segments/ws/${wsId}?limit=${limit}&offset=${currentOffset}`,
          });

          if (response && response.length > 0) {
            allSegmentsInProject[projectName] = [...allSegmentsInProject[projectName], ...response];
            currentOffset += response.length;
            
            // If we received fewer items than the limit, we've reached the end
            // or if we've recieved more than this functionality isn't implemented yet and we should not iterate
            if (response.length < limit || response.length > limit) {
              hasMoreSegments = false;
            }
          } else {
            hasMoreSegments = false;
          }
        }
      } catch (error) {
        console.error(`Error fetching segments for project ${projectName}:`, error.response?.data || error);
        return;
      }
    }
        // Check if segment exists in the fetched segments
        doesSegmentExist = allSegmentsInProject[projectName].some(segment => segment.name === segmentName);
        const thisSegment = allSegmentsInProject[projectName].filter(segment => segment.name === segmentName)[0];
        console.log(`Rule based Segment ${segment.name} exists in Split: ${doesSegmentExist}`);
        if(doesSegmentExist) {
          fs.writeFileSync(
          `./transformedData/${projectName}/${segmentName}Response.json`,
          JSON.stringify(thisSegment, null, 2)
        );
      }
    }

    if(      !caseExactFileExists(
      `./transformedData/${projectName}/${segmentName}Response.json`
    )) {
      try {
        const response = await makeApiRequestWithRetry({
          method: "post",
          url: `${SPLIT_API_URL}rule-based-segments/ws/${wsId}/trafficTypes/user`,
          data: segment,
        });
        console.log(`Rule based Segment ${segment.name} created in Split`);
        fs.writeFileSync(
          `./transformedData/${projectName}/${segmentName}Response.json`,
          JSON.stringify(response, null, 2)
        );
      } catch (error) {
        console.error(`Error creating segment ${segment.name}:`, error.response?.data || error);
      }
    } 

    try {
      if(allSegmentsInEnvironment[projectName+environmentName].length === 0) {
        let currentOffset = offset;
        let hasMoreSegments = true;
        
        // Paginate through all segments in the environment
      while (hasMoreSegments) {
        const segmentsInEnvironment = await makeApiRequestWithRetry({
          method: "get",
          url: `${SPLIT_API_URL}rule-based-segments/ws/${wsId}/environments/${environment.id}?limit=${limit}&offset=${currentOffset}`,
        });
        
        if (segmentsInEnvironment && segmentsInEnvironment.length > 0) {
          allSegmentsInEnvironment[projectName+environmentName] = [...allSegmentsInEnvironment[projectName+environmentName], ...segmentsInEnvironment];
          currentOffset += segmentsInEnvironment.length;
          
          // If we received fewer items than the limit, we've reached the end
          // if we've recieved more, than this functionality isn't implemented yet and we should not iterate
          if (segmentsInEnvironment.length < limit || segmentsInEnvironment.length > limit) {
            hasMoreSegments = false;
          }
        } else {
          hasMoreSegments = false;
        }
      }
      allSegmentsInEnvironment[projectName+environmentName] = allSegmentsInEnvironment[projectName+environmentName] || [];
    }

      const segmentExistsInEnvironment = allSegmentsInEnvironment[projectName+environmentName].some((s) => s.name === segment.name);

      if (segmentExistsInEnvironment) {
        console.log(`Rule based Segment ${segment.name} already exists in environment ${environment.name}`);
        
        // full reload from latest definition
        try {
          const response = await makeApiRequestWithRetry({
            method: "put",
            url: `${SPLIT_API_URL}rule-based-segments/ws/${wsId}/${segment.name}/environments/${environment.id}`,
            data: segmentDef,
          });
          console.log(
            `Rule based Segment ${segment.name} has been updated in environment ${environment.name}`
          );
        } catch (error) {
          console.error(
            `Error updating rule based segment ${segment.name} in environment ${environment.name}:`,
            error.response?.data || error
          );
        }
      } else {
        // Create the segment in the environment if it doesn't exist
        try {
          const response = await makeApiRequestWithRetry({
            method: "post",
            url: `${SPLIT_API_URL}rule-based-segments/${environment.id}/${segment.name}`,
          });
          console.log(
            `Rule based Segment ${segment.name} enabled in environment ${environment.name}`
          );
        } catch (error) {
          console.error(
            `Error enabling Rule based Segment ${segment.name} in environment ${environment.name}:`,
            error.response?.data || error
          );
        }
      
      // Upload segment definitions
      try {
        const response = await makeApiRequestWithRetry({
          method: "put",
          url: `${SPLIT_API_URL}rule-based-segments/ws/${wsId}/${segment.name}/environments/${environment.id}`,
          data: segmentDef,
        });
        console.log(
          `Rule based Segment ${segment.name} has been updated in environment ${environment.name}`
        );
      } catch (error) {
        console.error(
          `Error updating Rule based Segment ${segment.name} in environment ${environment.name}:`,
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

module.exports = loadRuleBasedSegments;
