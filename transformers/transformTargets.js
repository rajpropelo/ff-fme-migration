const fs = require("fs");

function transformTargets(filterProject) {
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
      const targets = JSON.parse(
        fs.readFileSync(
          `./data/${project.org}/${project.project}/${envId}/targets.json`
        )
      );
      let transformedTargets = [];
      for (const target of targets) {
        let identity = {
          "key": target.identifier,
          "values": target.attributes,
        }
        if (target.attributes && target.attributes.length !== 0) {
          transformedTargets.push(identity);
        }
      }
      const dir = `./transformedData/${project.project}/${envId}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Save transformed data
      fs.writeFileSync(
        `./transformedData/${project.project}/${envId}/transformedTargets.json`,
        JSON.stringify(transformedTargets, null, 2)
      );
      console.log(
        `Targets for ${envId} transformed and saved to transformedTargets.json`
      );
    }
  }
}

module.exports = transformTargets;
