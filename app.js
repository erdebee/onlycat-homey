'use strict';

const Homey = require('homey');

const OnlyCatApiClient = require('./lib/OnlyCatApiClient');
const {
  EVENT_CLASSIFICATION,
  EVENT_TRIGGER_SOURCE,
  EVENT_TYPE,
  EVENT_CLASSIFICATION_NAMES,
  EVENT_TRIGGER_SOURCE_NAMES
} = require('./lib/OnlyCatEventConstants');

class OnlyCatApp extends Homey.App {
  async onInit() {
    this.log('OnlyCat app is running...');
    
    // Initialize API client
    this.apiClient = null;
    this.devices = new Map();
    this.pets = new Map();
    this.deviceInstances = new Map();
    this.petInstances = new Map();
    this.events = new Map(); // Track events by eventId for state aggregation
    
    // Load settings
    this.settings = await this.homey.settings.get('settings') || {};
    
    // Initialize API client if token is available
    if (this.settings.token) {
      await this.initializeApiClient();
    }
    
    // Register flow cards
    this.registerFlowCards();
  }
  
  async initializeApiClient() {
    try {
      this.apiClient = new OnlyCatApiClient(this.settings.token);
      
      // Set up event listeners
      this.apiClient.on('connect', () => {
        this.log('Connected to OnlyCat API');
        this.handleApiConnectionChange(true);
      });
      
      this.apiClient.on('disconnect', () => {
        this.log('Disconnected from OnlyCat API');
        this.handleApiConnectionChange(false);
      });
      
      this.apiClient.on('deviceUpdate', (deviceData) => {
        this.handleDeviceUpdate(deviceData);
      });
      
      this.apiClient.on('deviceEventUpdate', async (eventData) => {
        await this.handleEventUpdate(eventData);
      });

      this.apiClient.on('eventUpdate', async (eventData) => {
        await this.handleEventUpdate(eventData);
      });
      
      // Connect to API
      await this.apiClient.connect();
      
      // Initialize devices and pets
      await this.initializeDevices();
      await this.initializePets();
      
      // Synchronize all device capabilities
      this.synchronizeDeviceCapabilities();
      
    } catch (error) {
      this.error('Failed to initialize API client:', error);
    }
  }
  
  async initializeApiClientWithToken(token) {
    try {
      // Update settings with new token
      this.settings.token = token;
      await this.homey.settings.set('settings', this.settings);
      
      // Create new API client with token
      this.apiClient = new OnlyCatApiClient(token);
      
      // Set up event listeners
      this.apiClient.on('connect', () => {
        this.log('Connected to OnlyCat API');
        this.handleApiConnectionChange(true);
      });
      
      this.apiClient.on('disconnect', () => {
        this.log('Disconnected from OnlyCat API');
        this.handleApiConnectionChange(false);
      });
      
      this.apiClient.on('deviceUpdate', (deviceData) => {
        this.handleDeviceUpdate(deviceData);
      });
      
      this.apiClient.on('deviceEventUpdate', async (eventData) => {
        await this.handleEventUpdate(eventData);
      });
      
      // Connect to API
      await this.apiClient.connect();
      
    } catch (error) {
      this.error('Failed to initialize API client with token:', error);
      throw error;
    }
  }
  
  async initializeDevices() {
    try {
      const devices = await this.apiClient.getDevices();
      
      for (const deviceData of devices) {
        const device = {
          id: deviceData.deviceId,
          name: deviceData.description || `OnlyCat Device ${deviceData.deviceId}`,
          data: deviceData,
          pets: []
        };
        
        this.devices.set(device.id, device);
        
        // Get device events to determine current state
        const events = await this.apiClient.getDeviceEvents(device.id);
        if (events.length > 0) {
          const lastEvent = events[events.length - 1];
          device.lastEvent = lastEvent;
        }
      }
      
      this.log(`Initialized ${this.devices.size} devices`);
    } catch (error) {
      this.error('Failed to initialize devices:', error);
    }
  }
  
  async initializePets() {
    try {
      for (const [deviceId, device] of this.devices) {
        const rfids = await this.apiClient.getLastSeenRfidCodesByDevice(deviceId);
        
        for (const rfid of rfids) {
          const rfidProfile = await this.apiClient.getRfidProfile(rfid.rfidCode);
          
          const pet = {
            id: rfid.rfidCode,
            deviceId: deviceId,
            name: rfidProfile.label || `Pet ${rfid.rfidCode}`,
            rfidCode: rfid.rfidCode,
            lastSeen: new Date(rfid.timestamp),
            isHome: false // Will be determined by events
          };
          
          this.pets.set(pet.id, pet);
          device.pets.push(pet);
        }
      }
      
      this.log(`Initialized ${this.pets.size} pets`);
    } catch (error) {
      this.error('Failed to initialize pets:', error);
    }
  }
  
