const fs = require('fs');
const transformTargets = require('../transformTargets');

// Mock dependencies
jest.mock('fs');

describe('transformTargets', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    fs.existsSync.mockImplementation(() => false);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    
    // Mock projects.json
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes('projects.json')) {
        return JSON.stringify({
          data: {
            content: [
              {
                project: {
                  identifier: 'test-project',
                  orgIdentifier: 'test-org'
                }
              }
            ]
          }
        });
      }
      // Mock environments.json
      if (path.includes('environments.json')) {
        return JSON.stringify({
          data: {
            content: [
              {
                environment: {
                  identifier: 'dev',
                  name: 'Development'
                }
              }
            ]
          }
        });
      }
      // Mock targets.json
      if (path.includes('targets.json')) {
        return JSON.stringify([
          {
            identifier: 'target1',
            name: 'Target 1',
            attributes: [
              { name: 'attr1', value: 'value1' },
              { name: 'attr2', value: 'value2' }
            ]
          },
          {
            identifier: 'target2',
            name: 'Target 2',
            attributes: [] // Empty attributes
          }
        ]);
      }
      return '{}';
    });
  });

  test('should transform targets and save to file', () => {
    // Execute the function
    transformTargets('test-project');

    // Verify directory was created if it didn't exist
    expect(fs.existsSync).toHaveBeenCalledWith('./transformedData/test-project/dev');
    expect(fs.mkdirSync).toHaveBeenCalledWith('./transformedData/test-project/dev', { recursive: true });

    // Verify file was written with correct data
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/dev/transformedTargets.json',
      JSON.stringify([
        {
          key: 'target1',
          values: [
            { name: 'attr1', value: 'value1' },
            { name: 'attr2', value: 'value2' }
          ]
        }
        // target2 should be excluded because it has empty attributes
      ], null, 2)
    );
  });

  test('should filter out targets with empty attributes', () => {
    // Execute the function
    transformTargets('test-project');
    
    // Get the actual data written to the file
    const writeFileCall = fs.writeFileSync.mock.calls.find(call => 
      call[0].includes('transformedTargets.json')
    );
    
    const writtenData = JSON.parse(writeFileCall[1]);
    
    // Verify only targets with attributes were included
    expect(writtenData.length).toBe(1);
    expect(writtenData[0].key).toBe('target1');
    expect(writtenData).not.toContainEqual(expect.objectContaining({ key: 'target2' }));
  });

  test('should handle multiple environments', () => {
    // Mock environments.json to return multiple environments
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes('environments.json')) {
        return JSON.stringify({
          data: {
            content: [
              {
                environment: {
                  identifier: 'dev',
                  name: 'Development'
                }
              },
              {
                environment: {
                  identifier: 'prod',
                  name: 'Production'
                }
              }
            ]
          }
        });
      }
      if (path.includes('projects.json')) {
        return JSON.stringify({
          data: {
            content: [
              {
                project: {
                  identifier: 'test-project',
                  orgIdentifier: 'test-org'
                }
              }
            ]
          }
        });
      }
      // Mock targets.json
      if (path.includes('targets.json')) {
        return JSON.stringify([
          {
            identifier: 'target1',
            name: 'Target 1',
            attributes: [
              { name: 'attr1', value: 'value1' }
            ]
          }
        ]);
      }
      return '{}';
    });

    // Execute the function
    transformTargets('test-project');

    // Verify files were written for both environments
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/dev/transformedTargets.json',
      expect.any(String)
    );
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/prod/transformedTargets.json',
      expect.any(String)
    );
  });

  test('should handle empty targets data', () => {
    // Mock targets.json to return empty data
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes('targets.json')) {
        return JSON.stringify([]);
      }
      if (path.includes('environments.json')) {
        return JSON.stringify({
          data: {
            content: [
              {
                environment: {
                  identifier: 'dev',
                  name: 'Development'
                }
              }
            ]
          }
        });
      }
      if (path.includes('projects.json')) {
        return JSON.stringify({
          data: {
            content: [
              {
                project: {
                  identifier: 'test-project',
                  orgIdentifier: 'test-org'
                }
              }
            ]
          }
        });
      }
      return '{}';
    });

    // Execute the function
    transformTargets('test-project');

    // Verify file was written with empty array
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/dev/transformedTargets.json',
      JSON.stringify([], null, 2)
    );
  });
});
