'use strict';

const Homey = require('homey');

class OnlyCatDriver extends Homey.Driver {
  async onInit() {
    this.log('OnlyCat driver initialized');
  }
  
  async onPair(session) {
    this.log('Pairing session started');
    
    // Step 1: Token input (custom view)
    session.setHandler('token', async (inputToken) => {
      try {
        this.log('Token received, testing connection...');
        
        if (!inputToken || inputToken.trim() === '') {
          return { success: false, error: 'Token cannot be empty' };
        }
        
        // Store token in app settings
        await this.homey.settings.set('token', inputToken);
        
        // Initialize API client with new token
        await this.homey.app.initializeApiClientWithToken(inputToken);
        
        this.log('Token validated successfully');
        return { success: true };
      } catch (error) {
        this.error('Failed to validate token:', error);
        return { success: false, error: error.message || 'Failed to validate token' };
      }
    });
    
    // Handle the list_devices step
    session.setHandler('list_devices', async () => {
      this.log('list_devices handler called');
      return await this.onPairListDevices();
    });
  }
  
  async onPairListDevices() {
    this.log('onPairListDevices called');
    try {
      // Get token from app settings
      const token = await this.homey.settings.get('token');
      
      if (!token) {
        throw new Error('No token available. Please enter your device token first.');
      }
      
      // Check if API client is available
      if (!this.homey.app.apiClient) {
        throw new Error('API client not initialized. Please try again.');
      }
      
      this.log('API client is available, getting devices...');
      
      // Get devices from the app's API client
      let devices;
      try {
        devices = await this.homey.app.apiClient.getDevices();
        this.log(`API call successful, found ${devices.length} devices`);
        this.log('Devices response:', JSON.stringify(devices, null, 2));
      } catch (error) {
        this.error('Failed to get devices from API:', error);
        throw new Error(`Failed to get devices: ${error.message}`);
      }
      
      if (!Array.isArray(devices)) {
        this.error('Devices response is not an array:', devices);
        throw new Error('Invalid response from API: devices is not an array');
      }
      
      this.log(`Found ${devices.length} devices`);
      
      const deviceList = [];
      
      for (const device of devices) {
        this.log(`Processing device: ${device.deviceId} - ${device.description || 'No description'}`);
        
        // Add the device itself
        deviceList.push({
          name: device.description || `OnlyCat Device ${device.deviceId}`,
          data: {
            id: device.deviceId,
            deviceId: device.deviceId,
            type: 'device'
          },
          settings: {
            deviceId: device.deviceId,
            description: device.description || '',
            type: 'device'
          },
          store: {
            deviceData: device
          }
        });
        
        // Get pets for this device
        try {
          this.log(`Getting pets for device ${device.deviceId}...`);
          const rfids = await this.homey.app.apiClient.getLastSeenRfidCodesByDevice(device.deviceId);
          this.log(`Found ${rfids.length} pets for device ${device.deviceId}`);
          
          for (const rfid of rfids) {
            this.log(`Getting profile for pet ${rfid.rfidCode}...`);
            const rfidProfile = await this.homey.app.apiClient.getRfidProfile(rfid.rfidCode);
            
            deviceList.push({
              name: `${rfidProfile.label || `Pet ${rfid.rfidCode}`} (${device.description || device.deviceId})`,
              data: {
                id: rfid.rfidCode,
                rfidCode: rfid.rfidCode,
                deviceId: device.deviceId,
                type: 'pet'
              },
              settings: {
                rfidCode: rfid.rfidCode,
                deviceId: device.deviceId,
                name: rfidProfile.label || `Pet ${rfid.rfidCode}`,
                type: 'pet'
              },
              store: {
                petData: {
                  rfidCode: rfid.rfidCode,
                  deviceId: device.deviceId,
                  name: rfidProfile.label || `Pet ${rfid.rfidCode}`,
                  lastSeen: new Date(rfid.timestamp)
                }
              }
            });
          }
        } catch (error) {
          this.error(`Failed to get pets for device ${device.deviceId}:`, error);
        }
      }
      
      this.log(`Returning ${deviceList.length} devices for pairing`);
      this.log('Device list:', JSON.stringify(deviceList, null, 2));
      
      return deviceList;
      
    } catch (error) {
      this.error('Failed to get devices for pairing:', error);
      throw new Error('Failed to discover devices. Please check your token and try again.');
    }
  }
}

module.exports = OnlyCatDriver;