  handleDeviceUpdate(deviceData) {
    this.log('Handling device update:', JSON.stringify(deviceData, null, 2));
    
    const device = this.devices.get(deviceData.deviceId);
    if (device) {
      device.data = { ...device.data, ...deviceData };
      
      // Update device capabilities
      this.updateDeviceCapabilities(device);
    } else {
      this.log(`Device not found for update: ${deviceData.deviceId}`);
    }
  }
  
  handleApiConnectionChange(connected) {
    this.log(`API connection changed: ${connected}`);
    
    // Update all device instances with new connectivity status
    for (const [deviceId, deviceInstance] of this.deviceInstances) {
      try {
        // Update the device instance connectivity
        deviceInstance.updateConnectivity(connected);
        
        // Trigger device connected flow card
        this.homey.flow.getDeviceTriggerCard('device_connected').trigger(deviceInstance, {
          connected: connected
        });
        
        this.log(`Updated connectivity for device ${deviceId}: ${connected}`);
      } catch (error) {
        this.error(`Failed to update connectivity for device ${deviceId}:`, error);
      }
    }
  }
  
  async handleEventUpdate(eventData) {
    this.log('Handling device event update:', JSON.stringify(eventData, null, 2));
    
    const device = this.devices.get(eventData.deviceId);
    if (!device) {
      this.log(`Device not found for event: ${eventData.deviceId}`);
      return;
    }
    
    // Aggregate event state
    const aggregatedEventData = this.aggregateEventState(eventData);
    
    // Update device's last event with aggregated data
    device.lastEvent = aggregatedEventData;
    
    // Always process event type first (Create or Update)
    await this.processEventByType(device, aggregatedEventData);
    
    // Update device capabilities
    this.updateDeviceCapabilities(device);
  }
  
  async processEventByType(device, eventData) {
    const eventType = eventData.type || EVENT_TYPE.UNKNOWN;
    this.log(`Processing ${eventType.toUpperCase()} event for device ${device.id}`);
    
    switch (eventType) {
      case EVENT_TYPE.CREATE:
        await this.handleCreateEvent(device, eventData);
        break;
      case EVENT_TYPE.UPDATE:
        await this.handleUpdateEvent(device, eventData);
        break;
      default:
        this.log(`Unknown event type: ${eventType}`);
        break;
    }
  }
  
  async handleCreateEvent(device, eventData) {
    this.log(`Create event for device ${device.id}:`, eventData);
    
    // Subscribe to this event to get future updates
    if (eventData.eventId && this.apiClient) {
      try {
        await this.apiClient.subscribeToDeviceEvent({
          deviceId: eventData.deviceId,
          eventId: eventData.eventId
        });
        this.log(`Subscribed to event ${eventData.eventId} for device ${eventData.deviceId}`);
      } catch (error) {
        this.error(`Failed to subscribe to event ${eventData.eventId}:`, error);
      }
    }
    
    // Process the event based on classification, trigger source, and RFID codes
    await this.processEventSituation(device, eventData);
  }
  
  async handleUpdateEvent(device, eventData) {
    this.log(`Update event for device ${device.id}:`, eventData);
    
    // Process the event based on classification, trigger source, and RFID codes
    await this.processEventSituation(device, eventData);
  }
  
  async processEventSituation(device, eventData) {
    const classification = eventData.eventClassification;
    const triggerSource = eventData.eventTriggerSource;
    const rfidCodes = eventData.rfidCodes || eventData.body?.rfidCodes || [];
    
    const classificationName = EVENT_CLASSIFICATION_NAMES[classification] || 'UNKNOWN';
    const triggerSourceName = EVENT_TRIGGER_SOURCE_NAMES[triggerSource] || 'UNKNOWN';
    
    this.log(`Event situation - Classification: ${classificationName}, Trigger: ${triggerSourceName}, RFID codes: ${rfidCodes.length}`);
    
    // Determine the event situation based on the three key properties
    const situation = this.determineEventSituation(classification, triggerSource, rfidCodes);
    
    // Handle the situation
    await this.handleEventSituation(device, eventData, situation);
  }
  
