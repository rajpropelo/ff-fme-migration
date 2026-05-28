const fs = require('fs');
const transformTargetGroups = require('../transformTargetGroups');

// Mock dependencies
jest.mock('fs');

describe('transformTargetGroups', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    fs.existsSync.mockImplementation(() => false);
    fs.mkdirSync.mockImplementation(() => {});
    fs.writeFileSync.mockImplementation(() => {});
    console.warn = jest.fn();
    console.log = jest.fn();
    
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
      // Mock targetGroups.json
      if (path.includes('targetGroups.json')) {
        return JSON.stringify([
          {
            identifier: 'group1',
            name: 'Group 1',
            included: [
              { identifier: 'user1' },
              { identifier: 'user2' }
            ],
            excluded: [],
            rules: []
          },
          {
            identifier: 'group2',
            name: 'Group 2',
            included: [],
            excluded: [],
            rules: [{ condition: 'some-rule' }]
          },
          {
            identifier: 'group3',
            name: 'Group 3',
            included: Array(150000).fill({ identifier: 'user' }), // Exceeds limit
            excluded: [],
            rules: []
          }
        ]);
      }
      return '{}';
    });
  });

  test('should transform target groups and save to file', () => {
    // Execute the function
    transformTargetGroups('test-project');

    // Verify directory was created if it didn't exist
    expect(fs.existsSync).toHaveBeenCalledWith('./transformedData/test-project/dev/segments/group1');
    expect(fs.mkdirSync).toHaveBeenCalledWith('./transformedData/test-project/dev/segments/group1', { recursive: true });

    // Verify segment file was written with correct data
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/dev/segments/group1/segment.json',
      JSON.stringify({
        name: 'group1',
        description: 'Group 1'
      }, null, 2)
    );

    // Verify segment definition file was written with correct data
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/dev/segments/group1/segmentDef_0.json',
      JSON.stringify({
        keys: ['user1', 'user2'],
        comment: 'uploaded from harness transformer'
      }, null, 2)
    );
  });

  test('should transform target groups with rules as rule-based segments', () => {
    transformTargetGroups('test-project');
    
    // Verify group2 was processed as a rule-based segment
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('rule-based-segments/group2/segmentDef.json'),
      expect.any(String)
    );
    
    // Verify log message was shown for rule-based segment
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Target Group group2 for dev from project test-project transformed as rule based segment')
    );
  });

  test('should skip target groups that exceed the size limit', () => {
    // Execute the function
    transformTargetGroups('test-project');
    
    // Verify group3 was not processed (exceeds limit)
    expect(fs.writeFileSync).not.toHaveBeenCalledWith(
      expect.stringContaining('group3/segment.json'),
      expect.any(String)
    );
    
    // Verify warning was logged
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Target Group group3 exceeds the limit of 100,000 included values')
    );
  });

  test('should chunk large target groups into multiple segment definitions', () => {
    // Mock a large target group that needs chunking but is under the limit
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes('targetGroups.json')) {
        return JSON.stringify([
          {
            identifier: 'large-group',
            name: 'Large Group',
            included: Array(15000).fill().map((_, i) => ({ identifier: `user${i}` })),
            rules: []
          }
        ]);
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
      return '{}';
    });

    // Execute the function
    transformTargetGroups('test-project');

    // Verify multiple segment definition files were created
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/dev/segments/large-group/segmentDef_0.json',
      expect.any(String)
    );
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      './transformedData/test-project/dev/segments/large-group/segmentDef_1.json',
      expect.any(String)
    );
  });

  test('should handle empty target groups data', () => {
    // Mock targetGroups.json to return empty data
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes('targetGroups.json')) {
        return JSON.stringify([]);
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
      return '{}';
    });

    // Execute the function
    transformTargetGroups('test-project');

    // Verify no segment files were written
    expect(fs.writeFileSync).not.toHaveBeenCalledWith(
      expect.stringContaining('segment.json'),
      expect.any(String)
    );
  });
});
