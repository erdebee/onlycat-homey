'use strict';

const { EventEmitter } = require('events');
const io = require('socket.io-client');

class OnlyCatApiClient extends EventEmitter {
  constructor(token) {
    super();
    this.token = token;
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    
    this.ONLYCAT_URL = 'https://gateway.onlycat.com';
  }
  
  async connect() {
    if (this.connected) return;
    
    try {
      this.log('Connecting to OnlyCat API...');
      
      this.socket = io(this.ONLYCAT_URL, {
        transports: ['websocket'],
        auth: {
          token: this.token
        },
        headers: {
          platform: 'homey',
          device: 'onlycat-homey'
        },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: this.reconnectDelay,
        timeout: 20000
      });
      
      this.setupEventListeners();
      
      return new Promise((resolve, reject) => {
        this.socket.on('connect', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.log('Connected to OnlyCat API');
          this.emit('connect');
          resolve();
        });
        
        this.socket.on('connect_error', (error) => {
          this.log('Connection error:', error.message);
          reject(error);
        });
        
        this.socket.on('disconnect', (reason) => {
          this.connected = false;
          this.log('Disconnected from OnlyCat API:', reason);
          this.emit('disconnect', reason);
        });
      });
      
    } catch (error) {
      this.log('Failed to connect:', error);
      throw error;
    }
  }
  
  setupEventListeners() {
    // Handle device updates
    this.socket.on('deviceUpdate', (data) => {
      this.log('Device update received:', data);
      this.emit('deviceUpdate', data);
    });
    
    // Handle device event updates
    this.socket.on('deviceEventUpdate', (data) => {
      this.log('Device event update received:', data);
      const normalized = this._normalizeEventData(data);
      this.emit('deviceEventUpdate', normalized);
    });

    // Handle event updates
    this.socket.on('eventUpdate', (data) => {
      this.log('Event update received:', data);
      const normalized = this._normalizeEventData(data);
      this.emit('eventUpdate', normalized);
    });
    
    // Handle user updates
    this.socket.on('userUpdate', (data) => {
      this.log('User update received:', data);
      this.emit('userUpdate', data);
    });
    
    // Handle general events
    this.socket.on('*', (event, ...args) => {
      this.log('Event received:', event, args);
      this.emit(event, ...args);
    });
  }
  
  async disconnect() {
    if (!this.connected || !this.socket) return;
    
    try {
      this.log('Disconnecting from OnlyCat API...');
      this.socket.disconnect();
      this.connected = false;
      this.log('Disconnected from OnlyCat API');
    } catch (error) {
      this.log('Error during disconnect:', error);
    }
  }
  
  async sendMessage(event, data) {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to OnlyCat API');
    }
    
    try {
      this.log(`Sending ${event} message:`, data);
      const response = await this.socket.emitWithAck(event, data);
      this.log(`Received response for ${event} with data: ${JSON.stringify(response).substring(0, 100)}...`);
      return response;
    } catch (error) {
      this.log(`Error sending ${event} message:`, error);
      throw error;
    }
  }
  
  // Device management methods
  async getDevices() {
    return await this.sendMessage('getDevices', { subscribe: true });
  }
  
  async getDevice(deviceId) {
    return await this.sendMessage('getDevice', { 
      deviceId: deviceId, 
      subscribe: true 
    });
  }
  
  async getDeviceEvents(deviceId) {
    const response = await this.sendMessage('getDeviceEvents', { 
      deviceId: deviceId, 
      subscribe: true 
    });
    return Array.isArray(response)
      ? response.map((event) => this._normalizeEventData(event))
      : response;
  }
  
  async getDeviceTransitPolicy(deviceTransitPolicyId) {
    return await this.sendMessage('getDeviceTransitPolicy', { 
      deviceTransitPolicyId: deviceTransitPolicyId 
    });
  }
  
  // RFID management methods
  async getLastSeenRfidCodesByDevice(deviceId) {
    return await this.sendMessage('getLastSeenRfidCodesByDevice', { 
      deviceId: deviceId 
    });
  }
  
  async getRfidProfile(rfidCode) {
    return await this.sendMessage('getRfidProfile', { 
      rfidCode: rfidCode 
    });
  }
  
  // Event management methods
  async getEvent(deviceId, eventId) {
    const response = await this.sendMessage('getEvent', {
      deviceId: deviceId,
      eventId: eventId,
      subscribe: true
    });
    return this._normalizeEventData(response);
  }
  
  async subscribeToDeviceEvent(data) {
    /**
     * Subscribe to a device event to get updates about the event in the future.
     * @param {Object} data - Event data containing deviceId and eventId
     * @param {string} data.deviceId - The device ID
     * @param {string} data.eventId - The event ID
     */
    this.log(`Subscribing to device event: ${data.deviceId}/${data.eventId}`);
    return await this.sendMessage('getEvent', {
      deviceId: data.deviceId,
      eventId: data.eventId,
      subscribe: true
    });
  }
  
  // Device control methods
  async rebootDevice(deviceId) {
    this.log(`Rebooting device ${deviceId}`);
    // This would need to be implemented based on the actual API
    // For now, we'll just log the action
    return { success: true };
  }
  
  // Utility methods
  log(message, ...args) {
    console.log(`[OnlyCatApiClient] ${message}`, ...args);
  }
  
  error(message, ...args) {
    console.error(`[OnlyCatApiClient] ${message}`, ...args);
  }
  
  isConnected() {
    return this.connected;
  }

  // Internal helpers
  _normalizeEventData(data) {
    if (!data || typeof data !== 'object') return data;
    const normalized = { ...data };
    const hasBodySource = normalized && normalized.body && normalized.body.eventTriggerSource != null;
    const rawSource = hasBodySource ? normalized.body.eventTriggerSource : normalized.eventTriggerSource;
    const numericSource = typeof rawSource === 'string' ? Number(rawSource) : rawSource;
    if (numericSource != null && !Number.isNaN(numericSource)) {
      normalized.eventTriggerSource = numericSource;
    }
    return normalized;
  }
}

module.exports = OnlyCatApiClient;