  determineEventSituation(classification, triggerSource, rfidCodes) {
    const hasRfidCodes = rfidCodes.length > 0;
    
    // Define possible situations
    if (classification === EVENT_CLASSIFICATION.CONTRABAND) {
      return {
        type: 'CONTRABAND_DETECTION',
        description: 'Contraband detected',
        hasRfidCodes
      };
    }
    
    if (classification === EVENT_CLASSIFICATION.HUMAN_ACTIVITY) {
      return {
        type: 'HUMAN_ACTIVITY',
        description: 'Human activity detected',
        hasRfidCodes
      };
    }
    
    if (classification === EVENT_CLASSIFICATION.REMOTE_UNLOCK) {
      return {
        type: 'REMOTE_UNLOCK',
        description: 'Device unlocked remotely',
        hasRfidCodes
      };
    }
    
    if (classification === EVENT_CLASSIFICATION.SUSPICIOUS) {
      if (hasRfidCodes) {
        return {
          type: 'UNKNOWN_PET_DETECTED',
          description: 'Unknown pet detected',
          hasRfidCodes
        };
      } else {
        return {
          type: 'SUSPICIOUS_ACTIVITY',
          description: 'Suspicious activity detected',
          hasRfidCodes
        };
      }
    }
    
    if (classification === EVENT_CLASSIFICATION.CLEAR) {
      if (hasRfidCodes) {
        return {
          type: 'PET_DETECTED',
          description: 'Known pet detected',
          hasRfidCodes
        };
      } else {
        return {
          type: 'CLEAR_ACTIVITY',
          description: 'Clear activity detected',
          hasRfidCodes
        };
      }
    }
    
    // Default for unknown classification
    return {
      type: 'UNKNOWN_EVENT',
      description: 'Unknown event type',
      hasRfidCodes
    };
  }
  
  async handleEventSituation(device, eventData, situation) {
    this.log(`Handling event situation: ${situation.type} - ${situation.description}`);
    
    switch (situation.type) {
      case 'CONTRABAND_DETECTION':
        await this.handleContrabandDetection(device, eventData);
        break;
        
      case 'HUMAN_ACTIVITY':
        await this.handleHumanActivity(device, eventData);
        break;
        
      case 'REMOTE_UNLOCK':
        await this.handleRemoteUnlock(device, eventData);
        break;
        
      case 'UNKNOWN_PET_DETECTED':
        await this.handleUnknownPetDetected(device, eventData);
        break;
        
      case 'SUSPICIOUS_ACTIVITY':
        await this.handleSuspiciousActivity(device, eventData);
        break;
        
      case 'PET_DETECTED':
        await this.handlePetDetected(device, eventData);
        break;
        
      case 'CLEAR_ACTIVITY':
        await this.handleClearActivity(device, eventData);
        break;
        
      default:
        this.log(`Unhandled event situation: ${situation.type}`);
        break;
    }
  }
  
  async handleContrabandDetection(device, eventData) {
    this.log(`Contraband detection for device ${device.id}`);
    
    const deviceInstance = this.deviceInstances.get(device.id);
    if (deviceInstance) {
      try {
        this.homey.flow.getDeviceTriggerCard('contraband_detected').trigger(deviceInstance, {
          device: deviceInstance,
          event: eventData
        });
        this.log(`Triggered contraband_detected flow card for device ${device.id}`);
      } catch (error) {
        this.error(`Failed to trigger contraband_detected flow card:`, error);
      }
    }
    
    // Update device state
    if (eventData.body) {
      device.data = { ...device.data, ...eventData.body };
    }
  }
  
  async handleHumanActivity(device, eventData) {
    this.log(`Human activity detected for device ${device.id}`);
    
    // Update device state for human activity
    if (eventData.body) {
      device.data = { ...device.data, ...eventData.body };
    }
    
    // The device instance will handle motion detection automatically
    // through the updateEvent method
  }
  
  async handleRemoteUnlock(device, eventData) {
    this.log(`Remote unlock for device ${device.id}`);
    
    // Update device lock state
    if (device.data) {
      device.data.isLocked = false;
    }
    
    // Update device state
    if (eventData.body) {
      device.data = { ...device.data, ...eventData.body };
    }
  }
  
  async handleUnknownPetDetected(device, eventData) {
    this.log(`Unknown pet detected for device ${device.id}`);
    
    const rfidCodes = eventData.rfidCodes || eventData.body?.rfidCodes || [];
    
    for (const rfidCode of rfidCodes) {
      const deviceInstance = this.deviceInstances.get(device.id);
      if (deviceInstance) {
        try {
          this.homey.flow.getDeviceTriggerCard('unknown_pet_detected').trigger(deviceInstance, {
            device: deviceInstance,
            rfidCode: rfidCode,
            direction: this.determineDirection(eventData.eventTriggerSource)
          });
          this.log(`Triggered unknown_pet_detected flow card for RFID ${rfidCode}`);
        } catch (error) {
          this.error(`Failed to trigger unknown_pet_detected flow card:`, error);
        }
      }
    }
    
    // Update device state
    if (eventData.body) {
      device.data = { ...device.data, ...eventData.body };
    }
  }
  
