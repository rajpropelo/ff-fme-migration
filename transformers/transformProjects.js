const fs = require('fs');

function transformProjects(filterProject) {
  const rawData = fs.readFileSync('./data/projects.json');
  const projects = JSON.parse(rawData).data.content;

  // Example transformation logic
  const transformedProjects = projects.map(project => ({
    name: project.project.identifier,
    identifier: project.project.identifier,
    harnessName: project.project.name,
    requiresTitleAndComments: false,
    // Add any additional mapping logic here
  })).filter((element) =>
    element.identifier.match(filterProject) || String(element.harnessName || '').match(filterProject)
  );
  for (const project of transformedProjects) {

  const dir = `./transformedData/${project.name}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Save transformed data
  fs.writeFileSync(`./transformedData/${project.name}/transformedProject.json`, JSON.stringify(project, null, 2));
  console.log(`Project ${project.name} transformed and saved to transformedProjects.json`);
}
}

module.exports = transformProjects;
