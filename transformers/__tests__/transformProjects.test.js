const fs = require('fs');
const transformProjects = require('../transformProjects');

// Mock dependencies
jest.mock('fs');

describe('transformProjects', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    fs.existsSync.mockImplementation(() => false);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    fs.readFileSync.mockImplementation(() => JSON.stringify({
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
    }));
  });

  test('should transform projects and save to file', () => {
    // Execute the function
    transformProjects('.*');

    // Verify directories were created if they didn't exist
    expect(fs.existsSync).toHaveBeenCalledWith('./transformedData/test-project');
    expect(fs.existsSync).toHaveBeenCalledWith('./transformedData/another-project');
    expect(fs.mkdirSync).toHaveBeenCalledWith('./transformedData/test-project', { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith('./transformedData/another-project', { recursive: true });

    // Verify files were written with correct data
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/transformedProject.json',
      JSON.stringify({
        name: 'test-project',
        identifier: 'test-project',
        requiresTitleAndComments: false
      }, null, 2)
    );
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/another-project/transformedProject.json',
      JSON.stringify({
        name: 'another-project',
        identifier: 'another-project',
        requiresTitleAndComments: false
      }, null, 2)
    );
  });

  test('should filter projects based on the filter parameter', () => {
    // Execute the function with a filter
    transformProjects('test');

    // Verify only the matching project was processed
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/transformedProject.json',
      expect.any(String)
    );
    
    // Verify the non-matching project was not processed
    expect(fs.writeFileSync).not.toHaveBeenCalledWith(
      './transformedData/another-project/transformedProject.json',
      expect.any(String)
    );
  });

  test('should handle empty projects data', () => {
    // Mock readFileSync to return empty data
    fs.readFileSync.mockImplementation(() => JSON.stringify({
      data: {
        content: []
      }
    }));

    // Execute the function
    transformProjects('.*');

    // Verify no files were written
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