  async handleSuspiciousActivity(device, eventData) {
    this.log(`Suspicious activity detected for device ${device.id}`);
    
    // Update device state
    if (eventData.body) {
      device.data = { ...device.data, ...eventData.body };
    }
    
    // The device instance will handle motion detection automatically
    // through the updateEvent method
  }
  
  async handlePetDetected(device, eventData) {
    this.log(`Pet detected for device ${device.id}`);
    
    const rfidCodes = eventData.rfidCodes || eventData.body?.rfidCodes || [];
    
    for (const rfidCode of rfidCodes) {
      const pet = this.pets.get(rfidCode);
      if (pet) {
        await this.handleKnownPetEvent(pet, eventData);
      } else {
        this.log(`Pet not found for RFID code: ${rfidCode}`);
        // This shouldn't happen for CLEAR classification, but handle it gracefully
        await this.handleUnknownPetDetected(device, eventData);
      }
    }
    
    // Update device state
    if (eventData.body) {
      device.data = { ...device.data, ...eventData.body };
    }
  }
  
  async handleClearActivity(device, eventData) {
    this.log(`Clear activity detected for device ${device.id}`);
    
    // Update device state
    if (eventData.body) {
      device.data = { ...device.data, ...eventData.body };
    }
    
    // The device instance will handle motion detection automatically
    // through the updateEvent method
  }
  
  async handleKnownPetEvent(pet, eventData) {
    this.log(`Handling known pet event for pet ${pet.id}`);
    
    // Determine direction based on trigger source
    const direction = this.determineDirection(eventData.eventTriggerSource);
    
    // Update pet state
    pet.isHome = direction === 'in';
    pet.lastSeen = new Date(eventData.timestamp);
    pet.lastActivity = eventData;
    
    this.log(`Pet ${pet.id} motion detected: ${direction}, isHome: ${pet.isHome}`);
    
    // Trigger pet detected flow card
    const deviceInstance = this.deviceInstances.get(pet.deviceId);
    const petInstance = this.petInstances.get(pet.id);
    
    if (deviceInstance && petInstance) {
      try {
        this.homey.flow.getDeviceTriggerCard('pet_detected').trigger(deviceInstance, {
          device: deviceInstance,
          pet: petInstance,
          direction: direction
        });
        this.log(`Triggered pet_detected flow card for pet ${pet.id} (${direction})`);
      } catch (error) {
        this.error(`Failed to trigger pet_detected flow card for pet ${pet.id}:`, error);
      }
    } else {
      this.log(`Device or pet instance not found for pet ${pet.id}. Device: ${!!deviceInstance}, Pet: ${!!petInstance}`);
    }
    
    // Update pet capabilities
    this.updatePetCapabilities(pet);
  }
  
  determineDirection(triggerSource) {
    switch (triggerSource) {
      case EVENT_TRIGGER_SOURCE.OUTDOOR_MOTION:
        return 'in';
      case EVENT_TRIGGER_SOURCE.INDOOR_MOTION:
        return 'out';
      case EVENT_TRIGGER_SOURCE.MANUAL:
      case EVENT_TRIGGER_SOURCE.REMOTE:
      default:
        return 'in'; // Default to entering for manual/remote events
    }
  }
  
