const fs = require('fs');
const transformEnvironments = require('../transformEnvironments');

// Mock dependencies
jest.mock('fs');

describe('transformEnvironments', () => {
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
              },
              {
                project: {
                  identifier: 'another-project',
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
                  name: 'Development',
                  type: 'Development'
                }
              },
              {
                environment: {
                  identifier: 'prod',
                  name: 'Production',
                  type: 'Production'
                }
              }
            ]
          }
        });
      }
      return '{}';
    });
  });

  test('should transform environments and save to file', () => {
    // Execute the function
    transformEnvironments('test-project');

    // Verify directories were created if they didn't exist
    expect(fs.existsSync).toHaveBeenCalledWith('./transformedData/test-project/dev');
    expect(fs.existsSync).toHaveBeenCalledWith('./transformedData/test-project/prod');
    expect(fs.mkdirSync).toHaveBeenCalledWith('./transformedData/test-project/dev', { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith('./transformedData/test-project/prod', { recursive: true });

    // Verify files were written with correct data
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/dev/transformedEnvironment.json',
      JSON.stringify({
        name: 'dev',
        production: false
      }, null, 2)
    );
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/prod/transformedEnvironment.json',
      JSON.stringify({
        name: 'prod',
        production: true
      }, null, 2)
    );
  });

  test('should filter projects based on the filter parameter', () => {
    // Execute the function with a filter
    transformEnvironments('another');

    // Verify only the matching project was processed
    expect(fs.readFileSync).toHaveBeenCalledWith('./data/test-org/another-project/environments.json');
    expect(fs.readFileSync).not.toHaveBeenCalledWith('./data/test-org/test-project/environments.json');
  });

  test('should handle empty environments data', () => {
    // Mock readFileSync to return empty environments data for this specific test
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes('environments.json')) {
        return JSON.stringify({
          data: {
            content: []
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
    transformEnvironments('test-project');

    // Verify no environment files were written
    expect(fs.writeFileSync).not.toHaveBeenCalledWith(
      expect.stringContaining('transformedEnvironment.json'),
      expect.any(String)
    );
  });
});
