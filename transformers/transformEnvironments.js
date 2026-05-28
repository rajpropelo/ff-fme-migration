const fs = require("fs");

function transformEnvironments(filterProject) {
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
      const environment = {
        name: envId,
        production: env.environment.type === "Production",
      };

      const dir = `./transformedData/${project.project}/${envId}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Save transformed data
      fs.writeFileSync(
        `./transformedData/${project.project}/${envId}/transformedEnvironment.json`,
        JSON.stringify(environment, null, 2)
      );
      console.log(
        `Environment ${envId} transformed and saved to transformedEnvironment.json`
      );
    }
  }
}
module.exports = transformEnvironments;
