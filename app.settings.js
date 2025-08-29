'use strict';

const { Settings } = require('homey');

class OnlyCatSettings extends Settings {
  async onInit() {
    this.log('OnlyCat settings initialized');
  }
  
  async onSettingsRequest(request, response) {
    // Return the settings form
    return {
      title: 'OnlyCat Settings',
      schema: {
        token: {
          type: 'string',
          title: 'Device Token',
          description: 'Enter your OnlyCat device token. You can find this in the OnlyCat app under "Account".',
          required: true
        }
      }
    };
  }
  
  async onSettingsSave(request, response) {
    const { token } = request.body;
    
    try {
      // Validate token by attempting to connect
      const testClient = new (require('../lib/OnlyCatApiClient'))(token);
      await testClient.connect();
      await testClient.getDevices();
      await testClient.disconnect();
      
      // Save settings
      await this.homey.settings.set('token', token);
      
      // Reinitialize app with new token
      if (this.homey.app.apiClient) {
        await this.homey.app.apiClient.disconnect();
      }
      await this.homey.app.initializeApiClient();
      
      return { success: true };
    } catch (error) {
      this.error('Failed to save settings:', error);
      return { 
        success: false, 
        error: 'Invalid token or connection failed. Please check your token and try again.' 
      };
    }
  }
}

module.exports = OnlyCatSettings;

