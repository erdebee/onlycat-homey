'use strict';

const Homey = require('homey');
const { EVENT_TRIGGER_SOURCE } = require('../../lib/OnlyCatEventConstants');

class OnlyCatDevice extends Homey.Device {
  async onInit() {
    this.log('OnlyCat device initialized');
    
    // Get device type from settings
    this.deviceType = this.getSetting('type') || 'device';
    this.log(`Device type: ${this.deviceType}`);
    
    // Initialize device state based on type
    if (this.deviceType === 'device') {
      this.initializeDevice();
    } else if (this.deviceType === 'pet') {
      this.initializePet();
    }
    
    // Register device with app
    this.homey.app.registerDevice(this);
  }
  
  initializeDevice() {
    this.deviceData = this.getData();
    this.isConnected = false;
    this.lastEvent = null;
    
    // Set up capability listeners for device
    this.setupDeviceCapabilityListeners();
  }
  
  initializePet() {
    this.petData = this.getData();
    this.isHome = false;
    this.lastSeen = null;
    this.lastActivity = null;
    
    // Set up capability listeners for pet
    this.setupPetCapabilityListeners();
  }
  
  setupDeviceCapabilityListeners() {
    // Device capabilities are read-only, no listeners needed
  }
  
  setupPetCapabilityListeners() {
    // Pet devices don't have user-controllable capabilities
    // They only report presence and motion
  }
  
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Device settings changed:', changedKeys);
    
    // Handle any settings changes
    if (changedKeys.includes('deviceId') || changedKeys.includes('rfidCode')) {
      // Re-register device with new ID
      this.homey.app.unregisterDevice(this);
      this.homey.app.registerDevice(this);
    }
  }
  
  async onDeleted() {
    this.log('OnlyCat device deleted');
    this.homey.app.unregisterDevice(this);
  }
  
  // Device control methods (only for device type)
  async reboot() {
    if (this.deviceType !== 'device') return;
    
    try {
      await this.homey.app.apiClient.rebootDevice(this.deviceData.deviceId);
      this.log('Device reboot initiated');
    } catch (error) {
      this.error('Failed to reboot device:', error);
      throw error;
    }
  }
  
  // State update methods
  updateConnectivity(connected) {
    if (this.deviceType !== 'device') return;
    
    this.isConnected = connected;
    this.log(`Device connectivity updated: ${connected}`);
  }
  
  updateEvent(eventData) {
    if (this.deviceType === 'device') {
      this.lastEvent = eventData;
      
      // Update motion detection
      const rawSource = (eventData && eventData.body && eventData.body.eventTriggerSource != null)
        ? eventData.body.eventTriggerSource
        : eventData && eventData.eventTriggerSource;
      const source = typeof rawSource === 'string' ? Number(rawSource) : rawSource;
      if (source === EVENT_TRIGGER_SOURCE.INDOOR_MOTION || 
          source === EVENT_TRIGGER_SOURCE.OUTDOOR_MOTION) {
        this.log(`Motion detected on device ${this.deviceData.deviceId}, setting alarm_motion to true`);
        this.setCapabilityValue('alarm_motion', true);
        
        // Reset motion after 30 seconds
        setTimeout(() => {
          this.log(`Resetting motion detection on device ${this.deviceData.deviceId}`);
          this.setCapabilityValue('alarm_motion', false);
        }, 30000);
      }
      
      this.log('Device event updated:', eventData);
    } else if (this.deviceType === 'pet') {
      this.updatePetActivity(eventData);
    }
  }
  
  updatePetActivity(eventData) {
    this.lastActivity = eventData;
    
    // Update motion capability based on activity
    if (eventData.eventTriggerSource === EVENT_TRIGGER_SOURCE.INDOOR_MOTION || 
        eventData.eventTriggerSource === EVENT_TRIGGER_SOURCE.OUTDOOR_MOTION) {
      this.setCapabilityValue('alarm_motion', true);
      
      // Reset motion after 30 seconds
      setTimeout(() => {
        this.setCapabilityValue('alarm_motion', false);
      }, 30000);
    }
    
    this.log('Pet activity updated:', eventData);
  }
  
  updateLocation(isHome) {
    if (this.deviceType !== 'pet') return;
    
    this.isHome = isHome;
    this.log(`Setting pet ${this.petData.rfidCode} presence to ${isHome ? 'home' : 'away'}`);
    this.setCapabilityValue('alarm_presence', isHome);
    this.log(`Pet location updated: ${isHome ? 'home' : 'away'}`);
  }
  
  updateLastSeen(timestamp) {
    if (this.deviceType !== 'pet') return;
    
    this.lastSeen = new Date(timestamp);
    this.log(`Pet last seen updated: ${this.lastSeen}`);
  }
  
  // Getter methods
  getDeviceId() {
    if (this.deviceType === 'device') {
      return this.deviceData.deviceId;
    } else if (this.deviceType === 'pet') {
      return this.petData.deviceId;
    }
    return null;
  }
  
  getRfidCode() {
    if (this.deviceType === 'pet') {
      return this.petData.rfidCode;
    }
    return null;
  }
  
  getDeviceType() {
    return this.deviceType;
  }
  
  getName() {
    return this.getName();
  }
  
  isDeviceConnected() {
    return this.deviceType === 'device' ? this.isConnected : false;
  }
  
  isPetHome() {
    return this.deviceType === 'pet' ? this.isHome : false;
  }
  
  getLastEvent() {
    return this.deviceType === 'device' ? this.lastEvent : null;
  }
  
  getLastSeen() {
    return this.deviceType === 'pet' ? this.lastSeen : null;
  }
  
  getLastActivity() {
    return this.deviceType === 'pet' ? this.lastActivity : null;
  }
}

module.exports = OnlyCatDevice;
