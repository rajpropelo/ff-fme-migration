const fs = require("fs");
const harnessOpToSplitOp = {
  "starts_with": "STARTS_WITH_STRING",
  "ends_with": "ENDS_WITH_STRING",
  "equals": "IN_LIST_STRING",
  "equal": "IN_LIST_STRING",
  "equal_sensitive": "IN_LIST_STRING",
  "contains": "CONTAINS_STRING",
  "in": "IN_LIST_STRING",
};
function transformTargetGroups(filterProject) {
  const projects = JSON.parse(fs.readFileSync("./data/projects.json")).data
    .content;

  const projectIds = projects.map((project) => {
    return {
      project: project.project.identifier,
      org: project.project.orgIdentifier,
    };
  }).filter((element) => element.project.match(filterProject));
  for (const project of projectIds) {
    const environments = JSON.parse(
      fs.readFileSync(
        `./data/${project.org}/${project.project}/environments.json`
      )
    ).data.content;
    for (const env of environments) {
      const envId = env.environment.identifier;
      const targetGroups = JSON.parse(
        fs.readFileSync(
          `./data/${project.org}/${project.project}/${envId}/targetGroups.json`
        )
      );
      //let transformedTargetGroups = [];
      for (const targetGroup of targetGroups) {
        let segment = {
          name: targetGroup.identifier,
          description: targetGroup.name,
        };
        let segmentDef = [];
        const chunkSize = 10000;
        if (targetGroup.included.length > 100000) {
          console.warn(`Target Group ${targetGroup.identifier} exceeds the limit of 100,000 included values and will not be included in the transformation`);
          continue;
        }
        for (let i = 0; i < targetGroup.included.length; i += chunkSize) {
          segmentDef.push({
            keys: targetGroup.included.slice(i, i + chunkSize).map((identity) => identity.identifier),
            comment: "uploaded from harness transformer",
          });
        }

        if (segmentDef[0] && segmentDef[0].keys.length > 0 && targetGroup.rules.length == 0) {
          const dir = `./transformedData/${project.project}/${envId}/segments/${segment.name}`;
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          // Save transformed data
          fs.writeFileSync(
            `./transformedData/${project.project}/${envId}/segments/${segment.name}/segment.json`,
            JSON.stringify(segment, null, 2)
          );
            segmentDef.forEach((def, index) => {
            fs.writeFileSync(
              `./transformedData/${project.project}/${envId}/segments/${segment.name}/segmentDef_${index}.json`,
              JSON.stringify(def, null, 2)
            );
            });
          console.log(
            `Target Group ${segment.name} for ${envId} from project ${project.project} transformed and saved`
          );
        } else {
          console.log( `Target Group ${segment.name} for ${envId} from project ${project.project} transformed as rule based segment`);
          const dir = `./transformedData/${project.project}/${envId}/rule-based-segments/${segment.name}`;
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(
            `./transformedData/${project.project}/${envId}/rule-based-segments/${segment.name}/segment.json`,
            JSON.stringify(segment, null, 2)
          );
          let rbs = {
            title: `${segment.name} initial definition`,
            comment: "uploaded from harness transformer",
            rules: [],
            excludedKeys: []
          };
          if (targetGroup.included.length > 0) {
            rbs.rules.push({
              "condition": {
                  "combiner": "AND",
                  "matchers": [{
                      "type": "IN_LIST_STRING",
                      "strings": targetGroup.included.map((identity) => identity.identifier)
                  }]
              }
            });
          }
          if(targetGroup.excluded.length > 0) {
            rbs.excludedKeys = targetGroup.excluded.map((identity) => identity.identifier);
          }
          if(targetGroup.rules.length > 0) {
            rbs.rules = targetGroup.rules.map((rule) => {
              return {
                "condition": {
                  "combiner": "AND",
                  "matchers": [
                  {
                  "type": (rule.attribute !== 'identifier' ? harnessOpToSplitOp[rule.op] : 'IN_LIST_STRING'),
                  ...(rule.attribute !== 'identifier' && { "attribute": rule.attribute }),
                  "strings": rule.values,
                  "negate": rule.negate
                  }
                ]
              }
            }
          });
          }
          fs.writeFileSync(
            `./transformedData/${project.project}/${envId}/rule-based-segments/${segment.name}/segmentDef.json`,
            JSON.stringify(rbs, null, 2)
          );
        }
      }
    }
  }
}


module.exports = transformTargetGroups;