  aggregateEventState(eventData) {
    /**
     * Aggregate event state by merging new event data with existing event data.
     * This ensures that event updates are properly handled and state is maintained.
     */
    if (!eventData.eventId) {
      this.log('Event data missing eventId, cannot aggregate state');
      return eventData;
    }
    
    const eventKey = `${eventData.deviceId}-${eventData.eventId}`;
    const existingEvent = this.events.get(eventKey);
    
    if (existingEvent) {
      this.log(`Aggregating event state for event ${eventData.eventId} (existing data found)`);
      
      // Merge the new event data with existing data
      const aggregatedEvent = {
        ...existingEvent,
        ...eventData,
        // Merge body data if both exist
        body: {
          ...existingEvent.body,
          ...eventData.body
        }
      };
      
      // Update stored event
      this.events.set(eventKey, aggregatedEvent);
      
      this.log(`Event ${eventData.eventId} state aggregated:`, {
        original: existingEvent,
        update: eventData,
        aggregated: aggregatedEvent
      });
      
      return aggregatedEvent;
    } else {
      this.log(`New event ${eventData.eventId}, storing initial state`);
      
      // Store new event
      this.events.set(eventKey, eventData);
      
      return eventData;
    }
  }
  

  

  

  
  synchronizeDeviceCapabilities() {
    this.log('Synchronizing device capabilities...');
    
    // Update all device capabilities
    for (const [deviceId, device] of this.devices) {
      this.updateDeviceCapabilities(device);
    }
    
    // Update all pet capabilities
    for (const [petId, pet] of this.pets) {
      this.updatePetCapabilities(pet);
    }
    
    this.log('Device capabilities synchronization completed');
  }
  

  
  updateDeviceCapabilities(device) {
    const deviceInstance = this.deviceInstances.get(device.id);
    if (!deviceInstance) {
      this.log(`Device instance not found for device: ${device.id}`);
      return;
    }

    try {
      // Update connectivity status
      const isConnected = device.data?.isConnected || false;
      deviceInstance.updateConnectivity(isConnected);

      // Update motion detection based on last event
      if (device.lastEvent) {
        deviceInstance.updateEvent(device.lastEvent);
      }

      // Update presence capability for device (if it has pets)
      if (device.pets && device.pets.length > 0) {
        const anyPetHome = device.pets.some(pet => pet.isHome);
        this.log(`Device ${device.id} has ${device.pets.length} pets, any home: ${anyPetHome}`);
        deviceInstance.setCapabilityValue('alarm_presence', anyPetHome);
      } else {
        this.log(`Device ${device.id} has no pets array or empty pets array`);
      }

      this.log(`Updated capabilities for device: ${device.id}`);
    } catch (error) {
      this.error(`Failed to update device capabilities for ${device.id}:`, error);
    }
  }
  
  updatePetCapabilities(pet) {
    const petInstance = this.petInstances.get(pet.id);
    if (!petInstance) {
      this.log(`Pet instance not found for pet: ${pet.id}`);
      return;
    }

    try {
      // Update presence (home/away status)
      petInstance.updateLocation(pet.isHome);

      // Update last seen timestamp
      if (pet.lastSeen) {
        petInstance.updateLastSeen(pet.lastSeen);
      }

      // Update motion detection if there's recent activity
      if (pet.lastActivity) {
        petInstance.updatePetActivity(pet.lastActivity);
      }

      this.log(`Updated capabilities for pet: ${pet.id} (home: ${pet.isHome})`);
    } catch (error) {
      this.error(`Failed to update pet capabilities for ${pet.id}:`, error);
    }
  }
  
  // Device and pet registration methods
  registerDevice(deviceInstance) {
    const deviceId = deviceInstance.getDeviceId();
    const deviceType = deviceInstance.getDeviceType();
    
    if (deviceType === 'device') {
      this.deviceInstances.set(deviceId, deviceInstance);
      this.log(`Registered device instance: ${deviceId}`);
    } else if (deviceType === 'pet') {
      const rfidCode = deviceInstance.getRfidCode();
      this.petInstances.set(rfidCode, deviceInstance);
      this.log(`Registered pet instance: ${rfidCode}`);
    }
  }
  
  unregisterDevice(deviceInstance) {
    const deviceId = deviceInstance.getDeviceId();
    const deviceType = deviceInstance.getDeviceType();
    
    if (deviceType === 'device') {
      this.deviceInstances.delete(deviceId);
      this.log(`Unregistered device instance: ${deviceId}`);
    } else if (deviceType === 'pet') {
      const rfidCode = deviceInstance.getRfidCode();
      this.petInstances.delete(rfidCode);
      this.log(`Unregistered pet instance: ${rfidCode}`);
    }
  }
  
  registerFlowCards() {
    // Register trigger cards
    this.homey.flow.getDeviceTriggerCard('pet_detected');
    this.homey.flow.getDeviceTriggerCard('contraband_detected');
    this.homey.flow.getDeviceTriggerCard('device_connected');
    this.homey.flow.getDeviceTriggerCard('unknown_pet_detected');
    
    // Register condition cards
    this.homey.flow.getConditionCard('pet_is_home')
      .registerRunListener(async (args, state) => {
        // Check if the pet device is home
        return args.pet.getCapabilityValue('alarm_presence') || false;
      });
    
    // Register action cards
    this.homey.flow.getActionCard('reboot_device')
      .registerRunListener(async (args, state) => {
        await args.device.reboot();
      });
  }
  
  async onUninit() {
    if (this.apiClient) {
      await this.apiClient.disconnect();
    }
  }
}

module.exports = OnlyCatApp;
