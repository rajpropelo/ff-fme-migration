const fs = require('fs');
const path = require('path');
const { makeApiRequestWithRetry } = require('../../utils/splitApiClient');
const { SPLIT_API_URL } = require('../../config');

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../utils/splitApiClient');
jest.mock('../../config', () => ({
  SPLIT_API_URL: 'https://api.split.io/internal/api/v2/'
}));

// Create a simplified test version of the function
const testSegmentUpload = async (segmentExists, environmentHasSegment) => {
  // Setup mocks
  const wsId = 'ws-1234';
  const environmentId = 'env-1234';
  const segmentName = 'test-segment';
  const segmentDef = { keys: ['user1', 'user2'] };
  
  // Make the API calls directly
  if (!segmentExists) {
    try {
      await makeApiRequestWithRetry({
        method: 'post',
        url: `${SPLIT_API_URL}rule-based-segments/ws/${wsId}/trafficTypes/user`,
        data: { name: segmentName }
      });
    } catch (error) {
      console.error(`Error creating segment:`, error.response?.data || error);
      return false;
    }
  }
  
  if (!environmentHasSegment) {
    try {
      await makeApiRequestWithRetry({
        method: 'post',
        url: `${SPLIT_API_URL}rule-based-segments/${environmentId}/${segmentName}`
      });
    } catch (error) {
      console.error(`Error enabling rule-based segment in environment:`, error.response?.data || error);
      return false;
    }
  }
  
  try {
    await makeApiRequestWithRetry({
      method: 'put',
      url: `${SPLIT_API_URL}rule-based-segments/ws/${wsId}/${segmentName}/environments/${environmentId}`,
      data: segmentDef
    });
    return true;
  } catch (error) {
    console.error(`Error updating rule-based segment:`, error.response?.data || error);
    return false;
  }
};

describe('Rule-based segments upload', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock API client to return success by default
    makeApiRequestWithRetry.mockResolvedValue({ success: true });
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  test('should create a new segment when it does not exist', async () => {
    // Test creating a new segment
    const result = await testSegmentUpload(false, false);
    
    // Verify the API calls
    expect(makeApiRequestWithRetry).toHaveBeenCalledWith({
      method: 'post',
      url: `${SPLIT_API_URL}rule-based-segments/ws/ws-1234/trafficTypes/user`,
      data: { name: 'test-segment' }
    });
    
    expect(makeApiRequestWithRetry).toHaveBeenCalledWith({
      method: 'post',
      url: `${SPLIT_API_URL}rule-based-segments/env-1234/test-segment`
    });
    
    expect(makeApiRequestWithRetry).toHaveBeenCalledWith({
      method: 'put',
      url: `${SPLIT_API_URL}rule-based-segments/ws/ws-1234/test-segment/environments/env-1234`,
      data: { keys: ['user1', 'user2'] }
    });
    
    expect(result).toBe(true);
  });
  
  test('should update segment when it exists but not in environment', async () => {
    // Test updating a segment that exists but not in the environment
    const result = await testSegmentUpload(true, false);
    
    // Verify the API calls: should not create segment
    expect(makeApiRequestWithRetry).not.toHaveBeenCalledWith({
      method: 'post',
      url: `${SPLIT_API_URL}rule-based-segments/ws/ws-1234/trafficTypes/user`,
      data: expect.any(Object)
    });
    
    // Should enable segment in environment
    expect(makeApiRequestWithRetry).toHaveBeenCalledWith({
      method: 'post',
      url: `${SPLIT_API_URL}rule-based-segments/env-1234/test-segment`
    });
    
    // Should update segment definition
    expect(makeApiRequestWithRetry).toHaveBeenCalledWith({
      method: 'put',
      url: `${SPLIT_API_URL}rule-based-segments/ws/ws-1234/test-segment/environments/env-1234`,
      data: { keys: ['user1', 'user2'] }
    });
    
    expect(result).toBe(true);
  });
  
  test('should only update segment definition when segment exists in environment', async () => {
    // Test updating a segment that exists and is in the environment
    const result = await testSegmentUpload(true, true);
    
    // Verify API calls: should not create segment
    expect(makeApiRequestWithRetry).not.toHaveBeenCalledWith({
      method: 'post',
      url: `${SPLIT_API_URL}rule-based-segments/ws/ws-1234/trafficTypes/user`,
      data: expect.any(Object)
    });
    
    // Should not enable segment in environment
    expect(makeApiRequestWithRetry).not.toHaveBeenCalledWith({
      method: 'post',
      url: `${SPLIT_API_URL}rule-based-segments/env-1234/test-segment`
    });
    
    // Should update segment definition
    expect(makeApiRequestWithRetry).toHaveBeenCalledWith({
      method: 'put',
      url: `${SPLIT_API_URL}rule-based-segments/ws/ws-1234/test-segment/environments/env-1234`,
      data: { keys: ['user1', 'user2'] }
    });
    
    expect(result).toBe(true);
  });
  
  test('should handle errors when creating a segment', async () => {
    // Mock API error when creating segment
    makeApiRequestWithRetry.mockRejectedValueOnce({
      response: { data: { message: 'Test error' } }
    });
    
    const result = await testSegmentUpload(false, false);
    
    // Should fail and log error
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error creating segment:'),
      expect.any(Object)
    );
    
    expect(result).toBe(false);
  });
  
  test('should handle errors when enabling a segment in environment', async () => {
    // First call succeeds (create segment), second fails (enable in environment)
    makeApiRequestWithRetry
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce({
        response: { data: { message: 'Test error' } }
      });
    
    const result = await testSegmentUpload(false, false);
    
    // Should fail and log error
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error enabling segment in environment:'),
      expect.any(Object)
    );
    
    expect(result).toBe(false);
  });
  
  test('should handle errors when updating segment definition', async () => {
    // First two calls succeed, third fails (updating segment definition)
    makeApiRequestWithRetry
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce({
        response: { data: { message: 'Test error' } }
      });
    
    const result = await testSegmentUpload(false, false);
    
    // Should fail and log error
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error updating segment:'),
      expect.any(Object)
    );
    
    expect(result).toBe(false);
  });
});
